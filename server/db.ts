import Database from 'better-sqlite3';
import path from 'path';

export interface DbUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  online: number;
}

export interface DbConversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  description?: string;
  avatarColor: string;
  participantsJson: string; // JSON array of user IDs
  createdAt: number;
}

export interface DbMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  protocol: 'TCP' | 'UDP';
  seqNumber: number;
  bytes: number;
  status: string;
  rttMs: number | null;
  attempts: number;
  replyToJson?: string;
  reactionsJson?: string;
}

export class NetSieveDatabase {
  private db: Database.Database;

  constructor(dbPath: string = path.resolve('netsieve.db')) {
    this.db = new Database(dbPath);
    this.initTables();
    this.seedDefaults();
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        displayName TEXT NOT NULL,
        avatarColor TEXT NOT NULL,
        online INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        avatarColor TEXT NOT NULL,
        participantsJson TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        senderName TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        protocol TEXT NOT NULL,
        seqNumber INTEGER NOT NULL,
        bytes INTEGER NOT NULL,
        status TEXT NOT NULL,
        rttMs INTEGER,
        attempts INTEGER DEFAULT 1,
        replyToJson TEXT,
        reactionsJson TEXT,
        FOREIGN KEY (conversationId) REFERENCES conversations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversationId, timestamp);
    `);
  }

  private seedDefaults() {
    const userCount = (this.db.prepare('SELECT count(*) as count FROM users').get() as any).count;
    if (userCount === 0) {
      const insertUser = this.db.prepare(`
        INSERT INTO users (id, username, displayName, avatarColor, online)
        VALUES (@id, @username, @displayName, @avatarColor, @online)
      `);

      insertUser.run({ id: 'user-alice', username: 'alice', displayName: 'Alice Chen', avatarColor: '#2563EB', online: 1 });
      insertUser.run({ id: 'user-bob', username: 'bob', displayName: 'Bob Martin', avatarColor: '#059669', online: 1 });
      insertUser.run({ id: 'user-carol', username: 'carol', displayName: 'Carol Davis', avatarColor: '#D97706', online: 1 });

      const insertConv = this.db.prepare(`
        INSERT INTO conversations (id, type, name, description, avatarColor, participantsJson, createdAt)
        VALUES (@id, @type, @name, @description, @avatarColor, @participantsJson, @createdAt)
      `);

      insertConv.run({
        id: 'conv-general',
        type: 'group',
        name: 'Classroom Channel',
        description: 'Shared group broadcast across all connected peers',
        avatarColor: '#4F46E5',
        participantsJson: JSON.stringify(['user-alice', 'user-bob', 'user-carol']),
        createdAt: Date.now() - 3600000
      });

      insertConv.run({
        id: 'conv-bob',
        type: 'direct',
        name: 'Bob Martin',
        description: 'Direct channel with Bob',
        avatarColor: '#059669',
        participantsJson: JSON.stringify(['user-alice', 'user-bob']),
        createdAt: Date.now() - 1800000
      });

      const insertMsg = this.db.prepare(`
        INSERT INTO messages (id, conversationId, senderId, senderName, text, timestamp, protocol, seqNumber, bytes, status, rttMs, attempts)
        VALUES (@id, @conversationId, @senderId, @senderName, @text, @timestamp, @protocol, @seqNumber, @bytes, @status, @rttMs, @attempts)
      `);

      insertMsg.run({
        id: 'msg-seed-1',
        conversationId: 'conv-general',
        senderId: 'user-bob',
        senderName: 'Bob Martin',
        text: 'Welcome to NetSieve Chat! Choose TCP or UDP to test Layer 4 transport.',
        timestamp: Date.now() - 60000,
        protocol: 'TCP',
        seqNumber: 1,
        bytes: 68,
        status: 'delivered',
        rttMs: 14,
        attempts: 1
      });

      insertMsg.run({
        id: 'msg-seed-2',
        conversationId: 'conv-bob',
        senderId: 'user-bob',
        senderName: 'Bob Martin',
        text: 'Hey Alice! Ready to test packet drops on UDP?',
        timestamp: Date.now() - 30000,
        protocol: 'UDP',
        seqNumber: 2,
        bytes: 42,
        status: 'delivered',
        rttMs: 24,
        attempts: 1
      });
    }
  }

  // --- User Queries ---
  public getUsers(): DbUser[] {
    return this.db.prepare('SELECT * FROM users ORDER BY displayName ASC').all() as DbUser[];
  }

  public setUserOnline(id: string, online: boolean) {
    this.db.prepare('UPDATE users SET online = ? WHERE id = ?').run(online ? 1 : 0, id);
  }

  // --- Conversation Queries ---
  public getConversations(): any[] {
    const convs = this.db.prepare('SELECT * FROM conversations ORDER BY createdAt DESC').all() as DbConversation[];
    return convs.map(c => {
      const lastMsg = this.db.prepare(
        'SELECT text, timestamp, protocol FROM messages WHERE conversationId = ? ORDER BY timestamp DESC LIMIT 1'
      ).get(c.id) as any;

      return {
        id: c.id,
        type: c.type,
        name: c.name,
        description: c.description,
        avatarColor: c.avatarColor,
        participants: JSON.parse(c.participantsJson),
        lastMessage: lastMsg || undefined
      };
    });
  }

  public createConversation(conv: {
    id: string;
    type: 'direct' | 'group';
    name: string;
    description?: string;
    avatarColor: string;
    participants: string[];
  }) {
    this.db.prepare(`
      INSERT INTO conversations (id, type, name, description, avatarColor, participantsJson, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      conv.id,
      conv.type,
      conv.name,
      conv.description || null,
      conv.avatarColor,
      JSON.stringify(conv.participants),
      Date.now()
    );
  }

  // --- Message Queries ---
  public getMessages(conversationId?: string): any[] {
    const query = conversationId 
      ? 'SELECT * FROM messages WHERE conversationId = ? ORDER BY timestamp ASC'
      : 'SELECT * FROM messages ORDER BY timestamp ASC';
    
    const rows = (conversationId 
      ? this.db.prepare(query).all(conversationId) 
      : this.db.prepare(query).all()) as DbMessage[];

    return rows.map(r => ({
      id: r.id,
      conversationId: r.conversationId,
      senderId: r.senderId,
      senderName: r.senderName,
      text: r.text,
      timestamp: r.timestamp,
      protocol: r.protocol,
      seqNumber: r.seqNumber,
      bytes: r.bytes,
      status: r.status,
      rttMs: r.rttMs,
      attempts: r.attempts,
      replyTo: r.replyToJson ? JSON.parse(r.replyToJson) : undefined,
      reactions: r.reactionsJson ? JSON.parse(r.reactionsJson) : undefined
    }));
  }

  public saveMessage(msg: {
    id: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    text: string;
    timestamp: number;
    protocol: 'TCP' | 'UDP';
    seqNumber: number;
    bytes: number;
    status: string;
    rttMs?: number | null;
    attempts?: number;
    replyTo?: any;
    reactions?: any;
  }) {
    this.db.prepare(`
      INSERT OR REPLACE INTO messages 
      (id, conversationId, senderId, senderName, text, timestamp, protocol, seqNumber, bytes, status, rttMs, attempts, replyToJson, reactionsJson)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      msg.id,
      msg.conversationId,
      msg.senderId,
      msg.senderName,
      msg.text,
      msg.timestamp,
      msg.protocol,
      msg.seqNumber,
      msg.bytes,
      msg.status,
      msg.rttMs || null,
      msg.attempts || 1,
      msg.replyTo ? JSON.stringify(msg.replyTo) : null,
      msg.reactions ? JSON.stringify(msg.reactions) : null
    );
  }

  public updateMessageStatus(id: string, status: string, rttMs?: number, attempts?: number) {
    if (rttMs !== undefined && attempts !== undefined) {
      this.db.prepare('UPDATE messages SET status = ?, rttMs = ?, attempts = ? WHERE id = ?')
        .run(status, rttMs, attempts, id);
    } else if (rttMs !== undefined) {
      this.db.prepare('UPDATE messages SET status = ?, rttMs = ? WHERE id = ?')
        .run(status, rttMs, id);
    } else if (attempts !== undefined) {
      this.db.prepare('UPDATE messages SET status = ?, attempts = ? WHERE id = ?')
        .run(status, attempts, id);
    } else {
      this.db.prepare('UPDATE messages SET status = ? WHERE id = ?')
        .run(status, id);
    }
  }

  public addReaction(msgId: string, emoji: string, userName: string) {
    const msg = this.db.prepare('SELECT reactionsJson FROM messages WHERE id = ?').get(msgId) as any;
    if (msg) {
      const reactions = msg.reactionsJson ? JSON.parse(msg.reactionsJson) : {};
      const userList = reactions[emoji] || [];
      if (!userList.includes(userName)) {
        reactions[emoji] = [...userList, userName];
      }
      this.db.prepare('UPDATE messages SET reactionsJson = ? WHERE id = ?')
        .run(JSON.stringify(reactions), msgId);
    }
  }
}
