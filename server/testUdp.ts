import { NetSieveUdpEngine, UdpDatagram } from './udpEngine.js';

async function runUdpVerification() {
  console.log('--- NetSieve Stage 5: Hardened UDP Path & Deduplication Verification ---');

  const SENDER_PORT = 9983;
  const RECEIVER_PORT = 9984;

  let receivedAtReceiverCount = 0;
  const receivedDatagrams: UdpDatagram[] = [];

  // 1. Receiver UDP Engine
  const receiverEngine = new NetSieveUdpEngine(RECEIVER_PORT, {
    onDatagramReceived: (pkt) => {
      console.log(`[Receiver] ✅ Delivered datagram #${pkt.seq} (ID: ${pkt.id}, Attempt: ${pkt.attempt}): "${pkt.text}"`);
      receivedAtReceiverCount++;
      receivedDatagrams.push(pkt);
    },
    onPacketDropped: () => {},
    onAckReceived: () => {},
    onError: (err) => console.error('[Receiver Error]', err)
  });
  await receiverEngine.start();

  // 2. Sender UDP Engine
  const senderEngine = new NetSieveUdpEngine(SENDER_PORT, {
    onDatagramReceived: () => {},
    onPacketDropped: (pkt) => {
      console.log(`[Sender] 📉 Simulated channel dropped packet #${pkt.seq} (Attempt ${pkt.attempt})`);
    },
    onAckReceived: (ackSeq) => {
      console.log(`[Sender] 📬 Verified application-level ACK for seq #${ackSeq}`);
    },
    onError: (err) => console.error('[Sender Error]', err)
  });
  await senderEngine.start();

  // Test 1: Clean Transmission with App ACK
  console.log('\n--- Test 1: Clean UDP Transmission with App ACK ---');
  senderEngine.setImpairment({ lossRatePercent: 0, minDelayMs: 15, maxDelayMs: 30 });

  const msg1: UdpDatagram = {
    type: 'DATA',
    id: 'udp-hard-1',
    conversationId: 'conv-general',
    senderId: 'alice',
    senderName: 'Alice',
    seq: 1,
    text: 'Standard UDP datagram payload',
    timestamp: Date.now(),
    attempt: 1
  };

  const res1 = await senderEngine.sendReliable(msg1, '127.0.0.1', RECEIVER_PORT, { timeoutMs: 350 });
  console.log(`Test 1 Result: Delivered=${res1.delivered}, RTT=${res1.rttMs}ms, Attempts=${res1.attempts}`);

  // Test 2: Loss & ARQ Retransmission Recovery
  console.log('\n--- Test 2: Loss Simulation & ARQ Retransmission Recovery ---');
  senderEngine.setImpairment({ lossRatePercent: 100 }); // Force drop on attempt 1

  setTimeout(() => {
    console.log('[Impairment Controller] 🩹 Channel restored to 0% loss.');
    senderEngine.setImpairment({ lossRatePercent: 0 });
  }, 200);

  const msg2: UdpDatagram = {
    type: 'DATA',
    id: 'udp-hard-2',
    conversationId: 'conv-general',
    senderId: 'bob',
    senderName: 'Bob',
    seq: 2,
    text: 'UDP datagram requiring retry after drop',
    timestamp: Date.now(),
    attempt: 1
  };

  const res2 = await senderEngine.sendReliable(msg2, '127.0.0.1', RECEIVER_PORT, { timeoutMs: 250, maxRetries: 3 });
  console.log(`Test 2 Result: Delivered=${res2.delivered}, Attempts=${res2.attempts}`);

  // Test 3: Deduplication Filter (Simulating duplicate packet delivery)
  console.log('\n--- Test 3: Duplicate Packet Deduplication Filter ---');
  const countBefore = receivedAtReceiverCount;

  // Send the EXACT same datagram ID twice directly to simulate delayed ACK duplicate
  const duplicateMsg: UdpDatagram = {
    type: 'DATA',
    id: 'udp-hard-1', // Same ID as msg1!
    conversationId: 'conv-general',
    senderId: 'alice',
    senderName: 'Alice',
    seq: 1,
    text: 'Standard UDP datagram payload (duplicate retransmission)',
    timestamp: Date.now(),
    attempt: 2
  };

  // We write directly through raw socket to bypass client pending check and test receiver deduplication
  const dupBuf = Buffer.from(JSON.stringify(duplicateMsg), 'utf-8');
  (senderEngine as any).socket.send(dupBuf, RECEIVER_PORT, '127.0.0.1');

  await new Promise(r => setTimeout(r, 200));

  const deduplicated = receivedAtReceiverCount === countBefore;
  console.log(`Test 3 Result: Receiver count remained ${receivedAtReceiverCount} (Duplicate filtered=${deduplicated})`);

  // Test 4: Pure UDP Permanent Drop (ARQ Disabled)
  console.log('\n--- Test 4: Pure UDP Permanent Drop (ARQ Disabled) ---');
  senderEngine.setImpairment({ lossRatePercent: 100 });

  const msg4: UdpDatagram = {
    type: 'DATA',
    id: 'udp-hard-4',
    conversationId: 'conv-general',
    senderId: 'carol',
    senderName: 'Carol',
    seq: 4,
    text: 'Datagram permanently dropped',
    timestamp: Date.now(),
    attempt: 1
  };

  const res4 = await senderEngine.sendReliable(msg4, '127.0.0.1', RECEIVER_PORT, { enableArq: false });
  console.log(`Test 4 Result (Unreliable Loss): Delivered=${res4.delivered}, Attempts=${res4.attempts}`);

  console.log('\n--- Stage 5 Verification Summary ---');
  console.log(`Normal UDP + App ACK: ${res1.delivered ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Loss Recovery via ARQ: ${res2.delivered && res2.attempts > 1 ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Receiver Deduplication: ${deduplicated ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Pure UDP Permanent Loss: ${!res4.delivered ? 'PASSED ✅' : 'FAILED ❌'}`);

  await senderEngine.stop();
  await receiverEngine.stop();
  console.log('--- Hardened UDP Verification Complete ---');
}

runUdpVerification().catch(console.error);
