import React from 'react';
import { BookOpen } from 'lucide-react';
import { TransportProtocol } from '../types/netsieve';

interface ExplanationPanelProps {
  protocol: TransportProtocol;
}

export const ExplanationPanel: React.FC<ExplanationPanelProps> = ({ protocol }) => {
  const isTCP = protocol === 'TCP';

  return (
    <div className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-stone-500" />
          <h3 className="text-sm font-semibold text-stone-900">
            How <span className={isTCP ? 'text-blue-700 font-mono' : 'text-amber-800 font-mono'}>{protocol}</span> Works
          </h3>
        </div>
        <span className="text-[11px] font-mono text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
          OSI Layer 4
        </span>
      </div>

      {isTCP ? (
        <div className="space-y-2.5 text-xs text-stone-600 leading-relaxed">
          <p>
            <strong className="text-stone-900">Connection-Oriented Byte Stream:</strong> The OS kernel establishes a three-way handshake before data transfer. TCP guarantees in-order delivery and retransmits lost packets automatically.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] pt-1">
            <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/80">
              <span className="font-semibold text-stone-800 block mb-0.5">Stream Framing</span>
              <p className="text-stone-600 text-[11px]">
                TCP has <em>no packet boundaries</em>. NetSieve prefixes every frame with a 4-byte length header to reassemble discrete messages.
              </p>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/80">
              <span className="font-semibold text-stone-800 block mb-0.5">Head-of-Line Blocking</span>
              <p className="text-stone-600 text-[11px]">
                Because delivery order is guaranteed, a delayed segment holds back all subsequent bytes until it arrives.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5 text-xs text-stone-600 leading-relaxed">
          <p>
            <strong className="text-stone-900">Connectionless Datagrams:</strong> Packets are dispatched independently without a handshake. UDP does not guarantee delivery, order, or deduplication.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] pt-1">
            <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/80">
              <span className="font-semibold text-stone-800 block mb-0.5">Atomic Boundaries</span>
              <p className="text-stone-600 text-[11px]">
                Each packet is discrete. The receiver reads the complete datagram in one chunk without needing length-prefix framing.
              </p>
            </div>
            <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200/80">
              <span className="font-semibold text-stone-800 block mb-0.5">Application-Level ARQ</span>
              <p className="text-stone-600 text-[11px]">
                To recover lost datagrams, our application must track sequence numbers, timeouts, and ACKs manually.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
