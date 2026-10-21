import net from 'net';
import { encodeTcpFrame, TcpFrameDecoder, TcpPacket } from './tcpFramer.js';

export interface TcpEngineCallbacks {
  onPacketReceived: (packet: TcpPacket, socketId: string) => void;
  onClientConnected: (socketId: string, address: string) => void;
  onClientDisconnected: (socketId: string) => void;
  onError: (err: Error, socketId?: string) => void;
}

export class NetSieveTcpServer {
  private port: number;
  private server: net.Server | null = null;
  private clients: Map<string, { socket: net.Socket; decoder: TcpFrameDecoder; seqCounter: number }> = new Map();
  private callbacks: TcpEngineCallbacks;

  constructor(port: number, callbacks: TcpEngineCallbacks) {
    this.port = port;
    this.callbacks = callbacks;
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        const socketId = `${socket.remoteAddress}:${socket.remotePort}`;
        const decoder = new TcpFrameDecoder();
        this.clients.set(socketId, { socket, decoder, seqCounter: 0 });

        console.log(`[TCP Engine] Client connected: ${socketId}`);
        this.callbacks.onClientConnected(socketId, `${socket.remoteAddress}:${socket.remotePort}`);

        socket.on('data', (chunk) => {
          // Parse stream chunks into discrete frames
          const packets = decoder.push(chunk);
          for (const pkt of packets) {
            this.callbacks.onPacketReceived(pkt, socketId);

            // If it's a content message, send immediate TCP delivery ACK
            if (pkt.type === 'MSG') {
              const ackPacket: TcpPacket = {
                type: 'ACK',
                id: `ack-${pkt.id}`,
                senderId: 'tcp-engine',
                senderName: 'TCP Server',
                seq: 0,
                ack: pkt.seq,
                timestamp: Date.now()
              };
              socket.write(encodeTcpFrame(ackPacket));
            }
          }
        });

        socket.on('close', (hadError) => {
          console.log(`[TCP Engine] Client closed: ${socketId} (hadError=${hadError})`);
          this.clients.delete(socketId);
          this.callbacks.onClientDisconnected(socketId);
        });

        socket.on('error', (err) => {
          console.error(`[TCP Engine] Socket error on ${socketId}:`, err.message);
          this.callbacks.onError(err, socketId);
        });
      });

      this.server.on('error', (err) => {
        console.error('[TCP Engine] Server listen error:', err.message);
        this.callbacks.onError(err);
        reject(err);
      });

      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`[TCP Engine] Native TCP Server listening on 0.0.0.0:${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Broadcasts a TCP frame to all connected TCP clients
   */
  public broadcast(packet: TcpPacket, excludeSocketId?: string): void {
    const frame = encodeTcpFrame(packet);
    for (const [id, client] of this.clients.entries()) {
      if (id !== excludeSocketId && !client.socket.destroyed) {
        client.socket.write(frame);
      }
    }
  }

  /**
   * Dispatches a framed packet to a specific client
   */
  public sendTo(socketId: string, packet: TcpPacket): boolean {
    const client = this.clients.get(socketId);
    if (client && !client.socket.destroyed) {
      client.socket.write(encodeTcpFrame(packet));
      return true;
    }
    return false;
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }

  public stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.clients.values()) {
        client.socket.destroy();
      }
      this.clients.clear();
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
