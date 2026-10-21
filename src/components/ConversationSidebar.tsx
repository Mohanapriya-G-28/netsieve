import React, { useState } from 'react';
import { 
  Users, 
  MessageSquare, 
  Search, 
  Plus, 
  Circle,
  Hash,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { Conversation, UserProfile, TransportProtocol } from '../types/netsieve';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  onSelectConversation: (id: string) => void;
  users: UserProfile[];
  currentUser: UserProfile;
  onSwitchUser: (user: UserProfile) => void;
  onCreateGroup: () => void;
  currentProtocol: TransportProtocol;
  onProtocolChange: (proto: TransportProtocol) => void;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  users,
  currentUser,
  onSwitchUser,
  onCreateGroup,
  currentProtocol,
  onProtocolChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const filteredConversations = conversations.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className="w-full md:w-80 bg-white border-r border-stone-200/90 flex flex-col h-full shrink-0">
      {/* User Identity Banner */}
      <div className="p-3 border-b border-stone-200/80 bg-stone-50/70">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className="w-full flex items-center justify-between p-2 rounded-lg bg-white border border-stone-200 hover:border-stone-300 transition-all cursor-pointer text-left shadow-2xs"
          >
            <div className="flex items-center gap-2.5">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: currentUser.avatarColor || '#3B82F6' }}
              >
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-stone-900">{currentUser.displayName}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                </div>
                <span className="text-[11px] text-stone-500 font-mono">@{currentUser.username}</span>
              </div>
            </div>
            <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">
              Switch
            </span>
          </button>

          {/* Quick Profile Switcher Dropdown */}
          {showUserDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-xl shadow-lg z-50 p-1.5 space-y-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
                Simulate Active User:
              </div>
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    onSwitchUser(u);
                    setShowUserDropdown(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    u.id === currentUser.id ? 'bg-stone-100 font-semibold text-stone-900' : 'hover:bg-stone-50 text-stone-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: u.avatarColor }}
                    >
                      {u.displayName.charAt(0)}
                    </span>
                    <span>{u.displayName} (@{u.username})</span>
                  </div>
                  {u.id === currentUser.id && <span className="text-[10px] text-blue-600">Active</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Global Protocol Selector Pill in Sidebar */}
        <div className="mt-2.5 flex bg-stone-100 p-0.5 rounded-lg border border-stone-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => onProtocolChange('TCP')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all cursor-pointer ${
              currentProtocol === 'TCP' 
                ? 'bg-white text-blue-700 shadow-2xs font-semibold' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
            <span>TCP Stream</span>
          </button>
          <button
            type="button"
            onClick={() => onProtocolChange('UDP')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all cursor-pointer ${
              currentProtocol === 'UDP' 
                ? 'bg-white text-amber-800 shadow-2xs font-semibold' 
                : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span>UDP Datagram</span>
          </button>
        </div>
      </div>

      {/* Search & New Group Header */}
      <div className="p-3 border-b border-stone-200/80 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-stone-50/70 border border-stone-200 rounded-lg placeholder-stone-400 focus:outline-none focus:border-stone-400 focus:bg-white transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={onCreateGroup}
          title="New Group Chat"
          className="p-1.5 text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200/80 rounded-lg border border-stone-200 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
        <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-stone-400">
          Conversations ({filteredConversations.length})
        </div>

        {filteredConversations.map((conv) => {
          const isActive = conv.id === activeConversationId;
          const isGroup = conv.type === 'group';

          return (
            <button
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`w-full text-left p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                isActive 
                  ? 'bg-stone-100/90 border-l-3 border-stone-800' 
                  : 'hover:bg-stone-50/80'
              }`}
            >
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-semibold shrink-0"
                style={{ backgroundColor: conv.avatarColor }}
              >
                {isGroup ? <Hash className="w-4 h-4" /> : conv.name.charAt(0)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <h4 className="text-xs font-semibold text-stone-900 truncate">
                    {conv.name}
                  </h4>
                  {conv.lastMessage && (
                    <span className="text-[10px] text-stone-400 font-mono">
                      {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 text-[11px] text-stone-500">
                  <p className="truncate">
                    {conv.lastMessage ? conv.lastMessage.text : (conv.description || 'No messages yet')}
                  </p>
                  {conv.lastMessage && (
                    <span className={`text-[9px] font-mono px-1 rounded shrink-0 ${
                      conv.lastMessage.protocol === 'TCP' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800'
                    }`}>
                      {conv.lastMessage.protocol}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
