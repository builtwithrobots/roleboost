'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { Send, Sparkles } from 'lucide-react';
import type { ChatTurn } from '@/lib/types';

interface Props {
  candidateSlug: string;
  candidateName: string;
  /** 'live' = public recruiter view. 'preview' = candidate testing their own AI. */
  mode?: 'live' | 'preview';
}

const HISTORY_LIMIT = 20;

export default function ChatPanel({ candidateSlug, candidateName, mode = 'live' }: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const inputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const firstName = candidateName.split(' ')[0] || candidateName;

  // Keep the latest message in view as the conversation grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const history = messages.slice(-HISTORY_LIMIT);
    setMessages((m) => [...m, { role: 'user', content: trimmed }]);
    setInput('');
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
      setMessages((m) => [...m, { role: 'assistant', content: data.answer as string }]);
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
      className="rb-card flex flex-col overflow-hidden"
      style={{ height: 'min(70vh, 560px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--rb-border)] px-4 py-3">
        <span className="flex size-7 items-center justify-center rounded-full bg-[var(--rb-brand)] text-white">
          <Sparkles className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--rb-text)]">
            {mode === 'preview'
              ? 'This is how your AI responds to recruiters'
              : `Ask ${firstName}'s career AI anything`}
          </p>
          {mode === 'preview' && (
            <p className="text-xs text-[var(--rb-text-muted)]">Private test — nothing is sent.</p>
          )}
        </div>
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
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="max-w-xs text-sm text-[var(--rb-text-muted)]">
              {mode === 'preview'
                ? `Try a hard recruiter question and see how ${firstName}'s AI answers.`
                : `Ask about ${firstName}'s experience, decisions, and what they're looking for next.`}
            </p>
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
