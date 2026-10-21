import React, { useState, useEffect, useRef } from 'react';
import { 
  Network, 
  Trash2, 
  Sliders, 
  ShieldCheck, 
  Zap, 
  ChevronRight, 
  ChevronLeft,
  Hash,
  Users
} from 'lucide-react';
import { ConversationSidebar } from './components/ConversationSidebar';
import { MessageList } from './components/MessageList';
import { MessageComposer } from './components/MessageComposer';
import { NetworkDashboard } from './components/NetworkDashboard';
import { ExplanationPanel } from './components/ExplanationPanel';
import { CreateGroupModal } from './components/CreateGroupModal';
import { 
  NetworkMessage, 
  NetworkTelemetry, 
  SimulationConfig, 
  TransportProtocol,
  UserProfile,
  Conversation
} from './types/netsieve';
import { NetSieveClientBridge } from './services/netsieveBridge';

// Initial preloaded users for student multi-user simulations
const INITIAL_USERS: UserProfile[] = [
  { id: 'user-alice', username: 'alice', displayName: 'Alice Chen', avatarColor: '#2563EB', online: true },
  { id: 'user-bob', username: 'bob', displayName: 'Bob Martin', avatarColor: '#059669', online: true },
  { id: 'user-carol', username: 'carol', displayName: 'Carol Davis', avatarColor: '#D97706', online: true },
];

const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-general',
    type: 'group',
    name: 'Classroom Channel',
    description: 'Shared group broadcast across all connected peers',
    avatarColor: '#4F46E5',
    participants: ['user-alice', 'user-bob', 'user-carol'],
    lastMessage: {
      text: 'Welcome to NetSieve Chat. Select TCP or UDP to begin!',
      timestamp: Date.now() - 60000,
      protocol: 'TCP'
    }
  },
  {
    id: 'conv-bob',
    type: 'direct',
    name: 'Bob Martin',
    avatarColor: '#059669',
    participants: ['user-alice', 'user-bob'],
    lastMessage: {
      text: 'Hey! Ready to test packet loss on UDP?',
      timestamp: Date.now() - 30000,
      protocol: 'UDP'
    }
  }
];

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile>(INITIAL_USERS[0]);
  const [users, setUsers] = useState<UserProfile[]>(INITIAL_USERS);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-general');
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [showInspectorDrawer, setShowInspectorDrawer] = useState(false);
  const [replyingTo, setReplyingTo] = useState<NetworkMessage | null>(null);

  const [protocol, setProtocol] = useState<TransportProtocol>('TCP');

  const [messages, setMessages] = useState<NetworkMessage[]>([
    {
      id: 'init-msg-1',
      conversationId: 'conv-general',
      senderId: 'user-bob',
      senderName: 'Bob Martin',
      text: 'Welcome to NetSieve Chat. Select TCP or UDP to begin testing!',
      timestamp: Date.now() - 60000,
      protocol: 'TCP',
      seqNumber: 1,
      bytes: 62,
      status: 'delivered',
      rttMs: 14,
      attempts: 1
    },
    {
      id: 'init-msg-2',
      conversationId: 'conv-bob',
      senderId: 'user-bob',
      senderName: 'Bob Martin',
      text: 'Hey! Ready to test packet loss on UDP?',
      timestamp: Date.now() - 30000,
      protocol: 'UDP',
      seqNumber: 2,
      bytes: 38,
      status: 'delivered',
      rttMs: 22,
      attempts: 1
    }
  ]);

  const [config, setConfig] = useState<SimulationConfig>({
    lossRatePercent: 20,
    simulatedDelayMs: 40,
    autoRetryEnabled: true,
    maxRetries: 3,
    timeoutMs: 1200,
  });

  const [telemetry, setTelemetry] = useState<NetworkTelemetry>({
    protocol: 'TCP',
    connected: false,
    gatewayState: 'connecting',
    messagesSent: 0,
    messagesReceived: 0,
    bytesTransmitted: 0,
    lastRttMs: null,
    avgRttMs: null,
    currentSeq: 3,
    packetsLost: 0,
    retransmissions: 0,
  });

  const bridgeRef = useRef<NetSieveClientBridge | null>(null);

  useEffect(() => {
    const host = window.location.hostname || 'localhost';
    const wsUrl = `ws://${host}:8080`;

    const bridge = new NetSieveClientBridge(wsUrl, {
      onStatusChange: (status) => {
        setTelemetry(prev => ({
          ...prev,
          gatewayState: status,
          connected: status === 'online'
        }));
      },
      onHydrationData: (data) => {
        if (data.users.length > 0) setUsers(data.users);
        if (data.conversations.length > 0) setConversations(data.conversations);
        if (data.messages.length > 0) setMessages(data.messages);
      },
      onMessageDelivered: (id, rttMs) => {
        setMessages(prev => prev.map(m => {
          if (m.id === id) {
            const finalRtt = rttMs !== undefined ? rttMs : (Date.now() - m.timestamp);
            return { ...m, status: 'delivered', rttMs: finalRtt };
          }
          return m;
        }));

        setTelemetry(prev => {
          const rtt = rttMs || 15;
          return {
            ...prev,
            lastRttMs: rtt,
            avgRttMs: prev.avgRttMs ? Math.round((prev.avgRttMs + rtt) / 2) : rtt
          };
        });
      },
      onMessageRetrying: (id, attempt) => {
        setMessages(prev => prev.map(m => {
          if (m.id === id) {
            return { ...m, status: 'retrying', attempts: attempt };
          }
          return m;
        }));
        setTelemetry(prev => ({
          ...prev,
          packetsLost: prev.packetsLost + 1,
          retransmissions: prev.retransmissions + 1
        }));
      },
      onMessageLost: (id) => {
        setMessages(prev => prev.map(m => {
          if (m.id === id) {
            return { ...m, status: 'lost' };
          }
          return m;
        }));
        setTelemetry(prev => ({
          ...prev,
          packetsLost: prev.packetsLost + 1
        }));
      },
      onIncomingMessage: (msg) => {
        setMessages(prev => {
          const exists = prev.some(m => m.id === msg.id);
          return exists ? prev.map(m => m.id === msg.id ? msg : m) : [...prev, msg];
        });
        setTelemetry(prev => ({
          ...prev,
          messagesReceived: prev.messagesReceived + 1,
          bytesTransmitted: prev.bytesTransmitted + msg.bytes
        }));
      },
      onConversationCreated: (conv) => {
        setConversations(prev => [conv, ...prev.filter(item => item.id !== conv.id)]);
      },
      onReactionAdded: (msgId, emoji, userName) => {
        setMessages(prev => prev.map(m => {
          if (m.id === msgId) {
            const reactions = { ...(m.reactions || {}) };
            const userList = reactions[emoji] || [];
            if (!userList.includes(userName)) {
              reactions[emoji] = [...userList, userName];
            }
            return { ...m, reactions };
          }
          return m;
        }));
      }
    });

    bridge.connect();
    bridgeRef.current = bridge;

    return () => {
      bridge.disconnect();
    };
  }, []);

  const activeConversation = conversations.find(c => c.id === activeConversationId) || conversations[0];
  const activeMessages = messages.filter(m => m.conversationId === activeConversationId);

  const handleSendMessage = (text: string) => {
    const seq = telemetry.currentSeq;
    const byteSize = new Blob([text]).size;
    const msgId = `pkt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const replyPayload = replyingTo ? {
      id: replyingTo.id,
      senderName: replyingTo.senderName,
      text: replyingTo.text
    } : undefined;

    const newMsg: NetworkMessage = {
      id: msgId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      senderName: currentUser.displayName,
      text,
      timestamp: Date.now(),
      protocol,
      seqNumber: seq,
      bytes: byteSize,
      status: 'in_flight',
      attempts: 1,
      replyTo: replyPayload
    };

    setMessages(prev => [...prev, newMsg]);

    // Update conversation snippet
    setConversations(prev => prev.map(c => {
      if (c.id === activeConversationId) {
        return {
          ...c,
          lastMessage: {
            text,
            timestamp: Date.now(),
            protocol
          }
        };
      }
      return c;
    }));

    setTelemetry(prev => ({
      ...prev,
      messagesSent: prev.messagesSent + 1,
      bytesTransmitted: prev.bytesTransmitted + byteSize,
      currentSeq: prev.currentSeq + 1,
    }));

    bridgeRef.current?.sendMessage(
      msgId,
      text,
      protocol,
      seq,
      currentUser.id,
      currentUser.displayName,
      activeConversationId,
      config,
      replyPayload
    );
    setReplyingTo(null);
  };

  const handleCreateGroup = (name: string, description: string, memberIds: string[]) => {
    const newGroup: Conversation = {
      id: `group-${Date.now()}`,
      type: 'group',
      name,
      description,
      avatarColor: '#0D9488',
      participants: memberIds,
    };
    setConversations(prev => [newGroup, ...prev]);
    bridgeRef.current?.createGroup(newGroup);
    setActiveConversationId(newGroup.id);
  };

  const handleReact = (msgId: string, emoji: string) => {
    bridgeRef.current?.addReaction(msgId, emoji, currentUser.displayName);
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const reactions = { ...(m.reactions || {}) };
        const userList = reactions[emoji] || [];
        if (!userList.includes(currentUser.displayName)) {
          reactions[emoji] = [...userList, currentUser.displayName];
        }
        return { ...m, reactions };
      }
      return m;
    }));
  };

  return (
    <div className="h-screen bg-[#FBF9F5] text-stone-900 flex flex-col font-sans overflow-hidden">
      {/* Top Application Bar */}
      <header className="border-b border-stone-200/90 bg-white px-4 py-3 sm:px-6 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center text-white">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-stone-950">NetSieve Chat</h1>
              <span className="text-[10px] font-mono text-stone-500 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded">
                Multi-User Lab
              </span>
            </div>
            <p className="hidden sm:block text-xs text-stone-500">
              Interactive messaging over genuine TCP streams & UDP datagrams
            </p>
          </div>
        </div>

        {/* Right header controls */}
        <div className="flex items-center gap-2">
          {/* Telemetry Inspector Toggle */}
          <button
            type="button"
            onClick={() => setShowInspectorDrawer(!showInspectorDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
              showInspectorDrawer 
                ? 'bg-stone-900 text-white border-stone-900 shadow-2xs' 
                : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Network Inspector</span>
            <span className={`w-2 h-2 rounded-full ${telemetry.connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          </button>
        </div>
      </header>

      {/* Main Two-Pane Chat Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Conversations & Direct Chats Sidebar */}
        <ConversationSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          users={users}
          currentUser={currentUser}
          onSwitchUser={setCurrentUser}
          onCreateGroup={() => setIsGroupModalOpen(true)}
          currentProtocol={protocol}
          onProtocolChange={(next) => { setProtocol(next); setTelemetry(prev => ({ ...prev, protocol: next })); }}
        />

        {/* Center: Main Active Conversation Thread */}
        <main className="flex-1 flex flex-col bg-[#FBF9F5] p-3 sm:p-5 min-w-0 overflow-hidden gap-1">
          {/* Active Conversation Sub-header */}
          <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-stone-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: activeConversation.avatarColor }}
              >
                {activeConversation.type === 'group' ? <Hash className="w-4 h-4" /> : activeConversation.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-stone-900 truncate">
                  {activeConversation.name}
                </h2>
                <p className="text-[11px] text-stone-500 truncate">
                  {activeConversation.type === 'group' 
                    ? `${activeConversation.participants.length} participants • ${activeConversation.description || 'Group'}` 
                    : `Direct channel with ${activeConversation.name}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium border flex items-center gap-1 ${
                protocol === 'TCP' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}>
                {protocol === 'TCP' ? <ShieldCheck className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
                <span>Active: {protocol}</span>
              </span>
            </div>
          </div>

          {/* Chat Messages */}
          <MessageList
            messages={activeMessages}
            currentUser={currentUser}
            onReply={setReplyingTo}
            onReact={handleReact}
          />

          {/* Composer */}
          <MessageComposer
            protocol={protocol}
            onSend={handleSendMessage}
            disabled={!telemetry.connected}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </main>

        {/* Right Drawer: Network Inspector & Theory Guide (Collapsible) */}
        {showInspectorDrawer && (
          <aside className="w-80 sm:w-96 bg-white border-l border-stone-200/90 p-4 flex flex-col gap-4 overflow-y-auto shrink-0 shadow-lg z-10">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-sm font-semibold text-stone-900">Layer 4 Telemetry</h3>
              <button
                onClick={() => setShowInspectorDrawer(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <NetworkDashboard
              telemetry={telemetry}
              config={config}
              onConfigChange={(next) => { setConfig(next); bridgeRef.current?.updateConfig(next); }}
            />

            <ExplanationPanel protocol={protocol} />
          </aside>
        )}
      </div>

      {/* New Group Modal */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        users={users}
        currentUserId={currentUser.id}
        onCreate={handleCreateGroup}
      />
    </div>
  );
}

export default App;
