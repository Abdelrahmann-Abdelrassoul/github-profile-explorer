/**
 * Notes on profiles and repositories, in localStorage.
 *
 * The feature's requirement is that notes are *shown once a user accesses the application*,
 * not merely stored — hence `listNotes`, which is what lets the landing page surface them.
 * With client-only persistence a note is otherwise invisible unless the reader remembers
 * which profile they wrote it on.
 *
 * Follows lib/chat-storage.ts: one module owns localStorage, nothing here runs during
 * render, access is wrapped because it can throw outright, and stored values are treated
 * as untrusted.
 */

export type NoteSubject =
  | { kind: "user"; login: string }
  | { kind: "repo"; owner: string; repo: string };

export type Note = {
  subject: NoteSubject;
  body: string;
  /** Epoch ms, so the landing page can order by most recently touched. */
  updatedAt: number;
};

const PREFIX = "gpe:note:";

/** Long enough for real notes, short enough that one cannot swallow the origin's quota. */
const MAX_BODY_CHARS = 5_000;

function keyFor(subject: NoteSubject): string {
  return subject.kind === "user"
    ? `${PREFIX}user:${subject.login.toLowerCase()}`
    : `${PREFIX}repo:${subject.owner.toLowerCase()}/${subject.repo.toLowerCase()}`;
}

/** Rebuild the subject from a key, so the landing page can link without a second store. */
function subjectFromKey(key: string): NoteSubject | null {
  const rest = key.slice(PREFIX.length);

  if (rest.startsWith("user:")) {
    const login = rest.slice("user:".length);
    return login ? { kind: "user", login } : null;
  }

  if (rest.startsWith("repo:")) {
    const path = rest.slice("repo:".length);
    const slash = path.indexOf("/");
    if (slash <= 0 || slash === path.length - 1) return null;
    return { kind: "repo", owner: path.slice(0, slash), repo: path.slice(slash + 1) };
  }

  return null;
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeRaw(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to do; the in-memory reset still happens in the component.
  }
}

/** Stored values may be corrupt, hand-edited, or written by an older build. */
function parseNote(raw: string, subject: NoteSubject): Note | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const { body, updatedAt } = parsed as Record<string, unknown>;
    if (typeof body !== "string" || !body.trim()) return null;

    return {
      subject,
      body,
      updatedAt: typeof updatedAt === "number" && Number.isFinite(updatedAt) ? updatedAt : 0,
    };
  } catch {
    return null;
  }
}

/** Call from an effect, never during render — localStorage does not exist on the server. */
export function loadNote(subject: NoteSubject): string {
  const raw = readRaw(keyFor(subject));
  if (!raw) return "";
  return parseNote(raw, subject)?.body ?? "";
}

/**
 * Save, or delete when the note is emptied.
 *
 * Storing `""` would leave a blank entry on the landing page forever, so clearing the text
 * is how a note is removed — the delete control and an emptied textarea do the same thing.
 */
export function saveNote(subject: NoteSubject, body: string): void {
  const key = keyFor(subject);
  const trimmed = body.slice(0, MAX_BODY_CHARS);

  if (!trimmed.trim()) {
    removeRaw(key);
    return;
  }

  writeRaw(key, JSON.stringify({ body: trimmed, updatedAt: Date.now() }));
}

export function deleteNote(subject: NoteSubject): void {
  removeRaw(keyFor(subject));
}

/**
 * Every saved note, newest first.
 *
 * Walks the origin's keys, which will include entries from the chat and potentially from
 * unrelated apps sharing localhost during development. Anything that is not a well-formed
 * note is skipped rather than thrown on.
 */
export function listNotes(): Note[] {
  let keys: string[];
  try {
    keys = Object.keys(window.localStorage);
  } catch {
    return [];
  }

  const notes: Note[] = [];
  for (const key of keys) {
    if (!key.startsWith(PREFIX)) continue;

    const subject = subjectFromKey(key);
    if (!subject) continue;

    const raw = readRaw(key);
    if (!raw) continue;

    const note = parseNote(raw, subject);
    if (note) notes.push(note);
  }

  return notes.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Where a note's subject lives in the app. */
export function subjectHref(subject: NoteSubject): string {
  return subject.kind === "user"
    ? `/u/${encodeURIComponent(subject.login)}`
    : `/u/${encodeURIComponent(subject.owner)}/${encodeURIComponent(subject.repo)}/chat`;
}

export function subjectLabel(subject: NoteSubject): string {
  return subject.kind === "user"
    ? subject.login
    : `${subject.owner}/${subject.repo}`;
}
