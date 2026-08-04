"use client";

import { useEffect, useRef, useState } from "react";
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

const SUGGESTIONS = [
  "What does this project do?",
  "How is the code organised?",
  "What changed recently?",
];

export function RepoChat({ username, repo }: { username: string; repo: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, streaming]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || streaming) return;

    const history: Message[] = [
      ...messages,
      { id: crypto.randomUUID(), role: "user", content: question },
    ];
    const replyId = crypto.randomUUID();

    setMessages([...history, { id: replyId, role: "assistant", content: "" }]);
    setInput("");
    setError(null);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

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
        // Drop the empty assistant bubble so the transcript is not left with a gap.
        setMessages(history);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) =>
          current.map((message) =>
            message.id === replyId
              ? { ...message, content: message.content + chunk }
              : message,
          ),
        );
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") {
        // Keep whatever streamed before the user stopped it.
        setMessages((current) => current.filter((m) => m.id !== replyId || m.content));
        return;
      }
      setError("Could not reach the server. Check your connection and try again.");
      setMessages(history);
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Ask about this repository. Answers come from its README, top-level files and
              recent commits — not from the model&rsquo;s own recollection.
            </p>
            <ul className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <li key={suggestion}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="font-normal"
                    onClick={() => send(suggestion)}
                  >
                    {suggestion}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          messages.map((message) => (
            <Bubble key={message.id} message={message} streaming={streaming} />
          ))
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

function Bubble({ message, streaming }: { message: Message; streaming: boolean }) {
  const isUser = message.role === "user";
  const pending = !isUser && streaming && !message.content;

  return (
    <div className={cn("flex", isUser && "justify-end")}>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card text-foreground",
        )}
      >
        <span className="sr-only">{isUser ? "You said: " : "Assistant replied: "}</span>
        {pending ? (
          <span className="text-muted-foreground">Reading the repository...</span>
        ) : (
          <span className="whitespace-pre-wrap">{message.content}</span>
        )}
        {!isUser && streaming && message.content && (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-primary"
          />
        )}
      </div>
    </div>
  );
}
