/**
 * NetSieve TCP Protocol Frame Helper
 * 
 * In TCP (a connection-oriented byte stream), there are NO message boundaries.
 * If sender sends: Message A (10 bytes) and Message B (15 bytes),
 * the receiver's socket might read:
 *   - Chunk 1: 25 bytes (both messages combined)
 *   - Or Chunk 1: 5 bytes, Chunk 2: 20 bytes (fragmented across TCP packets)
 * 
 * To solve this, NetSieve uses 4-byte Big-Endian Length-Prefixed Framing:
 * [ 4-byte uint32 length header | JSON payload bytes of that length ]
 */

export const MAX_FRAME_SIZE = 64 * 1024; // 64 KB safety threshold against memory exhaustion/DoS

export interface TcpPacket {
  type: 'MSG' | 'ACK' | 'JOIN' | 'LEAVE';
  id: string;
  conversationId?: string;
  senderId: string;
  senderName: string;
  seq: number;
  ack?: number;
  text?: string;
  timestamp: number;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
}

/**
 * Encodes a JSON packet into a length-prefixed buffer ready for TCP transmission
 */
export function encodeTcpFrame(packet: TcpPacket): Buffer {
  const jsonStr = JSON.stringify(packet);
  const payloadBuf = Buffer.from(jsonStr, 'utf-8');

  if (payloadBuf.length > MAX_FRAME_SIZE) {
    throw new Error(`[TCP Encoder] Frame size (${payloadBuf.length} B) exceeds maximum allowed limit (${MAX_FRAME_SIZE} B)`);
  }

  const frameBuf = Buffer.alloc(4 + payloadBuf.length);

  // Write 4-byte unsigned 32-bit big-endian integer representing payload length
  frameBuf.writeUInt32BE(payloadBuf.length, 0);
  payloadBuf.copy(frameBuf, 4);

  return frameBuf;
}

/**
 * State helper to parse incoming TCP byte chunks and reconstruct framed packets
 */
export class TcpFrameDecoder {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Appends incoming chunk and extracts all complete frames.
   * Handles stream fragmentation, packet concatenation, and rejects oversized or corrupt frames.
   */
  public push(chunk: Buffer): TcpPacket[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const packets: TcpPacket[] = [];

    while (this.buffer.length >= 4) {
      // Read the expected payload length from the 4-byte header
      const expectedLength = this.buffer.readUInt32BE(0);

      // Guard: Detect corrupted lengths or malicious DoS attempts
      if (expectedLength > MAX_FRAME_SIZE) {
        console.error(`[TCP Decoder] Malformed frame length (${expectedLength} B) exceeds MAX_FRAME_SIZE (${MAX_FRAME_SIZE} B). Discarding corrupt stream.`);
        this.buffer = Buffer.alloc(0); // Flush buffer to prevent memory exhaustion
        break;
      }

      const totalFrameLength = 4 + expectedLength;

      // Check if the full frame has arrived
      if (this.buffer.length < totalFrameLength) {
        // Partial frame: Wait for the remaining bytes in subsequent socket chunks
        break;
      }

      // Extract the payload slice
      const payloadBuf = this.buffer.subarray(4, totalFrameLength);
      // Advance buffer past this frame
      this.buffer = this.buffer.subarray(totalFrameLength);

      try {
        const jsonStr = payloadBuf.toString('utf-8');
        const packet: TcpPacket = JSON.parse(jsonStr);
        packets.push(packet);
      } catch (err: any) {
        console.error('[TCP Decoder] Malformed frame JSON payload:', err.message);
      }
    }

    return packets;
  }

  public getBufferedBytes(): number {
    return this.buffer.length;
  }

  public clear(): void {
    this.buffer = Buffer.alloc(0);
  }
}
