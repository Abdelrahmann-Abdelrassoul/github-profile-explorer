"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Multi-turn chat about one repository.
 *
 * Plain fetch with a stream reader, matching the profile summary, so the codebase has one
 * way of streaming rather than two. The client posts only the repo coordinates and the
 * conversation; grounding is assembled server-side.
 *
 * History lives in component state for now — task 6 persists it to localStorage.
 */

type Message = { id: string; role: "user" | "assistant"; content: string };

/** Shown before the first question; afterwards the model proposes follow-ups. */
const OPENING_SUGGESTIONS = [
  "What does this project do?",
  "How is the code organised?",
  "What changed recently?",
];

export function RepoChat({ username, repo }: { username: string; repo: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(OPENING_SUGGESTIONS);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  /** Every question asked, so the model is told not to repeat itself. */
  const askedRef = useRef<string[]>([]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming, suggestions]);

  /** Follow-ups depend on what was just answered, so this runs after each reply. */
  const refreshSuggestions = useCallback(
    async (history: Message[]) => {
      setLoadingSuggestions(true);
      try {
        const response = await fetch("/api/chat/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            repo,
            messages: history.map(({ role, content }) => ({ role, content })),
            asked: askedRef.current,
          }),
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        const questions =
          typeof data === "object" && data !== null && Array.isArray((data as { questions?: unknown }).questions)
            ? ((data as { questions: unknown[] }).questions.filter(
                (q): q is string => typeof q === "string",
              ))
            : [];
        // Suggestions are optional; leaving the previous set would repeat them, so clear.
        setSuggestions(questions);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [username, repo],
  );

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;

    askedRef.current = [...askedRef.current, question];

    const history: Message[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: question },
    ];
    const replyId = crypto.randomUUID();

    setMessages([...history, { id: replyId, role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setSuggestions([]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let reply = "";

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          repo,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        setError((await response.text()) || "The reply could not be generated.");
        setMessages(history);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        const current = reply;
        setMessages((existing) =>
          existing.map((message) =>
            message.id === replyId ? { ...message, content: current } : message,
          ),
        );
      }

      void refreshSuggestions([...history, { id: replyId, role: "assistant", content: reply }]);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        // Keep whatever streamed before the user stopped it.
        setMessages((existing) => existing.filter((m) => m.id !== replyId || m.content));
        return;
      }
      setError("Could not reach the server. Check your connection and try again.");
      setMessages(history);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  const showSuggestions = !streaming && suggestions.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto" aria-live="polite">
        {messages.length === 0 && (
          <p className="text-sm leading-relaxed text-muted-foreground">
            Ask about this repository. Answers come from its README, top-level files and
            recent commits — not from the model&rsquo;s own recollection.
          </p>
        )}

        {messages.map((message) => (
          <Turn key={message.id} message={message} streaming={streaming} />
        ))}

        {loadingSuggestions && (
          <p className="font-mono text-xs text-muted-foreground">
            Thinking of follow-ups...
          </p>
        )}

        {showSuggestions && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-auto whitespace-normal py-1.5 text-left font-normal"
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="text-sm leading-relaxed text-muted-foreground">
          {error}
        </p>
      )}

      <form
        className="flex gap-2 border-t border-border pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask about {username}/{repo}
        </label>
        <Input
          id="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about this repository"
          autoComplete="off"
          disabled={streaming}
          className="h-10 flex-1"
        />
        {streaming ? (
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => abortRef.current?.abort()}
          >
            <Square aria-hidden className="size-3.5" />
            Stop
          </Button>
        ) : (
          <Button type="submit" className="h-10" disabled={!input.trim()}>
            <ArrowUp aria-hidden className="size-4" />
            Send
          </Button>
        )}
      </form>
    </div>
  );
}

/**
 * A question keeps the compact bubble; an answer reads as prose, like the profile summary.
 *
 * Replies are often several paragraphs, and a pre-wrapped bubble made them look blocky.
 * Splitting on blank lines and rendering real paragraphs keeps the structure the model
 * intended without pulling in a markdown renderer.
 */
function Turn({ message, streaming }: { message: Message; streaming: boolean }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] rounded-lg bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground">
          <span className="sr-only">You asked: </span>
          {message.content}
        </p>
      </div>
    );
  }

  const pending = streaming && !message.content;
  const paragraphs = message.content.split(/\n{2,}/).filter((block) => block.trim());

  return (
    <div className="text-sm leading-relaxed text-foreground">
      <span className="sr-only">Answer: </span>
      {pending ? (
        <p className="text-muted-foreground">Reading the repository...</p>
      ) : (
        paragraphs.map((block, index) => (
          <p key={index} className={cn(index > 0 && "mt-3")}>
            {block.split("\n").map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                {line}
              </span>
            ))}
            {index === paragraphs.length - 1 && streaming && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary"
              />
            )}
          </p>
        ))
      )}
    </div>
  );
}
