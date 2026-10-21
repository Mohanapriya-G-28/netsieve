import React from 'react';
import { ShieldCheck, Zap } from 'lucide-react';
import { TransportProtocol } from '../types/netsieve';

interface ProtocolSelectorProps {
  currentProtocol: TransportProtocol;
  onChange: (proto: TransportProtocol) => void;
}

export const ProtocolSelector: React.FC<ProtocolSelectorProps> = ({
  currentProtocol,
  onChange,
}) => {
  return (
    <div className="bg-stone-100/80 p-1 rounded-xl border border-stone-200/90 flex gap-1 shadow-xs">
      {/* TCP Option */}
      <button
        type="button"
        onClick={() => onChange('TCP')}
        className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          currentProtocol === 'TCP'
            ? 'bg-white text-stone-900 border border-stone-200 shadow-xs'
            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
        }`}
      >
        <span className={`p-1 rounded-md ${
          currentProtocol === 'TCP' ? 'bg-blue-50 text-blue-600' : 'bg-stone-200 text-stone-500'
        }`}>
          <ShieldCheck className="w-4 h-4" />
        </span>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">TCP</span>
            <span className="text-[11px] font-normal text-stone-500">Stream</span>
          </div>
          <span className="text-[11px] text-stone-500 font-normal">
            Guaranteed in-order delivery
          </span>
        </div>
      </button>

      {/* UDP Option */}
      <button
        type="button"
        onClick={() => onChange('UDP')}
        className={`flex-1 flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          currentProtocol === 'UDP'
            ? 'bg-white text-stone-900 border border-stone-200 shadow-xs'
            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-200/50'
        }`}
      >
        <span className={`p-1 rounded-md ${
          currentProtocol === 'UDP' ? 'bg-amber-50 text-amber-700' : 'bg-stone-200 text-stone-500'
        }`}>
          <Zap className="w-4 h-4" />
        </span>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold">UDP</span>
            <span className="text-[11px] font-normal text-stone-500">Datagram</span>
          </div>
          <span className="text-[11px] text-stone-500 font-normal">
            Fast, connectionless, lossy
          </span>
        </div>
      </button>
    </div>
  );
};
