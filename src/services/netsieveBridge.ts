/**
 * NetSieve Client Network Bridge
 * Connects the React browser app to the Node.js native socket gateway and SQLite store.
 */

import { NetworkMessage, SimulationConfig, TransportProtocol, UserProfile, Conversation } from '../types/netsieve';

export interface BridgeCallbacks {
  onStatusChange: (status: 'online' | 'connecting' | 'offline') => void;
  onHydrationData?: (data: { users: UserProfile[]; conversations: Conversation[]; messages: NetworkMessage[] }) => void;
  onMessageDelivered: (id: string, rttMs?: number) => void;
  onMessageRetrying: (id: string, attempt: number) => void;
  onMessageLost: (id: string) => void;
  onIncomingMessage: (msg: NetworkMessage) => void;
  onConversationCreated?: (conv: Conversation) => void;
  onReactionAdded?: (msgId: string, emoji: string, userName: string) => void;
}

export class NetSieveClientBridge {
  private ws: WebSocket | null = null;
  private callbacks: BridgeCallbacks;
  private url: string;
  private reconnectTimer: any = null;
  private disposed = false;

  constructor(url: string, callbacks: BridgeCallbacks) {
    this.url = url;
    this.callbacks = callbacks;
  }

  public connect() {
    if (this.disposed) return;
    this.callbacks.onStatusChange('connecting');
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[NetSieve Bridge] Connected to gateway:', this.url);
        this.callbacks.onStatusChange('online');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleGatewayMessage(data);
        } catch (e) {
          console.error('[NetSieve Bridge] Malformed gateway payload:', e);
        }
      };

      this.ws.onclose = () => {
        this.callbacks.onStatusChange('offline');
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.callbacks.onStatusChange('offline');
      };
    } catch (err) {
      this.callbacks.onStatusChange('offline');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (!this.disposed && !this.reconnectTimer) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect();
      }, 3000);
    }
  }

  private handleGatewayMessage(data: any) {
    if (data.type === 'GATEWAY_READY') {
      if (this.callbacks.onHydrationData && data.users && data.conversations) {
        this.callbacks.onHydrationData({
          users: data.users.map((u: any) => ({ ...u, online: u.online === 1 })),
          conversations: data.conversations,
          messages: data.messages || []
        });
      }
    } else if (data.type === 'ACK_RECEIVED') {
      this.callbacks.onMessageDelivered(data.packetId);
    } else if (data.type === 'PACKET_DROPPED') {
      this.callbacks.onMessageRetrying(data.packetId, data.attempt);
    } else if (data.type === 'UDP_TRANSMIT_RESULT') {
      if (data.delivered) {
        this.callbacks.onMessageDelivered(data.packetId, data.rttMs);
      } else {
        this.callbacks.onMessageLost(data.packetId);
      }
    } else if (data.type === 'CHAT_MESSAGE_ADDED') {
      this.callbacks.onIncomingMessage(data.message);
    } else if (data.type === 'CONVERSATION_CREATED') {
      if (this.callbacks.onConversationCreated) {
        this.callbacks.onConversationCreated(data.conversation);
      }
    } else if (data.type === 'REACTION_ADDED') {
      if (this.callbacks.onReactionAdded) {
        this.callbacks.onReactionAdded(data.messageId, data.emoji, data.userName);
      }
    }
  }

  public sendMessage(
    id: string,
    text: string,
    protocol: TransportProtocol,
    seq: number,
    senderId: string,
    senderName: string,
    conversationId: string,
    config: SimulationConfig,
    replyTo?: { id: string; senderName: string; text: string }
  ) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'SEND_MESSAGE',
        id,
        text,
        protocol,
        seq,
        senderId,
        senderName,
        conversationId,
        config,
        replyTo
      }));
    } else {
      console.warn('[NetSieve Bridge] Gateway not connected. Message dropped.');
      this.callbacks.onMessageLost(id);
    }
  }

  public createGroup(conversation: Conversation) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'CREATE_GROUP',
        conversation
      }));
    }
  }

  public addReaction(messageId: string, emoji: string, userName: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'ADD_REACTION',
        messageId,
        emoji,
        userName
      }));
    }
  }

  public updateConfig(config: SimulationConfig) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'UPDATE_CONFIG',
        config
      }));
    }
  }

  public disconnect() {
    this.disposed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    if (this.ws) this.ws.close();
  }
}
