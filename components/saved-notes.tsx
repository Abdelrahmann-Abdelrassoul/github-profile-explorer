"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookText, MessageSquare, User } from "lucide-react";

import {
  listNotes,
  subjectHref,
  subjectLabel,
  type Note,
} from "@/lib/notes-storage";

/**
 * Saved notes, on the landing page.
 *
 * This is what makes the feature's requirement true — notes shown once the application is
 * accessed. Without it, client-only persistence means a note is unreachable unless the
 * reader remembers which profile they wrote it on.
 *
 * Renders nothing until notes exist, so a first visit is not greeted by an empty heading.
 */

/** One line is enough to recognise a note; the rest is on its own page. */
const PREVIEW_CHARS = 120;

export function SavedNotes() {
  const [notes, setNotes] = useState<Note[] | null>(null);

  // After mount: localStorage does not exist on the server, and seeding from it during
  // render would make the first client paint disagree with the server's HTML.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotes(listNotes());
  }, []);

  // null = not read yet, [] = read and genuinely empty. Both render nothing, but only the
  // second is a real answer.
  if (!notes || notes.length === 0) return null;

  return (
    <section aria-labelledby="saved-notes-heading" className="space-y-3">
      <h2
        id="saved-notes-heading"
        className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Your notes
      </h2>

      <ul className="space-y-2">
        {notes.map((note) => (
          <li key={subjectHref(note.subject)}>
            <Link
              href={subjectHref(note.subject)}
              className="flex gap-3 rounded-lg border border-border bg-card p-3 outline-none transition-colors hover:border-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden className="mt-0.5 text-muted-foreground">
                {note.subject.kind === "user" ? (
                  <User className="size-4" />
                ) : (
                  <MessageSquare className="size-4" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-xs text-muted-foreground">
                  {note.subject.kind === "user" ? "profile" : "repository"} ·{" "}
                  {subjectLabel(note.subject)}
                </span>
                <span className="mt-0.5 block truncate text-sm text-foreground">
                  {note.body.slice(0, PREVIEW_CHARS)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
        <BookText aria-hidden className="size-3.5" />
        Saved in this browser only
      </p>
    </section>
  );
}
