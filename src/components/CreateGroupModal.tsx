import React, { useState } from 'react';
import { X, Users, Hash } from 'lucide-react';
import { UserProfile } from '../types/netsieve';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: UserProfile[];
  currentUserId: string;
  onCreate: (name: string, description: string, memberIds: string[]) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  users,
  currentUserId,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  if (!isOpen) return null;

  const toggleMember = (id: string) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(
      name.trim(),
      description.trim(),
      Array.from(new Set([currentUserId, ...selectedMembers]))
    );
    setName('');
    setDescription('');
    setSelectedMembers([]);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xl max-w-md w-full p-5 text-stone-900">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-stone-100 text-stone-700">
              <Users className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-semibold text-stone-900">Create Group Chat</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Group Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Networks Study Group"
              className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Description (Optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Topic or project goals"
              className="w-full text-xs px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:border-stone-400 focus:bg-white transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Select Participants</label>
            <div className="max-h-36 overflow-y-auto space-y-1 bg-stone-50/60 p-2 border border-stone-200 rounded-lg">
              {users.filter(u => u.id !== currentUserId).map(u => (
                <label 
                  key={u.id}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-stone-100/80 cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: u.avatarColor }}
                    >
                      {u.displayName.charAt(0)}
                    </span>
                    <span className="text-stone-800">{u.displayName} (@{u.username})</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(u.id)}
                    onChange={() => toggleMember(u.id)}
                    className="w-4 h-4 rounded border-stone-300 text-stone-800 focus:ring-0"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/70 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:bg-stone-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
