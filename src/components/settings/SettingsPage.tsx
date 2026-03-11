// ---------------------------------------------------------------------------
// OpenBrowserClaw — Settings page
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  Palette, KeyRound, Eye, EyeOff, Bot, MessageSquare,
  Smartphone, HardDrive, Lock, Check,
} from 'lucide-react';
import { getConfig, setConfig } from '../../db.js';
import { CONFIG_KEYS } from '../../config.js';
import { getStorageEstimate, requestPersistentStorage } from '../../storage.js';
import { decryptValue } from '../../crypto.js';
import { getOrchestrator } from '../../stores/orchestrator-store.js';
import { useThemeStore, type ThemeChoice } from '../../stores/theme-store.js';

const PROVIDERS = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI (ChatGPT)' },
  { value: 'gemini', label: 'Google (Gemini)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'grok', label: 'xAI (Grok)' },
  { value: 'perplexity', label: 'Perplexity' },
] as const;

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openrouter: [
    { value: 'openrouter/free', label: 'Tự động chọn (Miễn phí)' },
    { value: 'google/gemini-2.0-pro-exp-02-05:free', label: 'Gemini 2.0 Pro (Miễn phí)' },
    { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Miễn phí)' },
    { value: 'qwen/qwen3-coder:free', label: 'Qwen3 Coder (Miễn phí)' },
    { value: 'openai/gpt-oss-120b:free', label: 'GPT OSS 120B (Miễn phí)' },
    { value: 'google/gemma-3-27b-it:free', label: 'Gemma 3 27B (Miễn phí)' },
    { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1' },
    { value: 'anthropic/claude-3.7-sonnet', label: 'Claude 3.7 Sonnet' },
  ],
  anthropic: [
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
    { value: 'o1', label: 'o1' },
    { value: 'o3-mini', label: 'o3-mini' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek-V3' },
    { value: 'deepseek-reasoner', label: 'DeepSeek-R1' },
  ],
  grok: [
    { value: 'grok-2-1212', label: 'Grok 2' },
    { value: 'grok-2-vision-1212', label: 'Grok 2 Vision' },
  ],
  perplexity: [
    { value: 'sonar-reasoning-pro', label: 'Sonar Reasoning Pro' },
    { value: 'sonar-reasoning', label: 'Sonar Reasoning' },
    { value: 'sonar', label: 'Sonar' },
  ],
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}

export function SettingsPage() {
  const orch = getOrchestrator();

  // Provider and API Keys
  const [provider, setProvider] = useState<import('../../types.js').AIProvider>(orch.getProvider());
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openrouter: '',
    anthropic: '',
    openai: '',
    gemini: '',
    deepseek: '',
    grok: '',
    perplexity: '',
  });
  const [apiKeyMasked, setApiKeyMasked] = useState(true);
  const [apiKeySaved, setApiKeySaved] = useState(false);

  // Model
  const [model, setModel] = useState(orch.getModel());

  // Assistant name
  const [assistantName, setAssistantName] = useState(orch.getAssistantName());

  // Telegram
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatIds, setTelegramChatIds] = useState('');
  const [telegramSaved, setTelegramSaved] = useState(false);

  // Storage
  const [storageUsage, setStorageUsage] = useState(0);
  const [storageQuota, setStorageQuota] = useState(0);
  const [isPersistent, setIsPersistent] = useState(false);

  // Theme
  const { theme, setTheme } = useThemeStore();

  // Load current values
  useEffect(() => {
    async function load() {
      // API keys
      const keys: Record<string, string> = {};
      const providerConfigKeys: Record<string, string> = {
        anthropic: CONFIG_KEYS.ANTHROPIC_API_KEY,
        openai: CONFIG_KEYS.OPENAI_API_KEY,
        gemini: CONFIG_KEYS.GEMINI_API_KEY,
        openrouter: CONFIG_KEYS.OPENROUTER_API_KEY,
        deepseek: CONFIG_KEYS.DEEPSEEK_API_KEY,
        grok: CONFIG_KEYS.GROK_API_KEY,
        perplexity: CONFIG_KEYS.PERPLEXITY_API_KEY,
      };

      for (const [p, configKey] of Object.entries(providerConfigKeys)) {
        const enc = await getConfig(configKey);
        if (enc) {
          try {
            keys[p] = await decryptValue(enc);
          } catch {
            keys[p] = '';
          }
        } else {
          keys[p] = '';
        }
      }
      setApiKeys(keys);

      // Telegram
      const token = await getConfig(CONFIG_KEYS.TELEGRAM_BOT_TOKEN);
      if (token) setTelegramToken(token);
      const chatIds = await getConfig(CONFIG_KEYS.TELEGRAM_CHAT_IDS);
      if (chatIds) {
        try {
          setTelegramChatIds(JSON.parse(chatIds).join(', '));
        } catch {
          setTelegramChatIds(chatIds);
        }
      }

      // Storage
      const est = await getStorageEstimate();
      setStorageUsage(est.usage);
      setStorageQuota(est.quota);
      if (navigator.storage?.persisted) {
        setIsPersistent(await navigator.storage.persisted());
      }
    }
    load();
  }, []);

  async function handleSaveApiKey() {
    await orch.setApiKey(provider, apiKeys[provider].trim());
    setApiKeySaved(true);
    setTimeout(() => setApiKeySaved(false), 2000);
  }

  async function handleProviderChange(value: string) {
    const p = value as import('../../types.js').AIProvider;
    setProvider(p);
    await orch.setProvider(p);

    // Auto-switch to first model of provider
    const firstModel = MODELS_BY_PROVIDER[p][0].value;
    setModel(firstModel);
    await orch.setModel(firstModel);
  }

  async function handleModelChange(value: string) {
    setModel(value);
    await orch.setModel(value);
  }

  async function handleNameSave() {
    await orch.setAssistantName(assistantName.trim());
  }

  async function handleTelegramSave() {
    const ids = telegramChatIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await orch.configureTelegram(telegramToken.trim(), ids);
    setTelegramSaved(true);
    setTimeout(() => setTelegramSaved(false), 2000);
  }

  async function handleRequestPersistent() {
    const granted = await requestPersistentStorage();
    setIsPersistent(granted);
  }

  const storagePercent = storageQuota > 0 ? (storageUsage / storageQuota) * 100 : 0;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold mb-6">Cài đặt</h2>

      {/* ---- Theme ---- */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Palette className="w-4 h-4 text-primary" /> Giao diện</h3>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Chủ đề</legend>
            <select
              className="select select-bordered select-sm w-full"
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeChoice)}
            >
              <option value="system">Hệ thống</option>
              <option value="light">Sáng</option>
              <option value="dark">Tối</option>
            </select>
          </fieldset>
        </div>
      </div>

      {/* ---- Provider ---- */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Bot className="w-4 h-4 text-primary" /> Nhà cung cấp AI</h3>
          <select
            className="select select-bordered select-sm w-full"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value)}
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs opacity-60">
            Chọn dịch vụ AI bạn muốn sử dụng. Ưu tiên OpenRouter cho các mô hình miễn phí.
          </p>
        </div>
      </div>

      {/* ---- API Key ---- */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2">
            <KeyRound className="w-4 h-4 text-primary" /> API Key của {PROVIDERS.find(p => p.value === provider)?.label}
          </h3>
          <div className="flex gap-2">
            <input
              type={apiKeyMasked ? 'password' : 'text'}
              className="input input-bordered input-sm w-full flex-1 font-mono"
              placeholder="Nhập API key..."
              value={apiKeys[provider] || ''}
              onChange={(e) => setApiKeys({ ...apiKeys, [provider]: e.target.value })}
            />
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setApiKeyMasked(!apiKeyMasked)}
            >
              {apiKeyMasked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveApiKey}
              disabled={!apiKeys[provider]?.trim()}
            >
              Lưu Key
            </button>
            {apiKeySaved && (
              <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Đã lưu</span>
            )}
          </div>
          <p className="text-xs opacity-60">
            API key của bạn được mã hóa và lưu trữ cục bộ trong trình duyệt.
          </p>
        </div>
      </div>

      {/* ---- Model ---- */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Bot className="w-4 h-4 text-primary" /> Mô hình</h3>
          <select
            className="select select-bordered select-sm w-full"
            value={model}
            onChange={(e) => handleModelChange(e.target.value)}
          >
            {(MODELS_BY_PROVIDER[provider] || []).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- Assistant Name ---- */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><MessageSquare className="w-4 h-4 text-primary" /> Tên Trợ lý</h3>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered input-sm flex-1"
              placeholder="Andy"
              value={assistantName}
              onChange={(e) => setAssistantName(e.target.value)}
              onBlur={handleNameSave}
            />
          </div>
          <p className="text-xs opacity-60">
            Tên gọi của trợ lý. Nhắc đến @{assistantName} để nhận phản hồi.
          </p>
        </div>
      </div>

      {/* ---- Telegram ---- */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><Smartphone className="w-4 h-4 text-primary" /> Bot Telegram</h3>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">Token của Bot</legend>
            <input
              type="password"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="123456:ABC-DEF..."
              value={telegramToken}
              onChange={(e) => setTelegramToken(e.target.value)}
            />
          </fieldset>
          <fieldset className="fieldset">
            <legend className="fieldset-legend">ID Chat được phép</legend>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-mono"
              placeholder="-100123456, 789012"
              value={telegramChatIds}
              onChange={(e) => setTelegramChatIds(e.target.value)}
            />
            <p className="fieldset-label opacity-60">Các ID chat cách nhau bằng dấu phẩy</p>
          </fieldset>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-primary btn-sm"
              onClick={handleTelegramSave}
              disabled={!telegramToken.trim()}
            >
              Lưu cấu hình Telegram
            </button>
            {telegramSaved && (
              <span className="text-success text-sm flex items-center gap-1"><Check className="w-4 h-4" /> Đã lưu</span>
            )}
          </div>
        </div>
      </div>

      {/* ---- Storage ---- */}
      <div className="card bg-base-200 shadow-sm border border-base-300">
        <div className="card-body p-4 sm:p-6 gap-3">
          <h3 className="card-title text-base gap-2"><HardDrive className="w-4 h-4 text-primary" /> Lưu trữ</h3>
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span>Đã dùng {formatBytes(storageUsage)}</span>
              <span className="opacity-60">
                trên {formatBytes(storageQuota)}
              </span>
            </div>
            <progress
              className="progress progress-primary w-full h-2"
              value={storagePercent}
              max={100}
            />
          </div>
          {!isPersistent && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleRequestPersistent}
            >
              <Lock className="w-4 h-4" /> Yêu cầu lưu trữ vĩnh viễn
            </button>
          )}
          {isPersistent && (
            <div className="badge badge-success badge-sm gap-1.5">
              <Lock className="w-3 h-3" /> Chế độ lưu trữ vĩnh viễn đang bật
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
