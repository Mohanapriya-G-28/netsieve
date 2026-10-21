import dgram from 'dgram';

/**
 * NetSieve UDP Datagram Structure
 * Unlike TCP, UDP naturally preserves datagram/message boundaries.
 * There is NO need for length-prefixed framing.
 * However, UDP offers NO delivery or ordering guarantee.
 * Any reliability must be implemented here at the application layer.
 */
export interface UdpDatagram {
  type: 'DATA' | 'ACK';
  id: string;
  conversationId?: string;
  senderId: string;
  senderName: string;
  seq: number;
  ack?: number;
  text?: string;
  timestamp: number;
  attempt: number;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
}

export interface UdpImpairmentConfig {
  lossRatePercent: number; // 0 - 100%
  minDelayMs: number;
  maxDelayMs: number;
}

export interface UdpEngineCallbacks {
  onDatagramReceived: (datagram: UdpDatagram, rinfo: dgram.RemoteInfo) => void;
  onPacketDropped: (datagram: UdpDatagram, rinfo: dgram.RemoteInfo) => void;
  onAckReceived: (ackSeq: number, datagramId: string, rinfo: dgram.RemoteInfo) => void;
  onError: (err: Error) => void;
}

interface PendingMessage {
  datagram: UdpDatagram;
  address: string;
  port: number;
  attempts: number;
  maxRetries: number;
  timeoutMs: number;
  timer: NodeJS.Timeout;
  onSuccess: (rttMs: number) => void;
  onFailure: (reason: string) => void;
}

export class NetSieveUdpEngine {
  private port: number;
  private socket: dgram.Socket;
  private impairment: UdpImpairmentConfig = {
    lossRatePercent: 0,
    minDelayMs: 0,
    maxDelayMs: 0,
  };
  private callbacks: UdpEngineCallbacks;

  // Application-Layer ARQ state: tracks unacknowledged datagrams
  private pendingAcks: Map<string, PendingMessage> = new Map();

  // Deduplication state: tracks recently processed datagram IDs to prevent duplicate delivery
  private processedDatagramIds: Set<string> = new Set();
  private maxProcessedHistory: number = 500;

  constructor(port: number, callbacks: UdpEngineCallbacks) {
    this.port = port;
    this.callbacks = callbacks;
    this.socket = dgram.createSocket('udp4');
    this.setupListeners();
  }

  public setImpairment(config: Partial<UdpImpairmentConfig>) {
    this.impairment = { ...this.impairment, ...config };
  }

  private setupListeners() {
    this.socket.on('message', (msgBuffer, rinfo) => {
      try {
        const datagram: UdpDatagram = JSON.parse(msgBuffer.toString('utf-8'));

        if (datagram.type === 'ACK') {
          // Handle incoming acknowledgment
          this.handleIncomingAck(datagram, rinfo);
        } else {
          // Normal DATA datagram.
          // 1. Send immediate application-level ACK back to sender regardless of deduplication
          this.sendAck(datagram, rinfo.address, rinfo.port);

          // 2. Check for duplicate datagram caused by delayed ACKs or network duplication
          if (this.processedDatagramIds.has(datagram.id)) {
            console.log(`[UDP Engine] 🔁 Duplicate datagram #${datagram.seq} (${datagram.id}) received. Filtered out from chat.`);
            return;
          }

          // Record new datagram in deduplication set
          this.recordProcessedId(datagram.id);

          // Notify receiver callback
          this.callbacks.onDatagramReceived(datagram, rinfo);
        }
      } catch (err: any) {
        console.error('[UDP Engine] Corrupt datagram:', err.message);
      }
    });

    this.socket.on('error', (err) => {
      console.error('[UDP Engine] Socket error:', err.message);
      this.callbacks.onError(err);
    });
  }

  private recordProcessedId(id: string) {
    if (this.processedDatagramIds.size >= this.maxProcessedHistory) {
      // Clear oldest items
      const first = this.processedDatagramIds.values().next().value;
      if (first) this.processedDatagramIds.delete(first);
    }
    this.processedDatagramIds.add(id);
  }

  public start(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.bind(this.port, '0.0.0.0', () => {
        console.log(`[UDP Engine] Native UDP Socket listening on 0.0.0.0:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Sends an application-level ACK for a received datagram
   */
  private sendAck(datagram: UdpDatagram, address: string, port: number) {
    const ackDatagram: UdpDatagram = {
      type: 'ACK',
      id: `ack-${datagram.id}`,
      senderId: 'udp-engine',
      senderName: 'UDP Server',
      seq: 0,
      ack: datagram.seq,
      timestamp: Date.now(),
      attempt: 1
    };

    const buf = Buffer.from(JSON.stringify(ackDatagram), 'utf-8');
    this.socket.send(buf, port, address);
  }

  /**
   * Handles an incoming ACK matching a previously sent unacknowledged datagram
   */
  private handleIncomingAck(ackDatagram: UdpDatagram, rinfo: dgram.RemoteInfo) {
    const originalId = ackDatagram.id.startsWith('ack-') ? ackDatagram.id.slice(4) : '';
    const pending = this.pendingAcks.get(originalId);
    if (pending && pending.datagram.seq === ackDatagram.ack) {
        clearTimeout(pending.timer);
        this.pendingAcks.delete(originalId);

        const rtt = Date.now() - pending.datagram.timestamp;
        this.callbacks.onAckReceived(ackDatagram.ack, pending.datagram.id, rinfo);
        pending.onSuccess(rtt);
    }
  }

  /**
   * Sends a datagram with Application-Layer ARQ (Retries, Timeout, Loss/Delay Simulation)
   */
  public sendReliable(
    datagram: UdpDatagram,
    address: string,
    port: number,
    options: { maxRetries?: number; timeoutMs?: number; enableArq?: boolean } = {}
  ): Promise<{ rttMs?: number; delivered: boolean; attempts: number }> {
    const maxRetries = options.maxRetries ?? 3;
    const timeoutMs = options.timeoutMs ?? 1000;
    const enableArq = options.enableArq ?? true;

    return new Promise((resolve) => {
      let currentAttempt = 1;

      const attemptSend = () => {
        // 1. Simulate Packet Loss
        const isDropped = Math.random() * 100 < this.impairment.lossRatePercent;

        if (isDropped) {
          console.log(`[UDP Impairment] ❌ Dropped datagram #${datagram.seq} (attempt ${currentAttempt}) to ${address}:${port}`);
          this.callbacks.onPacketDropped(datagram, { address, port, family: 'IPv4', size: 0 });

          if (!enableArq) {
            // Pure UDP: Packet is dropped forever
            return resolve({ delivered: false, attempts: currentAttempt });
          }

          // ARQ active: Wait for timeout to trigger retransmission
          scheduleTimeout();
          return;
        }

        // 2. Simulate Latency / Jitter
        const delay = this.impairment.minDelayMs + 
          Math.floor(Math.random() * (this.impairment.maxDelayMs - this.impairment.minDelayMs + 1));

        setTimeout(() => {
          const payload = Buffer.from(JSON.stringify({ ...datagram, attempt: currentAttempt }), 'utf-8');
          this.socket.send(payload, port, address, (err) => {
            if (err) {
              console.error(`[UDP Send Error]:`, err.message);
            }
          });

          if (!enableArq) {
            // No ARQ requested: fire and forget
            return resolve({ delivered: true, attempts: 1 });
          }

          // Schedule ARQ retransmission timer
          scheduleTimeout();
        }, delay);
      };

      const scheduleTimeout = () => {
        const timer = setTimeout(() => {
          if (currentAttempt < maxRetries) {
            currentAttempt++;
            console.log(`[UDP ARQ] ⚠️ Timeout on #${datagram.seq}. Retrying attempt ${currentAttempt}/${maxRetries}...`);
            attemptSend();
          } else {
            console.log(`[UDP ARQ] 🛑 Max retries reached for #${datagram.seq}. Transmission failed.`);
            this.pendingAcks.delete(datagram.id);
            resolve({ delivered: false, attempts: currentAttempt });
          }
        }, timeoutMs);

        this.pendingAcks.set(datagram.id, {
          datagram,
          address,
          port,
          attempts: currentAttempt,
          maxRetries,
          timeoutMs,
          timer,
          onSuccess: (rttMs) => resolve({ rttMs, delivered: true, attempts: currentAttempt }),
          onFailure: () => resolve({ delivered: false, attempts: currentAttempt })
        });
      };

      attemptSend();
    });
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const pending of this.pendingAcks.values()) {
        clearTimeout(pending.timer);
      }
      this.pendingAcks.clear();
      this.processedDatagramIds.clear();
      this.socket.close(() => resolve());
    });
  }
}
