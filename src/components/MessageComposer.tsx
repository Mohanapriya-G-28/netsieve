import React, { useState } from 'react';
import { Send, ShieldCheck, Zap, X } from 'lucide-react';
import { TransportProtocol, NetworkMessage } from '../types/netsieve';

interface MessageComposerProps {
  protocol: TransportProtocol;
  onSend: (text: string) => void;
  disabled?: boolean;
  replyingTo?: NetworkMessage | null;
  onCancelReply?: () => void;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  protocol,
  onSend,
  disabled = false,
  replyingTo,
  onCancelReply,
}) => {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
    if (onCancelReply) onCancelReply();
  };

  const isTCP = protocol === 'TCP';

  return (
    <div className="mt-2">
      {/* Active Reply Banner */}
      {replyingTo && (
        <div className="flex items-center justify-between p-2 mb-1.5 bg-stone-100 border border-stone-200/80 rounded-lg text-xs text-stone-700">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-stone-900 shrink-0">Replying to {replyingTo.senderName}:</span>
            <span className="text-stone-500 truncate">{replyingTo.text}</span>
          </div>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="p-1 text-stone-400 hover:text-stone-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-2 bg-white border border-stone-300 rounded-xl p-2 shadow-2xs focus-within:border-stone-500 focus-within:ring-2 focus-within:ring-stone-200 transition-all">
          {/* Active transport badge */}
          <span className={`px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 shrink-0 ${
            isTCP
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            {isTCP ? <ShieldCheck className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
            <span>{protocol}</span>
          </span>

          {/* Input field */}
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={disabled ? "Connecting to server..." : `Type a message to send via ${protocol}...`}
            disabled={disabled}
            className="flex-1 bg-transparent border-0 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-0 px-2 py-1"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!text.trim() || disabled}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !text.trim() || disabled
                ? 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200'
                : isTCP
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-2xs'
                : 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
            }`}
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex justify-between items-center text-[11px] text-stone-500 mt-1 px-1">
          <span>Press Enter to dispatch over native {protocol} socket</span>
          <span className="font-mono text-stone-400">{new Blob([text]).size} bytes</span>
        </div>
      </form>
    </div>
  );
};
