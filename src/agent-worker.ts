// ---------------------------------------------------------------------------
// OpenBrowserClaw — Agent Worker
// ---------------------------------------------------------------------------
//
// Runs in a dedicated Web Worker. Owns the Claude API tool-use loop.
// Communicates with the main thread via postMessage.
//
// This is the browser equivalent of NanoClaw's container agent runner.
// Instead of Claude Agent SDK in a Linux container, we use raw Anthropic
// API calls with a tool-use loop.

import type { WorkerInbound, WorkerOutbound, InvokePayload, CompactPayload, ConversationMessage, ThinkingLogEntry, TokenUsage, AIProvider, ContentBlock } from './types.js';
import { TOOL_DEFINITIONS } from './tools.js';
import { API_ENDPOINTS, ANTHROPIC_API_VERSION, FETCH_MAX_RESPONSE } from './config.js';
import { readGroupFile, writeGroupFile, listGroupFiles } from './storage.js';
import { executeShell } from './shell.js';
import { ulid } from './ulid.js';

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

self.onmessage = async (event: MessageEvent<WorkerInbound>) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'invoke':
      await handleInvoke(payload as InvokePayload);
      break;
    case 'compact':
      await handleCompact(payload as CompactPayload);
      break;
    case 'cancel':
      // TODO: AbortController-based cancellation
      break;
  }
};

// Shell emulator needs no boot — it's pure JS over OPFS

// ---------------------------------------------------------------------------
// Agent invocation — tool-use loop
// ---------------------------------------------------------------------------

async function handleInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, provider, model, maxTokens } = payload;

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Starting', `Provider: ${provider} · Model: ${model}`);

  try {
    if (provider === 'anthropic') {
      await handleAnthropicInvoke(payload);
    } else if (provider === 'gemini') {
      await handleGeminiInvoke(payload);
    } else {
      await handleOpenAICompatibleInvoke(payload);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: message } });
  }
}

async function handleAnthropicInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, model, maxTokens } = payload;
  let currentMessages: ConversationMessage[] = [...messages];
  let iterations = 0;
  const maxIterations = 25;

  while (iterations < maxIterations) {
    iterations++;

    const body = {
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: currentMessages,
      tools: TOOL_DEFINITIONS,
    };

    log(groupId, 'api-call', `Anthropic API #${iterations}`, `${currentMessages.length} messages`);

    const res = await fetch(API_ENDPOINTS.anthropic, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`);
    const result = await res.json();

    if (result.usage) {
      post({
        type: 'token-usage',
        payload: {
          groupId,
          inputTokens: result.usage.input_tokens || 0,
          outputTokens: result.usage.output_tokens || 0,
          cacheReadTokens: result.usage.cache_read_input_tokens || 0,
          cacheCreationTokens: result.usage.cache_creation_input_tokens || 0,
          contextLimit: 200_000,
        },
      });
    }

    if (result.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const block of result.content) {
        if (block.type === 'tool_use') {
          log(groupId, 'tool-call', `Tool: ${block.name}`, JSON.stringify(block.input));
          post({ type: 'tool-activity', payload: { groupId, tool: block.name, status: 'running' } });
          const output = await executeTool(block.name, block.input, groupId);
          post({ type: 'tool-activity', payload: { groupId, tool: block.name, status: 'done' } });

          toolResults.push({
            type: 'tool_result' as const,
            tool_use_id: block.id,
            name: block.name,
            content: typeof output === 'string' ? output : JSON.stringify(output),
          });
        }
      }
      currentMessages.push({ role: 'assistant', content: result.content });
      currentMessages.push({ role: 'user', content: toolResults as any });
      post({ type: 'typing', payload: { groupId } });
    } else {
      const text = result.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
      post({ type: 'response', payload: { groupId, text: text.trim() || '(no response)' } });
      return;
    }
  }
}

async function handleOpenAICompatibleInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, provider, model, maxTokens } = payload;
  const endpoint = API_ENDPOINTS[provider as keyof typeof API_ENDPOINTS] as string;

  // Convert Anthropic-style messages to OpenAI-style
  let openAIMessages: any[] = [{ role: 'system', content: systemPrompt }];
  for (const msg of messages) {
    if (typeof msg.content === 'string') {
      openAIMessages.push({ role: msg.role, content: msg.content });
    } else {
      // Handle tool results and assistant content blocks
      for (const block of msg.content) {
        if (block.type === 'text') {
          openAIMessages.push({ role: msg.role, content: block.text });
        } else if (block.type === 'tool_use') {
          openAIMessages.push({
            role: 'assistant',
            tool_calls: [{
              id: block.id,
              type: 'function',
              function: { name: block.name, arguments: JSON.stringify(block.input) }
            }]
          });
        } else if (block.type === 'tool_result') {
          openAIMessages.push({
            role: 'tool',
            tool_call_id: block.tool_use_id,
            content: block.content
          });
        }
      }
    }
  }

  // OpenAI-style tools
  const tools = TOOL_DEFINITIONS.map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }
  }));

  let iterations = 0;
  while (iterations < 25) {
    iterations++;
    log(groupId, 'api-call', `${provider} API #${iterations}`, `${openAIMessages.length} messages`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://openbrowserclaw.local';
      headers['X-Title'] = 'OpenBrowserClaw';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: openAIMessages,
        tools: tools,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) throw new Error(`${provider} error ${res.status}: ${await res.text()}`);
    const result = await res.json();
    const choice = result.choices[0];
    const message = choice.message;

    if (result.usage) {
      post({
        type: 'token-usage',
        payload: {
          groupId,
          inputTokens: result.usage.prompt_tokens || 0,
          outputTokens: result.usage.completion_tokens || 0,
          cacheReadTokens: 0,
          cacheCreationTokens: 0,
          contextLimit: 128_000,
        }
      });
    }

    if (message.tool_calls) {
      openAIMessages.push(message);
      for (const toolCall of message.tool_calls) {
        const name = toolCall.function.name;
        const input = JSON.parse(toolCall.function.arguments);
        log(groupId, 'tool-call', `Tool: ${name}`, JSON.stringify(input));
        post({ type: 'tool-activity', payload: { groupId, tool: name, status: 'running' } });
        const output = await executeTool(name, input, groupId);
        post({ type: 'tool-activity', payload: { groupId, tool: name, status: 'done' } });

        openAIMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof output === 'string' ? output : JSON.stringify(output)
        });
      }
      post({ type: 'typing', payload: { groupId } });
    } else {
      post({ type: 'response', payload: { groupId, text: message.content.trim() || '(no response)' } });
      return;
    }
  }
}

async function handleGeminiInvoke(payload: InvokePayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, model, maxTokens } = payload;
  const endpoint = `${API_ENDPOINTS.gemini}/models/${model}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const contents = messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: typeof msg.content === 'string'
      ? [{ text: msg.content }]
      : msg.content.map(block => {
          if (block.type === 'text') return { text: block.text };
          if (block.type === 'tool_use') return { functionCall: { name: block.name, args: block.input } };
          if (block.type === 'tool_result') return { functionResponse: { name: block.name, response: { content: block.content } } };
          return { text: '' };
      })
  }));

  // Gemini specific tool definition
  const tools = [{
    functionDeclarations: TOOL_DEFINITIONS.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.input_schema
    }))
  }];

  let currentContents = [...contents];
  let iterations = 0;
  while (iterations < 25) {
    iterations++;
    log(groupId, 'api-call', `Gemini API #${iterations}`, `${currentContents.length} messages`);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: currentContents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        tools: tools,
        generationConfig: { maxOutputTokens: maxTokens }
      }),
    });

    if (!res.ok) throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
    const result = await res.json();
    const candidate = result.candidates[0];
    const message = candidate.content;

    currentContents.push(message);

    const callParts = message.parts.filter((p: any) => p.functionCall);
    if (callParts.length > 0) {
      const responseParts = [];
      for (const part of callParts) {
        const { name, args } = part.functionCall;
        log(groupId, 'tool-call', `Tool: ${name}`, JSON.stringify(args));
        post({ type: 'tool-activity', payload: { groupId, tool: name, status: 'running' } });
        const output = await executeTool(name, args, groupId);
        post({ type: 'tool-activity', payload: { groupId, tool: name, status: 'done' } });

        responseParts.push({
          functionResponse: {
            name: name,
            response: { content: typeof output === 'string' ? output : JSON.stringify(output) }
          }
        });
      }
      currentContents.push({ role: 'user', parts: responseParts });
      post({ type: 'typing', payload: { groupId } });
    } else {
      const text = message.parts.map((p: any) => p.text || '').join('');
      post({ type: 'response', payload: { groupId, text: text.trim() || '(no response)' } });
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Context compaction — ask Claude to summarize the conversation
// ---------------------------------------------------------------------------

async function handleCompact(payload: CompactPayload): Promise<void> {
  const { groupId, messages, systemPrompt, apiKey, provider, model, maxTokens } = payload;

  post({ type: 'typing', payload: { groupId } });
  log(groupId, 'info', 'Compacting context', `Summarizing ${messages.length} messages`);

  try {
    const compactSystemPrompt = [
      systemPrompt,
      '',
      '## COMPACTION TASK',
      '',
      'Produce a concise summary of the conversation so far. This will replace history.',
    ].join('\n');

    const compactMessages: ConversationMessage[] = [
      ...messages,
      {
        role: 'user' as const,
        content: 'Please provide a concise summary of our entire conversation so far.',
      },
    ];

    let summary = '';
    if (provider === 'anthropic') {
      const res = await fetch(API_ENDPOINTS.anthropic, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_API_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model,
          max_tokens: 1024,
          system: compactSystemPrompt,
          messages: compactMessages,
        }),
      });
      if (!res.ok) throw new Error(`Anthropic error: ${await res.text()}`);
      const result = await res.json();
      summary = result.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    } else {
      const endpoint = API_ENDPOINTS[provider as keyof typeof API_ENDPOINTS] as string;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: compactSystemPrompt },
            ...compactMessages.map(m => ({ role: m.role, content: m.content as string }))
          ],
          max_tokens: 1024,
        }),
      });
      if (!res.ok) throw new Error(`${provider} error: ${await res.text()}`);
      const result = await res.json();
      summary = result.choices[0].message.content;
    }

    log(groupId, 'info', 'Compaction complete', `Summary: ${summary.length} chars`);
    post({ type: 'compact-done', payload: { groupId, summary } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: 'error', payload: { groupId, error: `Compaction failed: ${message}` } });
  }
}

// ---------------------------------------------------------------------------
// Tool execution
// ---------------------------------------------------------------------------

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  groupId: string,
): Promise<string> {
  try {
    switch (name) {
      case 'bash': {
        const result = await executeShell(
          input.command as string,
          groupId,
          {},
          Math.min((input.timeout as number) || 30, 120),
        );
        let output = result.stdout;
        if (result.stderr) output += (output ? '\n' : '') + result.stderr;
        if (result.exitCode !== 0 && !result.stderr) {
          output += `\n[exit code: ${result.exitCode}]`;
        }
        return output || '(no output)';
      }

      case 'read_file':
        return await readGroupFile(groupId, input.path as string);

      case 'write_file':
        await writeGroupFile(groupId, input.path as string, input.content as string);
        return `Written ${(input.content as string).length} bytes to ${input.path}`;

      case 'list_files': {
        const entries = await listGroupFiles(groupId, (input.path as string) || '.');
        return entries.length > 0 ? entries.join('\n') : '(empty directory)';
      }

      case 'fetch_url': {
        const fetchRes = await fetch(input.url as string, {
          method: (input.method as string) || 'GET',
          headers: input.headers as Record<string, string> | undefined,
          body: input.body as string | undefined,
        });
        const rawText = await fetchRes.text();
        const contentType = fetchRes.headers.get('content-type') || '';
        const status = `[HTTP ${fetchRes.status}]\n`;

        // Strip HTML to reduce token usage
        let body = rawText;
        if (contentType.includes('html') || rawText.trimStart().startsWith('<')) {
          body = stripHtml(rawText);
        }

        return status + body.slice(0, FETCH_MAX_RESPONSE);
      }

      case 'update_memory':
        await writeGroupFile(groupId, 'CLAUDE.md', input.content as string);
        return 'Memory updated successfully.';

      case 'create_task': {
        // Post a dedicated message to the main thread to persist the task
        const taskData = {
          id: ulid(),
          groupId,
          schedule: input.schedule as string,
          prompt: input.prompt as string,
          enabled: true,
          lastRun: null,
          createdAt: Date.now(),
        };
        post({ type: 'task-created', payload: { task: taskData } });
        return `Task created successfully.\nSchedule: ${taskData.schedule}\nPrompt: ${taskData.prompt}`;
      }

      case 'javascript': {
        try {
          // Indirect eval: (0, eval)(...) runs in global scope and
          // naturally returns the value of the last expression —
          // no explicit `return` needed.
          const code = input.code as string;
          const result = (0, eval)(`"use strict";\n${code}`);
          if (result === undefined) return '(no return value)';
          if (result === null) return 'null';
          if (typeof result === 'object') {
            try { return JSON.stringify(result, null, 2); } catch { /* fall through */ }
          }
          return String(result);
        } catch (err: unknown) {
          return `JavaScript error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    return `Tool error (${name}): ${err instanceof Error ? err.message : String(err)}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function post(message: WorkerOutbound): void {
  (self as unknown as Worker).postMessage(message);
}

/**
 * Extract readable text from HTML, stripping tags, scripts, styles, and
 * collapsing whitespace.  Runs in the worker (no DOM), so we use regex.
 */
function stripHtml(html: string): string {
  let text = html;
  // Remove script/style/noscript blocks entirely
  text = text.replace(/<(script|style|noscript|svg|head)[^>]*>[\s\S]*?<\/\1>/gi, '');
  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, '');
  // Remove all tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, '');
  // Collapse whitespace
  text = text.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
  return text;
}

/** Map model names to their context window limits (tokens). */
function getContextLimit(_model: string): number {
  // The actual session context window — 200k tokens for Claude Sonnet/Opus.
  return 200_000;
}

function log(
  groupId: string,
  kind: ThinkingLogEntry['kind'],
  label: string,
  detail?: string,
): void {
  post({
    type: 'thinking-log',
    payload: { groupId, kind, timestamp: Date.now(), label, detail },
  });
}
