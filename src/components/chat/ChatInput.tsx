// ---------------------------------------------------------------------------
// OpenBrowserClaw — Chat input (with file support)
// ---------------------------------------------------------------------------

import React, { useRef, useState } from 'react';
import { Send, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import type { ContentBlock } from '../../types.js';

interface Props {
  onSend: (content: string | ContentBlock[]) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Xử lý chọn file (hình ảnh + txt + pdf)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments(prev => [...prev, {
            type: 'image_url',
            image_url: { url: reader.result as string },
            name: file.name,
            preview: reader.result as string
          }]);
        };
        reader.readAsDataURL(file);
      }
      else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const fileText = await file.text();
        setAttachments(prev => [...prev, {
          type: 'text',
          text: `Nội dung file ${file.name}:\n${fileText}`,
          name: file.name
        }]);
      }
      else if (file.type === 'application/pdf') {
        try {
          const pdfjsLib = await import('pdfjs-dist');
          // Use CDN for worker as it's easier in this environment
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
          }
          setAttachments(prev => [...prev, {
            type: 'text',
            text: `Nội dung PDF "${file.name}":\n${fullText}`,
            name: file.name
          }]);
        } catch (err) {
          console.error('Failed to parse PDF:', err);
          alert('Không thể đọc tệp PDF này.');
        }
      }
    }
    e.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    if (attachments.length === 0) {
      onSend(trimmed);
    } else {
      const content: ContentBlock[] = [];
      if (trimmed) {
        content.push({ type: 'text', text: trimmed });
      } else {
        content.push({ type: 'text', text: 'Phân tích file đính kèm:' });
      }

      for (const att of attachments) {
        if (att.type === 'image_url') {
          content.push({ type: 'image_url', image_url: att.image_url, name: att.name });
        } else {
          content.push({ type: 'text', text: att.text });
        }
      }
      onSend(content);
    }

    setText('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex flex-col border-t border-base-300 bg-base-100 p-2 sm:p-4 gap-2">
      {/* Preview attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-2">
          {attachments.map((att, i) => (
            <div key={i} className="flex items-center gap-2 bg-base-200 px-3 py-1.5 rounded-xl text-xs border border-base-300">
              {att.type === 'image_url' ? <ImageIcon size={14} className="text-primary" /> : null}
              <span className="max-w-[150px] truncate font-medium">{att.name}</span>
              <button onClick={() => removeAttachment(i)} className="text-error hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2 bg-base-200 rounded-2xl px-3 py-2 border border-base-300">
        {/* Nút đính kèm */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-ghost btn-sm btn-circle text-primary"
          title="Đính kèm tệp"
        >
          <Paperclip size={20} />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.txt,.pdf"
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* Ô nhập text */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn hoặc đính kèm ảnh/PDF/txt..."
          className="flex-1 bg-transparent outline-none resize-none max-h-52 py-1.5 text-base chat-textarea"
          rows={1}
          disabled={disabled}
        />

        {/* Nút gửi */}
        <button
          onClick={handleSend}
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          className="btn btn-primary btn-sm btn-circle"
          aria-label="Gửi tin nhắn"
        >
          <Send size={18} />
        </button>
      </div>
      <p className="text-[10px] opacity-40 text-center">
        Hỗ trợ: ảnh, PDF, TXT • Model vision: Claude 3.7, GPT-4o, Gemini (free)
      </p>
    </div>
  );
}
