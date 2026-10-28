import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import {
  AlertTriangle,
  Bot,
  Check,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Square,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { api } from "../../services/api";
import { AiRequestError, sendChatMessage } from "../../services/ai";
import { useToast } from "../ui/Toast";
import type { Conversation, ConversationMessage } from "../../types/models";

const SUGGESTIONS = [
  "Aide-moi à formuler mon bilan de la semaine",
  "Quelles compétences ai-je le plus mobilisées ?",
  "Comment présenter mon projet principal en 2 minutes ?",
  "Quels points faibles dois-je anticiper pour la soutenance ?",
];

function Bubble({
  role,
  content,
  status,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  status?: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isUser ? "bg-stone-200 dark:bg-stone-700" : "bg-emerald-100 dark:bg-emerald-900/40"}`}
      >
        {isUser ? (
          <UserIcon className="h-4 w-4 text-stone-500 dark:text-stone-300" aria-label="Toi" />
        ) : (
          <Bot className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-label="Assistant" />
        )}
      </div>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${isUser ? "bg-emerald-600 text-white" : "border border-stone-200 bg-white text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-200"}`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="prose prose-sm prose-stone dark:prose-invert max-w-none">
            <Markdown>{content || (streaming ? "…" : "")}</Markdown>
          </div>
        )}
        {status === "interrupted" && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Réponse interrompue — texte incomplet
          </p>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [active, setActive] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<{ user: string | null; reply: string } | null>(null);
  const [error, setError] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const controller = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async () => {
    try {
      const list = await api.conversations.list();
      setConversations(list);
      return list;
    } catch {
      setConversations([]);
      return [];
    }
  }, []);

  const openConversation = useCallback(
    async (id: string) => {
      try {
        setActive(await api.conversations.get(id));
        setError("");
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Impossible d'ouvrir la conversation.", "error");
      }
    },
    [toast],
  );

  useEffect(() => {
    void loadList().then((list) => {
      if (list[0]) void openConversation(list[0].id);
    });
    return () => controller.current?.abort();
  }, [loadList, openConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active?.messages?.length, streaming?.reply]);

  const run = async (
    conversation: Conversation,
    message: { content: string; clientMessageId: string } | { retry: true },
  ) => {
    const current = new AbortController();
    controller.current = current;
    setError("");
    setStreaming({ user: "content" in message ? message.content : null, reply: "" });
    try {
      await sendChatMessage(conversation.id, message, {
        signal: current.signal,
        onText: (reply) => setStreaming((previous) => (previous ? { ...previous, reply } : previous)),
      });
    } catch (cause) {
      if (cause instanceof AiRequestError && cause.cancelled)
        setError("Réponse arrêtée. Le texte reçu a été conservé.");
      else setError(cause instanceof Error ? cause.message : "L'assistant n'a pas pu répondre.");
    } finally {
      setStreaming(null);
      // The server stored what happened; show exactly that.
      await openConversation(conversation.id);
      void loadList();
    }
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || streaming) return;
    let conversation = active;
    if (!conversation) {
      try {
        conversation = await api.conversations.create();
        setActive({ ...conversation, messages: [] });
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : "Impossible de créer la conversation.", "error");
        return;
      }
    }
    setInput("");
    await run(conversation, { content, clientMessageId: crypto.randomUUID() });
  };

  const create = async () => {
    try {
      const conversation = await api.conversations.create();
      setActive({ ...conversation, messages: [] });
      await loadList();
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Impossible de créer la conversation.", "error");
    }
  };

  const rename = async (id: string) => {
    if (!title.trim()) return;
    try {
      await api.conversations.rename(id, title.trim());
      setRenaming(null);
      await loadList();
      if (active?.id === id) setActive({ ...active, title: title.trim() });
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "Le renommage a échoué.", "error");
    }
  };

  const remove = async (conversation: Conversation) => {
    if (!window.confirm(`Supprimer la conversation « ${conversation.title} » ?`)) return;
    try {
      await api.conversations.delete(conversation.id);
      const list = await loadList();
      if (active?.id === conversation.id) {
        setActive(null);
        if (list[0]) void openConversation(list[0].id);
      }
    } catch (cause) {
      toast(cause instanceof Error ? cause.message : "La suppression a échoué.", "error");
    }
  };

  const messages: ConversationMessage[] = active?.messages ?? [];
  const last = messages.at(-1);
  const canRetry = !streaming && !!last && (last.role === "user" || last.status === "interrupted");

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr]">
      <aside aria-label="Conversations" className="space-y-2">
        <button
          type="button"
          onClick={() => void create()}
          disabled={!!streaming}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden /> Nouvelle conversation
        </button>
        {conversations === null && <p className="p-2 text-sm text-stone-400">Chargement…</p>}
        <ul className="max-h-72 space-y-1 overflow-y-auto lg:max-h-[60vh]">
          {conversations?.map((conversation) => (
            <li
              key={conversation.id}
              className={`group rounded-xl ${active?.id === conversation.id ? "bg-emerald-50 dark:bg-emerald-900/30" : "hover:bg-stone-100 dark:hover:bg-stone-800"}`}
            >
              {renaming === conversation.id ? (
                <div className="flex items-center gap-1 p-1">
                  <label htmlFor={`rename-${conversation.id}`} className="sr-only">
                    Nouveau titre
                  </label>
                  <input
                    id={`rename-${conversation.id}`}
                    autoFocus
                    className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white p-1.5 text-sm dark:border-stone-700 dark:bg-stone-900 dark:text-white"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void rename(conversation.id);
                      if (event.key === "Escape") setRenaming(null);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void rename(conversation.id)}
                    aria-label="Valider le titre"
                    className="rounded p-1 text-emerald-600"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 p-1">
                  <button
                    type="button"
                    disabled={!!streaming}
                    onClick={() => void openConversation(conversation.id)}
                    aria-current={active?.id === conversation.id ? "true" : undefined}
                    className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm text-stone-700 dark:text-stone-300"
                  >
                    {conversation.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRenaming(conversation.id);
                      setTitle(conversation.title);
                    }}
                    aria-label={`Renommer ${conversation.title}`}
                    className="rounded p-1 text-stone-400 hover:text-emerald-600"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    disabled={!!streaming}
                    onClick={() => void remove(conversation)}
                    aria-label={`Supprimer ${conversation.title}`}
                    className="rounded p-1 text-stone-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        <div className="min-h-[200px] space-y-4" aria-live="polite">
          {messages.length === 0 && !streaming && (
            <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm dark:border-stone-800 dark:bg-stone-900">
              <p className="mb-4 font-medium text-stone-600 dark:text-stone-300">Quelques idées pour commencer :</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-left text-sm text-stone-600 hover:border-emerald-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => (
            <Bubble key={message.id} role={message.role} content={message.content} status={message.status} />
          ))}
          {streaming?.user && <Bubble role="user" content={streaming.user} />}
          {streaming && <Bubble role="assistant" content={streaming.reply} streaming />}
          {canRetry && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
              <span className="flex-1">
                {last?.role === "user" ? "Ce message n'a pas reçu de réponse." : "La dernière réponse est incomplète."}
              </span>
              <button
                type="button"
                onClick={() => active && void run(active, { retry: true })}
                className="flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 font-medium text-white"
              >
                <RefreshCw className="h-4 w-4" aria-hidden /> Relancer la réponse
              </button>
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300"
            >
              {error}
            </p>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="sticky bottom-0 flex gap-3 bg-stone-50 py-2 dark:bg-stone-950">
          <label htmlFor="chat-input" className="sr-only">
            Message à l'assistant
          </label>
          <textarea
            id="chat-input"
            rows={1}
            className="flex-1 resize-none rounded-2xl border border-stone-200 bg-white p-4 outline-none focus:ring-2 focus:ring-emerald-500 dark:border-stone-800 dark:bg-stone-900 dark:text-white"
            placeholder="Écris ton message… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            disabled={!!streaming}
          />
          {streaming ? (
            <button
              type="button"
              onClick={() => controller.current?.abort()}
              aria-label="Arrêter la réponse"
              className="flex items-center rounded-2xl bg-stone-700 px-5 text-white"
            >
              <Square className="h-5 w-5" aria-hidden />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim()}
              aria-label="Envoyer le message"
              className="flex items-center rounded-2xl bg-emerald-600 px-5 text-white disabled:opacity-50 dark:bg-emerald-500"
            >
              {streaming ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Send className="h-5 w-5" aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
