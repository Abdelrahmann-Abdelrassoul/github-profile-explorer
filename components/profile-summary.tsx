"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Streaming AI summary of a profile.
 *
 * Uses plain fetch plus a stream reader rather than the SDK's React hooks: this is a
 * one-shot completion, so the hook package would be a third dependency for one button.
 *
 * Only the username is sent — the route re-fetches the profile server-side, so the
 * browser cannot influence what gets summarised.
 */

type Status = "idle" | "streaming" | "done" | "error";

export function ProfileSummary({ username }: { username: string }) {
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Navigating away mid-stream should not leave the request running.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function generate() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setSummary("");
    setError(null);
    setStatus("streaming");

    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        // The route sends a plain-text, human-readable reason.
        setError((await response.text()) || "The summary could not be generated.");
        setStatus("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setSummary((current) => current + decoder.decode(value, { stream: true }));
      }

      setStatus("done");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Could not reach the server. Check your connection and try again.");
      setStatus("error");
    }
  }

  const streaming = status === "streaming";

  return (
    <section
      aria-labelledby="summary-heading"
      className="rounded-lg border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="summary-heading" className="font-heading text-sm font-semibold">
            AI summary
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A short read on this developer&rsquo;s languages, activity and notable work.
          </p>
        </div>

        <Button size="sm" onClick={generate} disabled={streaming}>
          <Sparkles aria-hidden className="size-3.5" />
          {status === "idle" && "Summarize with AI"}
          {streaming && "Generating..."}
          {(status === "done" || status === "error") && "Regenerate"}
        </Button>
      </div>

      {(summary || streaming) && (
        <p
          aria-live="polite"
          aria-busy={streaming}
          className="mt-4 text-sm leading-relaxed text-foreground"
        >
          {summary}
          {streaming && (
            <span
              aria-hidden
              className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary"
            />
          )}
        </p>
      )}

      {status === "error" && error && (
        <p role="alert" className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {error}
        </p>
      )}
    </section>
  );
}
