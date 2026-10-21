import React, { useRef, useEffect } from 'react';
import { 
  Check, 
  Clock, 
  AlertTriangle, 
  RotateCw, 
  XCircle,
  CornerDownRight,
  Smile
} from 'lucide-react';
import { NetworkMessage, UserProfile } from '../types/netsieve';

interface MessageListProps {
  messages: NetworkMessage[];
  currentUser: UserProfile;
  onReply?: (msg: NetworkMessage) => void;
  onReact?: (msgId: string, emoji: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  currentUser,
  onReply,
  onReact
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderStatusBadge = (msg: NetworkMessage) => {
    switch (msg.status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
            <Check className="w-3 h-3" />
            <span>ACK'd {msg.rttMs !== undefined ? `(${msg.rttMs}ms)` : ''}</span>
          </span>
        );
      case 'in_flight':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/80">
            <Clock className="w-3 h-3 animate-spin text-blue-600" />
            <span>In flight</span>
          </span>
        );
      case 'retrying':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
            <RotateCw className="w-3 h-3 animate-spin text-amber-700" />
            <span>Retry #{msg.attempts}</span>
          </span>
        );
      case 'lost':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200/80">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Dropped</span>
          </span>
        );
      case 'timeout':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
            <AlertTriangle className="w-3 h-3 text-stone-600" />
            <span>Timeout</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#FCFBF8] rounded-2xl border border-stone-200/90 shadow-xs min-h-0">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-6 text-stone-400">
          <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 mb-2">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-sm font-medium text-stone-700">No messages in this conversation</p>
          <p className="text-xs text-stone-400 mt-1 max-w-sm">
            Send a message below using TCP or UDP to begin live transmission.
          </p>
        </div>
      ) : (
        messages.map((msg) => {
          const isSender = msg.senderId === currentUser.id;
          const isTCP = msg.protocol === 'TCP';

          return (
            <div
              key={msg.id}
              className={`flex flex-col group ${isSender ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] sm:max-w-[78%] rounded-2xl p-4 text-sm transition-all border ${
                  isSender
                    ? 'bg-stone-50/90 border-stone-200 text-stone-900 shadow-2xs'
                    : 'bg-white border-stone-200 text-stone-900 shadow-2xs'
                }`}
              >
                {/* Header metadata bar */}
                <div className="flex items-center gap-2 mb-1.5 pb-1 border-b border-stone-200/70 text-xs text-stone-500">
                  <span className="font-semibold text-stone-800 text-[11px]">
                    {msg.senderName}
                  </span>

                  <span className="text-stone-300">•</span>

                  <span className={`px-1.5 py-0.2 rounded font-mono text-[9px] font-semibold ${
                    isTCP ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {msg.protocol}
                  </span>

                  <span className="text-stone-300">•</span>

                  <span className="font-mono text-[10px] text-stone-500">
                    Seq #{msg.seqNumber}
                  </span>

                  <span className="text-stone-300">•</span>

                  <span className="text-[10px] text-stone-400">
                    {msg.bytes} B
                  </span>
                </div>

                {/* Reply Quote Banner if present */}
                {msg.replyTo && (
                  <div className="mb-2 p-1.5 bg-stone-100/80 rounded border-l-2 border-stone-400 text-xs text-stone-600">
                    <span className="font-semibold text-stone-700 text-[10px] block">
                      Replying to {msg.replyTo.senderName}:
                    </span>
                    <p className="truncate text-[11px]">{msg.replyTo.text}</p>
                  </div>
                )}

                {/* Message Payload text */}
                <p className="break-words font-sans text-stone-800 text-[15px] leading-7">
                  {msg.text}
                </p>

                {/* Emoji Reactions row if any */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(msg.reactions).map(([emoji, userList]) => (
                      <span 
                        key={emoji}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-stone-100 border border-stone-200 text-[11px] text-stone-700"
                        title={userList.join(', ')}
                      >
                        <span>{emoji}</span>
                        <span className="text-[9px] font-semibold text-stone-500">{userList.length}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer status / delivery badge & Actions */}
                <div className="mt-2 flex items-center justify-between gap-4 pt-1.5 border-t border-stone-200/50">
                  <span className="text-[10px] text-stone-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    {/* Reply / React Quick Buttons */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      {onReply && (
                        <button
                          type="button"
                          onClick={() => onReply(msg)}
                          title="Reply to message"
                          className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200/60 transition-colors"
                        >
                          <CornerDownRight className="w-3 h-3" />
                        </button>
                      )}
                      {onReact && (
                        <button
                          type="button"
                          onClick={() => onReact(msg.id, '👍')}
                          title="Thumbs up reaction"
                          className="p-1 text-stone-400 hover:text-stone-700 rounded hover:bg-stone-200/60 transition-colors text-xs"
                        >
                          👍
                        </button>
                      )}
                    </div>
                    {renderStatusBadge(msg)}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
};
