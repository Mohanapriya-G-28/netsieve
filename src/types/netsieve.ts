export type TransportProtocol = 'TCP' | 'UDP';

export type MessageStatus = 
  | 'queued' 
  | 'in_flight' 
  | 'delivered' 
  | 'retrying' 
  | 'lost' 
  | 'timeout';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  online: boolean;
  statusText?: string;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  description?: string;
  avatarColor: string;
  participants: string[]; // user IDs
  unreadCount?: number;
  lastMessage?: {
    text: string;
    timestamp: number;
    protocol: TransportProtocol;
  };
}

export interface NetworkMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  protocol: TransportProtocol;
  seqNumber: number;
  ackNumber?: number;
  bytes: number;
  status: MessageStatus;
  rttMs?: number;
  attempts: number;
  simulatedLoss?: boolean;
  replyTo?: {
    id: string;
    senderName: string;
    text: string;
  };
  reactions?: Record<string, string[]>; // emoji -> array of userNames
}

export interface NetworkTelemetry {
  protocol: TransportProtocol;
  connected: boolean;
  gatewayState: 'online' | 'connecting' | 'offline';
  messagesSent: number;
  messagesReceived: number;
  bytesTransmitted: number;
  lastRttMs: number | null;
  avgRttMs: number | null;
  currentSeq: number;
  packetsLost: number;
  retransmissions: number;
  congestionWindow?: number;
}

export interface SimulationConfig {
  lossRatePercent: number; // 0 - 60%
  simulatedDelayMs: number; // 0 - 600ms
  autoRetryEnabled: boolean;
  maxRetries: number;
  timeoutMs: number;
}
