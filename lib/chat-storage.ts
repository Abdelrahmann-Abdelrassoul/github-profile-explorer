/**
 * Per-repo chat persistence in localStorage.
 *
 * docs/spec.md commits to client-side persistence keyed by `username/repo`, with no
 * backend. This module is the only place that touches localStorage, so the defensive
 * handling lives in one file rather than being repeated at each call site.
 *
 * Nothing here may be called during render — see `loadChat`.
 */

export type StoredMessage = { id: string; role: "user" | "assistant"; content: string };

export type StoredChat = {
  messages: StoredMessage[];
  /** Questions already asked, so suggestions do not repeat after a reload. */
  asked: string[];
  /** The last set of follow-ups, so returning costs no extra model call. */
  suggestions: string[];
};

const EMPTY: StoredChat = { messages: [], asked: [], suggestions: [] };

/**
 * Namespaced so task 7's notes, keyed by username alone, cannot collide with a repo chat
 * belonging to a user of the same name.
 */
function key(username: string, repo: string): string {
  return `gpe:chat:${username.toLowerCase()}/${repo.toLowerCase()}`;
}

/**
 * A conversation is capped rather than allowed to grow forever: localStorage is roughly
 * 5 MB for the whole origin and every repo adds a key. The server only sends the last 20
 * messages to the model anyway, so keeping more than this buys nothing.
 */
const MAX_STORED_MESSAGES = 40;

/**
 * Reading localStorage can throw outright, not just fail — hardened browser settings and
 * some private modes reject access to the property itself. Every entry point goes through
 * these two helpers so a storage-less browser degrades to an in-memory session instead of
 * breaking the chat.
 */
function readRaw(storageKey: string): string | null {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeRaw(storageKey: string, value: string): boolean {
  try {
    window.localStorage.setItem(storageKey, value);
    return true;
  } catch {
    return false;
  }
}

function isMessage(value: unknown): value is StoredMessage {
  if (typeof value !== "object" || value === null) return false;
  const { id, role, content } = value as Record<string, unknown>;
  return (
    typeof id === "string" &&
    (role === "user" || role === "assistant") &&
    typeof content === "string"
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Read a stored conversation.
 *
 * Call this from an effect, never during render: localStorage does not exist on the
 * server, so seeding state from it would make the client's first paint disagree with the
 * server's HTML and trigger a hydration mismatch.
 *
 * Stored data is untrusted — it may be corrupt, hand-edited, or written by an older
 * version of this app — so it is shape-checked and discarded wholesale if it does not
 * match, rather than cast and allowed to crash the transcript.
 */
export function loadChat(username: string, repo: string): StoredChat {
  const raw = readRaw(key(username, repo));
  if (!raw) return EMPTY;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY;

    const { messages, asked, suggestions } = parsed as Record<string, unknown>;
    if (!Array.isArray(messages)) return EMPTY;

    return {
      messages: messages.filter(isMessage),
      asked: toStringArray(asked),
      suggestions: toStringArray(suggestions),
    };
  } catch {
    return EMPTY;
  }
}

/**
 * Persist a conversation, trimming to the newest messages.
 *
 * On a quota error the write is retried with a much shorter history before giving up:
 * losing the oldest turns is a better outcome than silently persisting nothing.
 */
export function saveChat(username: string, repo: string, chat: StoredChat): void {
  const storageKey = key(username, repo);

  const trimmed: StoredChat = {
    messages: chat.messages.slice(-MAX_STORED_MESSAGES),
    asked: chat.asked.slice(-MAX_STORED_MESSAGES),
    suggestions: chat.suggestions,
  };

  if (writeRaw(storageKey, JSON.stringify(trimmed))) return;

  const minimal: StoredChat = {
    messages: trimmed.messages.slice(-6),
    asked: trimmed.asked.slice(-6),
    suggestions: trimmed.suggestions,
  };
  writeRaw(storageKey, JSON.stringify(minimal));
}

export function clearChat(username: string, repo: string): void {
  try {
    window.localStorage.removeItem(key(username, repo));
  } catch {
    // Nothing to do — the in-memory reset still happens in the component.
  }
}
