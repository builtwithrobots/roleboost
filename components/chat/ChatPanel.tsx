'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import type { ChatTurn } from '@/lib/types';

interface Props {
  candidateSlug: string;
  candidateName: string;
  /** 'live' = public recruiter view. 'preview' = candidate testing their own AI. */
  mode?: 'live' | 'preview';
  /** Fired after each assistant answer with the question + answer (sandbox analysis). */
  onExchange?: (question: string, answer: string) => void;
  /** Push a question in from outside (e.g. a sandbox library chip). Bump nonce to resend. */
  externalQuestion?: { text: string; nonce: number };
  /** One-tap opener chips shown in the empty state (calling-card hero). */
  suggestedQuestions?: string[];
  /** Focus the input on mount (used inside the chat overlay). */
  autoFocus?: boolean;
  /** Fill the parent height and drop the card chrome (used inside the overlay). */
  fill?: boolean;
  /** Render a close button in the header (used inside the overlay). */
  onClose?: () => void;
}

const HISTORY_LIMIT = 20;

export default function ChatPanel({
  candidateSlug,
  candidateName,
  mode = 'live',
  onExchange,
  externalQuestion,
  suggestedQuestions,
  autoFocus,
  fill,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const inputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  const firstName = candidateName.split(' ')[0] || candidateName;

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // A sandbox library chip can push a question in; the bumped nonce resends it.
  useEffect(() => {
    if (externalQuestion?.text) void send(externalQuestion.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion?.nonce]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Deliver the transcript when a live conversation closes (the panel unmounts).
  // Sandbox/preview turns never created a deliverable session, so skip them.
  useEffect(() => {
    return () => {
      if (mode === 'live' && sessionIdRef.current && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify({ sessionId: sessionIdRef.current })], {
            type: 'application/json',
          });
          navigator.sendBeacon('/api/transcripts/deliver', blob);
        } catch {
          // best-effort; a missed beacon just means no transcript this time
        }
      }
    };
  }, [mode]);

  async function send(explicitMessage?: string) {
    const trimmed = (explicitMessage ?? input).trim();
    if (!trimmed || loading) return;

    const history = messages.slice(-HISTORY_LIMIT);
    setMessages((m) => [...m, { role: 'user', content: trimmed }]);
    if (explicitMessage === undefined) setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSlug,
          message: trimmed,
          sessionId: sessionId ?? undefined,
          conversationHistory: history,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Request failed');
      }

      if (data.sessionId) setSessionId(data.sessionId);
      const assistantAnswer = data.answer as string;
      setMessages((m) => [...m, { role: 'assistant', content: assistantAnswer }]);
      onExchange?.(trimmed, assistantAnswer);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            'Something went wrong reaching the AI just now. Please try sending that again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  return (
    <div
      className={
        fill
          ? 'flex h-full flex-col overflow-hidden bg-[var(--rb-bg-surface)]'
          : 'rb-card flex flex-col overflow-hidden'
      }
      style={fill ? undefined : { height: 'min(70vh, 560px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--rb-border)] px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand)] text-white">
          <Sparkles className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--rb-text)]">
            {mode === 'preview'
              ? 'This is how your AI responds to recruiters'
              : `Ask ${firstName}'s career AI anything`}
          </p>
          {mode === 'preview' ? (
            <p className="text-xs text-[var(--rb-text-muted)]">Private test, nothing is sent.</p>
          ) : (
            <p className="text-xs text-[var(--rb-text-muted)]">Honest by design · you both get the transcript</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close conversation"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${candidateName}'s career AI`}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-xs text-sm text-[var(--rb-text-muted)]">
              {mode === 'preview'
                ? `Try a hard recruiter question and see how ${firstName}'s AI answers.`
                : `Ask about ${firstName}'s experience, decisions, and what they're looking for next.`}
            </p>
            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-xs text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-[var(--rb-brand)] text-white'
                  : 'bg-[var(--rb-bg-page)] text-[var(--rb-text-secondary)] border border-[var(--rb-border)]'
              }`}
            >
              <span className="sr-only">
                {m.role === 'user' ? 'You said: ' : `${firstName}'s AI said: `}
              </span>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start" aria-hidden="true">
            <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-page)] px-3.5 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)] [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)] [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-[var(--rb-border)] p-3"
      >
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            Ask {candidateName}&apos;s career AI a question
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Ask ${firstName} anything about their career`}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2.5 text-sm text-[var(--rb-text)] outline-none placeholder:text-[var(--rb-text-muted)] focus-visible:border-[var(--rb-brand)] focus-visible:ring-2 focus-visible:ring-[var(--rb-brand)]/30"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--rb-brand)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--rb-text-muted)]">
          Powered by RoleBoost AI. This AI represents {firstName}&apos;s career history and may not
          reflect every detail.
        </p>
      </form>
    </div>
  );
}
