"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  deleteNote,
  loadNote,
  saveNote,
  type NoteSubject,
} from "@/lib/notes-storage";
import { cn } from "@/lib/utils";

/**
 * A note about a profile or a repository.
 *
 * Autosaves rather than asking for a Save press: a note that vanishes because someone
 * navigated away is precisely the failure this feature exists to prevent. Debounced so a
 * pause writes once instead of every keystroke writing.
 */

/** Long enough to finish a thought, short enough to feel responsive. */
const SAVE_DELAY_MS = 800;

type Status = "idle" | "saving" | "saved";

export function NotesPanel({
  subject,
  label,
  defaultOpen = true,
}: {
  subject: NoteSubject;
  /** What the note is about, for the heading and the textarea's accessible name. */
  label: string;
  /**
   * Whether the note starts expanded. Collapsed on the chat page, whose height is fixed so
   * that only the transcript scrolls — a textarea that is usually idle should not take that
   * space from the conversation. A marker shows when a note exists either way, so a
   * collapsed panel is never mistaken for an empty one.
   */
  defaultOpen?: boolean;
}) {
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(defaultOpen);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Stops the restore from immediately scheduling a save of what was just read. */
  const restoredRef = useRef(false);

  const key = JSON.stringify(subject);

  /*
   * Restore after mount, never during render: localStorage does not exist on the server,
   * so seeding state from it would make the first client paint disagree with the
   * server-rendered HTML.
   */
  useEffect(() => {
    restoredRef.current = false;
    const stored = loadNote(subject);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBody(stored);
    setStatus("idle");
    restoredRef.current = true;
    // `key` is the serialised subject; the object identity changes every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Debounced write. Cleanup cancels the pending save, so unmounting mid-type does not
  // fire a write against a subject the reader has already navigated away from.
  useEffect(() => {
    if (!restoredRef.current) return;

    setStatus("saving");
    timerRef.current = setTimeout(() => {
      saveNote(subject, body);
      setStatus("saved");
    }, SAVE_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, key]);

  function handleDelete() {
    if (timerRef.current) clearTimeout(timerRef.current);
    deleteNote(subject);
    setBody("");
    setStatus("idle");
  }

  const hasNote = body.trim().length > 0;

  return (
    <section
      aria-labelledby="notes-heading"
      className="shrink-0 rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="notes-heading" className="font-heading text-sm font-semibold">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            aria-controls="notes-body"
            className="flex items-center gap-1.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {/* The arrow is the affordance; it points down when open, right when closed. */}
            <ChevronDown
              aria-hidden
              className={cn(
                "size-4 text-muted-foreground transition-transform",
                !open && "-rotate-90",
              )}
            />
            Your notes
            {/* Without this a saved note is invisible while collapsed. */}
            {hasNote && !open && (
              <span className="font-mono text-xs font-normal text-muted-foreground">
                1 saved
              </span>
            )}
            <span className="sr-only">{open ? " (collapse)" : " (expand)"}</span>
          </button>
        </h2>

        <div className="flex items-center gap-3">
          {/* Announced politely so a screen reader is not interrupted mid-sentence. */}
          <span aria-live="polite" className="font-mono text-xs text-muted-foreground">
            {status === "saving" && body ? "Saving..." : status === "saved" ? "Saved" : ""}
          </span>
          {open && hasNote && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={handleDelete}
            >
              <Trash2 aria-hidden className="size-3.5" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {open && (
        <div id="notes-body">
          <p className="mt-1 text-xs text-muted-foreground">
            Kept in this browser and shown on the home page. Saves as you type.
          </p>

          <label htmlFor="note-body" className="sr-only">
            Notes about {label}
          </label>
          <textarea
            id="note-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder={`Anything worth remembering about ${label}...`}
            className="mt-3 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </div>
      )}
    </section>
  );
}
