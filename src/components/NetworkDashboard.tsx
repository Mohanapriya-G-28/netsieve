import React, { useState } from 'react';
import { 
  Clock, 
  Layers, 
  RefreshCw, 
  AlertTriangle,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { NetworkTelemetry, SimulationConfig } from '../types/netsieve';

interface NetworkDashboardProps {
  telemetry: NetworkTelemetry;
  config: SimulationConfig;
  onConfigChange: (newConfig: SimulationConfig) => void;
}

export const NetworkDashboard: React.FC<NetworkDashboardProps> = ({
  telemetry,
  config,
  onConfigChange,
}) => {
  const isTCP = telemetry.protocol === 'TCP';
  const [showImpairments, setShowImpairments] = useState(true);

  return (
    <div className="bg-white border border-stone-200/90 rounded-xl p-4 shadow-xs flex flex-col gap-4">
      {/* Header and status */}
      <div className="flex items-center justify-between border-b border-stone-100 pb-3">
        <div>
          <h2 className="text-sm font-semibold text-stone-900">
            Network Inspector
          </h2>
          <p className="text-xs text-stone-500">Live transport layer metrics</p>
        </div>

        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-stone-50 border border-stone-200">
          <span className={`w-2 h-2 rounded-full ${
            telemetry.gatewayState === 'online' ? 'bg-emerald-500' : 'bg-amber-500'
          }`} />
          <span className="text-stone-600 capitalize">
            {telemetry.gatewayState}
          </span>
        </div>
      </div>

      {/* 4 Core Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Metric 1: RTT */}
        <div className="bg-stone-50/70 border border-stone-200/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Latency</span>
            <Clock className="w-3.5 h-3.5 text-stone-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-stone-900">
              {telemetry.lastRttMs !== null ? `${telemetry.lastRttMs}` : '--'}
            </span>
            <span className="text-xs text-stone-500 font-mono">ms</span>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            Avg: {telemetry.avgRttMs ? `${telemetry.avgRttMs} ms` : 'N/A'}
          </div>
        </div>

        {/* Metric 2: Sequence */}
        <div className="bg-stone-50/70 border border-stone-200/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Next Seq</span>
            <Layers className="w-3.5 h-3.5 text-stone-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-stone-900">
              #{telemetry.currentSeq}
            </span>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            {telemetry.messagesSent} sent / {telemetry.messagesReceived} rcvd
          </div>
        </div>

        {/* Metric 3: Packet Loss */}
        <div className="bg-stone-50/70 border border-stone-200/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Loss / Drops</span>
            <AlertTriangle className="w-3.5 h-3.5 text-stone-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-bold font-mono ${
              telemetry.packetsLost > 0 ? 'text-rose-600' : 'text-stone-900'
            }`}>
              {telemetry.packetsLost}
            </span>
            <span className="text-xs text-stone-500 font-mono">pkts</span>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            {isTCP ? '0 (OS handles loss)' : `${config.lossRatePercent}% simulated`}
          </div>
        </div>

        {/* Metric 4: Retransmissions */}
        <div className="bg-stone-50/70 border border-stone-200/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>Retries</span>
            <RefreshCw className="w-3.5 h-3.5 text-stone-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className={`text-xl font-bold font-mono ${
              telemetry.retransmissions > 0 ? 'text-amber-700' : 'text-stone-900'
            }`}>
              {telemetry.retransmissions}
            </span>
            <span className="text-xs text-stone-500 font-mono">times</span>
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">
            {isTCP ? 'OS stack ARQ' : (config.autoRetryEnabled ? 'App ARQ on' : 'Unreliable / No ARQ')}
          </div>
        </div>
      </div>

      {/* Collapsible Impairment Controls */}
      <div className="border border-stone-200 rounded-lg overflow-hidden bg-stone-50/40">
        <button
          type="button"
          onClick={() => setShowImpairments(!showImpairments)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-stone-700 bg-stone-50 hover:bg-stone-100/80 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-stone-500" />
            <span>Channel Simulation Controls (Packet loss & Delay)</span>
          </div>
          {showImpairments ? (
            <ChevronUp className="w-3.5 h-3.5 text-stone-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
          )}
        </button>

        {showImpairments && (
          <div className="p-3 space-y-3.5 border-t border-stone-200/80 text-xs">
            {/* Packet Loss Slider */}
            <div>
              <div className="flex justify-between text-stone-700 mb-1">
                <span className="font-medium">Simulated Packet Loss:</span>
                <span className="font-mono font-semibold text-rose-600">{config.lossRatePercent}%</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="60" 
                step="5"
                value={config.lossRatePercent}
                onChange={(e) => onConfigChange({ ...config, lossRatePercent: Number(e.target.value) })}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700"
                disabled={isTCP}
              />
              <span className="text-[11px] text-stone-500 block mt-1">
                {isTCP 
                  ? 'Disabled: TCP guarantees reliable delivery at transport layer.' 
                  : 'Randomly drops outgoing UDP datagrams to demonstrate unreliability or trigger retries.'}
              </span>
            </div>

            {/* Delay Slider */}
            <div>
              <div className="flex justify-between text-stone-700 mb-1">
                <span className="font-medium">Simulated Jitter / Propagation Delay:</span>
                <span className="font-mono font-semibold text-blue-600">{config.simulatedDelayMs} ms</span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="600"
                step="25"
                value={config.simulatedDelayMs}
                onChange={(e) => onConfigChange({ ...config, simulatedDelayMs: Number(e.target.value) })}
                className="w-full h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-stone-700"
              />
              <span className="text-[11px] text-stone-500 block mt-1">
                Adds artificial round-trip propagation time before socket dispatch.
              </span>
            </div>

            {/* Application ARQ Toggle */}
            <div className="pt-2 border-t border-stone-200/60">
              <label className="flex items-start gap-2.5 cursor-pointer text-stone-800">
                <input 
                  type="checkbox"
                  checked={config.autoRetryEnabled}
                  onChange={(e) => onConfigChange({ ...config, autoRetryEnabled: e.target.checked })}
                  disabled={isTCP}
                  className="mt-0.5 w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-0 cursor-pointer"
                />
                <div>
                  <span className="font-medium text-xs">Application-Level ARQ (ACK & Retries)</span>
                  <span className="text-[11px] text-stone-500 block mt-0.5">
                    {isTCP 
                      ? 'TCP provides ARQ natively in the OS kernel.' 
                      : 'When checked, NetSieve attaches timeout timers and retransmits lost UDP datagrams up to 3 times.'}
                  </span>
                </div>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
