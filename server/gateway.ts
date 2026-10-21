import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { NetSieveTcpServer } from './tcpEngine.js';
import { NetSieveUdpEngine, UdpDatagram } from './udpEngine.js';
import { TcpPacket, encodeTcpFrame, TcpFrameDecoder } from './tcpFramer.js';
import { NetSieveDatabase } from './db.js';
import net from 'net';

const WS_PORT = 8080;
const TCP_PORT = 9001;
const UDP_PORT = 9002;
const PEER_UDP_PORT = 9003;

console.log('--- NetSieve Gateway Bridge Starting ---');

// Initialize SQLite database
const db = new NetSieveDatabase();

// 1. Initialize Native TCP Server
let tcpServer: NetSieveTcpServer;
// 2. Initialize Native UDP Engines
let udpSenderEngine: NetSieveUdpEngine;
let udpReceiverEngine: NetSieveUdpEngine;

// Connected WebSocket UI clients
const uiClients: Set<WebSocket> = new Set();

function broadcastToUi(msg: any) {
  const payload = JSON.stringify(msg);
  for (const client of uiClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// -------------------------------------------------------------
// TCP SINK (RECEIVER): Native TCP Server Socket (:9001)
// -------------------------------------------------------------
tcpServer = new NetSieveTcpServer(TCP_PORT, {
  onPacketReceived: (pkt, socketId) => {
    console.log(`[TCP Server] Delivered frame #${pkt.seq} (ID: ${pkt.id}) in "${pkt.conversationId}" from ${socketId}`);

    // If message is not already in DB, persist it
    db.saveMessage({
      id: pkt.id,
      conversationId: pkt.conversationId || 'conv-general',
      senderId: pkt.senderId,
      senderName: pkt.senderName,
      text: pkt.text || '',
      timestamp: pkt.timestamp,
      protocol: 'TCP',
      seqNumber: pkt.seq,
      bytes: Buffer.byteLength(pkt.text || '', 'utf-8'),
      status: 'delivered',
      replyTo: pkt.replyTo
    });

    // Broadcast verified arrival to all connected UI clients
    broadcastToUi({
      type: 'CHAT_MESSAGE_ADDED',
      message: {
        id: pkt.id,
        conversationId: pkt.conversationId || 'conv-general',
        senderId: pkt.senderId,
        senderName: pkt.senderName,
        text: pkt.text || '',
        timestamp: pkt.timestamp,
        protocol: 'TCP',
        seqNumber: pkt.seq,
        bytes: Buffer.byteLength(pkt.text || '', 'utf-8'),
        status: 'delivered',
        attempts: 1,
        replyTo: pkt.replyTo
      }
    });
  },
  onClientConnected: (socketId) => {
    console.log(`[TCP Server] Native client connected: ${socketId}`);
  },
  onClientDisconnected: (socketId) => {
    console.log(`[TCP Server] Native client disconnected: ${socketId}`);
  },
  onError: (err) => {
    console.error('[TCP Server Error]', err.message);
  }
});

// Dedicated internal TCP client socket used by the bridge to push browser traffic through native TCP loopback
const bridgeTcpSocket = new net.Socket();
const bridgeTcpDecoder = new TcpFrameDecoder();
let isBridgeTcpConnected = false;

bridgeTcpSocket.on('data', (chunk) => {
  const packets = bridgeTcpDecoder.push(chunk);
  for (const pkt of packets) {
    if (pkt.type === 'ACK') {
      console.log(`[TCP Bridge] Got transport delivery ACK for sequence #${pkt.ack} (ID: ${pkt.id})`);
      
      // Update persistence
      db.updateMessageStatus(pkt.id, 'delivered');

      broadcastToUi({
        type: 'ACK_RECEIVED',
        protocol: 'TCP',
        ackSeq: pkt.ack,
        packetId: pkt.id
      });
    }
  }
});

bridgeTcpSocket.on('error', (err) => {
  console.log('[TCP Bridge Client Socket]:', err.message);
});

// -------------------------------------------------------------
// UDP SINK (PEER RECEIVER): Native UDP Datagram Socket (:9003)
// -------------------------------------------------------------
udpReceiverEngine = new NetSieveUdpEngine(PEER_UDP_PORT, {
  onDatagramReceived: (datagram) => {
    console.log(`[UDP Peer Receiver] Delivered datagram #${datagram.seq} (ID: ${datagram.id}) in "${datagram.conversationId}"`);
    
    // Save delivered datagram to SQLite
    db.saveMessage({
      id: datagram.id,
      conversationId: datagram.conversationId || 'conv-general',
      senderId: datagram.senderId,
      senderName: datagram.senderName,
      text: datagram.text || '',
      timestamp: datagram.timestamp,
      protocol: 'UDP',
      seqNumber: datagram.seq,
      bytes: Buffer.byteLength(datagram.text || '', 'utf-8'),
      status: 'delivered',
      attempts: datagram.attempt,
      replyTo: datagram.replyTo
    });

    // Broadcast arrived datagram to all chat tabs
    broadcastToUi({
      type: 'CHAT_MESSAGE_ADDED',
      message: {
        id: datagram.id,
        conversationId: datagram.conversationId || 'conv-general',
        senderId: datagram.senderId,
        senderName: datagram.senderName,
        text: datagram.text || '',
        timestamp: datagram.timestamp,
        protocol: 'UDP',
        seqNumber: datagram.seq,
        bytes: Buffer.byteLength(datagram.text || '', 'utf-8'),
        status: 'delivered',
        attempts: datagram.attempt,
        replyTo: datagram.replyTo
      }
    });
  },
  onPacketDropped: () => {},
  onAckReceived: () => {},
  onError: (err) => console.error('[UDP Peer Error]', err.message)
});

// UDP Sender Engine (:9002) with simulated impairment and app ARQ
udpSenderEngine = new NetSieveUdpEngine(UDP_PORT, {
  onDatagramReceived: () => {},
  onPacketDropped: (datagram) => {
    broadcastToUi({
      type: 'PACKET_DROPPED',
      protocol: 'UDP',
      packetId: datagram.id,
      seq: datagram.seq,
      attempt: datagram.attempt
    });
  },
  onAckReceived: (ackSeq, datagramId) => {
    db.updateMessageStatus(datagramId, 'delivered');
    broadcastToUi({
      type: 'ACK_RECEIVED',
      protocol: 'UDP',
      ackSeq,
      packetId: datagramId
    });
  },
  onError: (err) => console.error('[UDP Sender Error]', err.message)
});

// -------------------------------------------------------------
// WEBSOCKET GATEWAY: Browser Interface (:8080)
// -------------------------------------------------------------
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'NetSieve Gateway Running', 
    tcpPort: TCP_PORT, 
    udpPort: UDP_PORT,
    peerUdpPort: PEER_UDP_PORT,
    usersCount: db.getUsers().length 
  }));
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('[WS Gateway] Browser UI client connected.');
  uiClients.add(ws);

  // Send complete initial hydration state from SQLite
  ws.send(JSON.stringify({
    type: 'GATEWAY_READY',
    tcpPort: TCP_PORT,
    udpPort: UDP_PORT,
    peerUdpPort: PEER_UDP_PORT,
    users: db.getUsers(),
    conversations: db.getConversations(),
    messages: db.getMessages(),
  }));

  ws.on('message', async (rawMsg) => {
    try {
      const data = JSON.parse(rawMsg.toString());

      if (data.type === 'UPDATE_CONFIG') {
        udpSenderEngine.setImpairment({
          lossRatePercent: data.config.lossRatePercent,
          minDelayMs: data.config.simulatedDelayMs,
          maxDelayMs: data.config.simulatedDelayMs + 20,
        });
        return;
      }

      if (data.type === 'CREATE_GROUP') {
        db.createConversation(data.conversation);
        broadcastToUi({
          type: 'CONVERSATION_CREATED',
          conversation: data.conversation
        });
        return;
      }

      if (data.type === 'ADD_REACTION') {
        db.addReaction(data.messageId, data.emoji, data.userName);
        broadcastToUi({
          type: 'REACTION_ADDED',
          messageId: data.messageId,
          emoji: data.emoji,
          userName: data.userName
        });
        return;
      }

      if (data.type === 'SEND_MESSAGE') {
        const { protocol, text, seq, id, senderId, senderName, conversationId, config, replyTo } = data;
        const timestamp = Date.now();
        const bytes = Buffer.byteLength(text, 'utf-8');

        // Persist message initially as in_flight
        db.saveMessage({
          id,
          conversationId: conversationId || 'conv-general',
          senderId: senderId || 'user-alice',
          senderName: senderName || 'Alice Chen',
          text,
          timestamp,
          protocol,
          seqNumber: seq,
          bytes,
          status: 'in_flight',
          replyTo
        });

        if (protocol === 'TCP') {
          // --- Real Native TCP Stream Transmission ---
          const tcpPkt: TcpPacket = {
            type: 'MSG',
            id,
            conversationId: conversationId || 'conv-general',
            senderId: senderId || 'user-alice',
            senderName: senderName || 'Alice Chen',
            seq,
            text,
            timestamp,
            replyTo
          };

          const frame = encodeTcpFrame(tcpPkt);

          if (!isBridgeTcpConnected) {
            bridgeTcpSocket.connect(TCP_PORT, '127.0.0.1', () => {
              isBridgeTcpConnected = true;
              console.log('[TCP Bridge] Connected to Native TCP Port 9001.');
              bridgeTcpSocket.write(frame);
            });
          } else {
            bridgeTcpSocket.write(frame);
          }

        } else if (protocol === 'UDP') {
          // --- Real Native UDP Datagram Transmission ---
          const udpDatagram: UdpDatagram = {
            type: 'DATA',
            id,
            conversationId: conversationId || 'conv-general',
            senderId: senderId || 'user-alice',
            senderName: senderName || 'Alice Chen',
            seq,
            text,
            timestamp,
            attempt: 1,
            replyTo
          };

          udpSenderEngine.setImpairment({
            lossRatePercent: config.lossRatePercent,
            minDelayMs: config.simulatedDelayMs,
            maxDelayMs: config.simulatedDelayMs + 20
          });

          const result = await udpSenderEngine.sendReliable(
            udpDatagram,
            '127.0.0.1',
            PEER_UDP_PORT,
            {
              enableArq: config.autoRetryEnabled,
              maxRetries: config.maxRetries || 3,
              timeoutMs: config.timeoutMs || 1000
            }
          );

          // Update message status in database
          db.updateMessageStatus(
            id,
            result.delivered ? 'delivered' : 'lost',
            result.rttMs ?? undefined,
            result.attempts
          );

          broadcastToUi({
            type: 'UDP_TRANSMIT_RESULT',
            packetId: id,
            seq,
            delivered: result.delivered,
            attempts: result.attempts,
            rttMs: result.rttMs
          });
        }
      }
    } catch (err: any) {
      console.error('[WS Message Parse Error]:', err.message);
    }
  });

  ws.on('close', () => {
    uiClients.delete(ws);
    console.log('[WS Gateway] Browser client disconnected.');
  });
});

async function main() {
  await tcpServer.start();
  await udpReceiverEngine.start();
  await udpSenderEngine.start();

  server.listen(WS_PORT, '0.0.0.0', () => {
    console.log(`[WS Gateway] WebSocket-to-Socket Bridge listening on 0.0.0.0:${WS_PORT}`);
    console.log(`Database connected: netsieve.db (${db.getUsers().length} users loaded)`);
  });
}

main().catch(console.error);
