import { NetSieveTcpServer } from './tcpEngine.js';
import { encodeTcpFrame, TcpFrameDecoder, TcpPacket, MAX_FRAME_SIZE } from './tcpFramer.js';
import net from 'net';

async function runTcpVerification() {
  console.log('--- NetSieve Stage 4: TCP Path Hardening Verification ---');

  const TCP_PORT = 9877;
  const receivedServerPackets: TcpPacket[] = [];
  const receivedClientPackets: TcpPacket[] = [];

  // 1. Initialize TCP Engine
  const tcpServer = new NetSieveTcpServer(TCP_PORT, {
    onPacketReceived: (pkt, socketId) => {
      console.log(`[Test Server] Received frame #${pkt.seq} (${pkt.type}) in conversation "${pkt.conversationId}": "${pkt.text || ''}"`);
      receivedServerPackets.push(pkt);
    },
    onClientConnected: (socketId) => {
      console.log(`[Test Server] Client connected: ${socketId}`);
    },
    onClientDisconnected: (socketId) => {
      console.log(`[Test Server] Client disconnected: ${socketId}`);
    },
    onError: (err) => {
      console.error('[Test Server] Error:', err.message);
    }
  });

  await tcpServer.start();

  // 2. Connect client socket
  const clientSocket = new net.Socket();
  const clientDecoder = new TcpFrameDecoder();

  clientSocket.connect(TCP_PORT, '127.0.0.1', async () => {
    console.log('[Test Client] Connected to TCP Engine on port 9877');

    // Test 1: Chunk Concatenation (2 frames in one socket write)
    const msg1: TcpPacket = {
      type: 'MSG',
      id: 'msg-tcp-1',
      conversationId: 'conv-general',
      senderId: 'alice',
      senderName: 'Alice',
      seq: 1,
      text: 'First TCP message in stream',
      timestamp: Date.now()
    };

    const msg2: TcpPacket = {
      type: 'MSG',
      id: 'msg-tcp-2',
      conversationId: 'conv-general',
      senderId: 'alice',
      senderName: 'Alice',
      seq: 2,
      text: 'Second TCP message concatenated in same stream buffer',
      timestamp: Date.now()
    };

    const combined = Buffer.concat([encodeTcpFrame(msg1), encodeTcpFrame(msg2)]);
    console.log(`[Test 1] Writing 2 concatenated frames (${combined.length} bytes)...`);
    clientSocket.write(combined);

    // Test 2: Chunk Fragmentation / Partial Reads (Split 1 frame into 3 separate writes)
    await new Promise(r => setTimeout(r, 200));

    const msg3: TcpPacket = {
      type: 'MSG',
      id: 'msg-tcp-3',
      conversationId: 'conv-general',
      senderId: 'bob',
      senderName: 'Bob',
      seq: 3,
      text: 'Third TCP message fragmented across 3 separate chunk deliveries',
      timestamp: Date.now()
    };

    const frame3 = encodeTcpFrame(msg3);
    const part1 = frame3.subarray(0, 8); // Header + tiny slice
    const part2 = frame3.subarray(8, 25);
    const part3 = frame3.subarray(25);

    console.log(`[Test 2] Writing fragmented frame 3 in 3 pieces (${part1.length}B, ${part2.length}B, ${part3.length}B)...`);
    clientSocket.write(part1);
    await new Promise(r => setTimeout(r, 80));
    clientSocket.write(part2);
    await new Promise(r => setTimeout(r, 80));
    clientSocket.write(part3);

    // Test 3: Malformed/Oversized Frame Protection
    await new Promise(r => setTimeout(r, 200));
    console.log('[Test 3] Simulating corrupted/oversized frame length header (0xFFFFFFFF)...');
    const corruptHeader = Buffer.alloc(4);
    corruptHeader.writeUInt32BE(0xFFFFFFFF, 0); // 4 GB claim
    clientSocket.write(corruptHeader);
  });

  clientSocket.on('data', (chunk) => {
    const packets = clientDecoder.push(chunk);
    for (const pkt of packets) {
      if (pkt.type === 'ACK') {
        console.log(`[Test Client] Received ACK for packet #${pkt.ack}`);
        receivedClientPackets.push(pkt);
      }
    }
  });

  // Allow 1.2s to observe full transmission
  await new Promise(r => setTimeout(r, 1200));

  const passedConcatenation = receivedServerPackets.some(p => p.id === 'msg-tcp-1') && 
                              receivedServerPackets.some(p => p.id === 'msg-tcp-2');
  const passedFragmentation = receivedServerPackets.some(p => p.id === 'msg-tcp-3');
  const passedAcks = receivedClientPackets.length >= 3;

  console.log('\n--- Hardened TCP Verification Results ---');
  console.log(`TCP Concatenation De-chunking: ${passedConcatenation ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`TCP Fragmentation Assembly: ${passedFragmentation ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`TCP ACKs & Delivery Guarantee: ${passedAcks ? 'PASSED ✅' : 'FAILED ❌'}`);

  clientSocket.destroy();
  await tcpServer.stop();
  console.log('--- TCP Hardening Verification Complete ---');
}

runTcpVerification().catch(console.error);
