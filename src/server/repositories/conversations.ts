import { db } from "../db";
import { generateId, nowIso } from "../utils";
import type { Conversation, ConversationMessage, MessageStatus } from "../../types/models";

export const DEFAULT_CONVERSATION_TITLE = "Nouvelle conversation";

export const conversationsRepository = {
  list: (uid: string): Conversation[] => {
    return db
      .prepare(
        `SELECT c.id, c.title, c.createdAt, c.updatedAt,
          (SELECT COUNT(*) FROM conversation_messages m WHERE m.uid = c.uid AND m.conversationId = c.id) AS messageCount
        FROM conversations c WHERE c.uid = ? ORDER BY c.updatedAt DESC`,
      )
      .all(uid) as Conversation[];
  },

  get: (uid: string, id: string): Conversation | null => {
    const conversation = db
      .prepare("SELECT id, title, createdAt, updatedAt FROM conversations WHERE uid = ? AND id = ?")
      .get(uid, id) as Conversation | undefined;
    if (!conversation) return null;
    return { ...conversation, messages: conversationsRepository.messages(uid, id) };
  },

  messages: (uid: string, conversationId: string): ConversationMessage[] => {
    return db
      .prepare(
        `SELECT id, role, content, status, model, createdAt FROM conversation_messages
        WHERE uid = ? AND conversationId = ? ORDER BY position`,
      )
      .all(uid, conversationId) as ConversationMessage[];
  },

  create: (uid: string, title = DEFAULT_CONVERSATION_TITLE) => {
    const id = generateId();
    const now = nowIso();
    db.prepare("INSERT INTO conversations (id, uid, title, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)").run(
      id,
      uid,
      title,
      now,
      now,
    );
    return conversationsRepository.get(uid, id)!;
  },

  rename: (uid: string, id: string, title: string) => {
    const result = db
      .prepare("UPDATE conversations SET title = ?, updatedAt = ? WHERE uid = ? AND id = ?")
      .run(title, nowIso(), uid, id);
    return result.changes > 0;
  },

  delete: (uid: string, id: string) => {
    db.prepare("DELETE FROM conversations WHERE uid = ? AND id = ?").run(uid, id);
  },

  addMessage: (
    uid: string,
    conversationId: string,
    message: { id?: string; role: "user" | "assistant"; content: string; status: MessageStatus; model?: string | null },
  ) => {
    return db
      .transaction(() => {
        const id = message.id || generateId();
        const { next } = db
          .prepare(
            "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM conversation_messages WHERE uid = ? AND conversationId = ?",
          )
          .get(uid, conversationId) as { next: number };
        const now = nowIso();
        db.prepare(
          `INSERT INTO conversation_messages (id, uid, conversationId, position, role, content, status, model, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(id, uid, conversationId, next, message.role, message.content, message.status, message.model ?? null, now);
        db.prepare("UPDATE conversations SET updatedAt = ? WHERE uid = ? AND id = ?").run(now, uid, conversationId);
        return {
          id,
          role: message.role,
          content: message.content,
          status: message.status,
          model: message.model ?? null,
          createdAt: now,
        };
      })
      .immediate();
  },

  hasMessage: (uid: string, id: string) =>
    !!db.prepare("SELECT 1 FROM conversation_messages WHERE uid = ? AND id = ?").get(uid, id),

  deleteMessage: (uid: string, id: string) => {
    db.prepare("DELETE FROM conversation_messages WHERE uid = ? AND id = ?").run(uid, id);
  },
};
