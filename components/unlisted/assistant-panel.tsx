"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { FeeBreakdown, SamplePill } from "./fee-breakdown";
import { ArrowUp, Board, ChevronDown, Close, PencilSquare, Plus, Sparkle } from "./icons";
import { draftContactMessage } from "./sample-assistant";
import type { ComparisonApartment } from "./types";

export type ChatMessage = { id: string; role: "user" | "assistant"; text: string };

const QUICK_REPLIES = ["Lower rent", "Shorter walk"];

function ApartmentPicker({ apartments, value, onChange, label }: { apartments: ComparisonApartment[]; value: string; onChange: (id: string) => void; label: string }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[13rem] cursor-pointer appearance-none truncate rounded-md bg-chip py-1 pr-7 pl-2 text-[12px] font-medium text-ink focus-visible:outline-2 focus-visible:outline-clay"
      >
        {apartments.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2 text-ink-soft" />
    </label>
  );
}

function PanelCard({ title, pill, children }: { title: string; pill: string; children: ReactNode }) {
  return (
    <section className="rounded-[10px] border border-line bg-paper-raised p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-semibold text-ink">{title}</h3>
        <SamplePill>{pill}</SamplePill>
      </div>
      {children}
    </section>
  );
}

function ContactAdministrators({ apartments, focused, onFocusChange }: { apartments: ComparisonApartment[]; focused: ComparisonApartment; onFocusChange: (id: string) => void }) {
  const [mode, setMode] = useState<"draft" | "editing" | "review">("draft");
  const [edited, setEdited] = useState<{ id: string; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const messageId = useId();
  const message = edited?.id === focused.id ? edited.text : draftContactMessage(focused);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <PanelCard title="Contact administrators" pill="Review before send">
      <p className="mt-3 text-[14px] leading-[21px] text-ink">
        Want to confirm fees, lease terms, or housing details? Draft a message to property management and review it before sending.
      </p>
      <div className="mt-3">
        <ApartmentPicker
          apartments={apartments}
          value={focused.id}
          label="Apartment to contact"
          onChange={(id) => {
            onFocusChange(id);
            setMode("draft");
            setCopied(false);
          }}
        />
      </div>
      <div className="mt-2.5 rounded-lg border border-line bg-paper px-3 py-2.5">
        <label htmlFor={messageId} className="text-[12px] font-semibold text-ink">
          {mode === "review" ? "Review message" : "Draft message"}
        </label>
        {mode === "editing" ? (
          <textarea
            id={messageId}
            rows={5}
            value={message}
            onChange={(event) => setEdited({ id: focused.id, text: event.target.value })}
            className="mt-1.5 w-full resize-y rounded-md border border-line bg-paper-raised px-2 py-1.5 text-[12.5px] leading-[19px] text-ink focus:border-ink/40 focus:outline-none"
          />
        ) : (
          <p id={messageId} className="mt-1.5 text-[12.5px] leading-[19px] text-ink-soft">
            {message}
          </p>
        )}
        <p className="mt-2 flex justify-between gap-2 text-[11px] text-ink-soft">
          <span className="truncate">To: {focused.name} property management</span>
          <span className="shrink-0" aria-live="polite">
            {copied ? "Copied · not sent" : "Not sent"}
          </span>
        </p>
        {mode === "review" && (
          <p className="mt-2 rounded-md bg-clay-tint px-2.5 py-2 text-[11.5px] leading-snug text-clay-dark">
            Sending isn&rsquo;t connected yet. Copy the message and send it through the property&rsquo;s own contact form.
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {mode === "review" ? (
          <>
            <button type="button" onClick={() => setMode("editing")} className="h-[31px] rounded-full border border-line px-3.5 text-[12px] font-medium text-ink hover:border-ink/30">
              Back to edit
            </button>
            <button type="button" onClick={copy} className="h-[31px] rounded-full bg-clay px-3.5 text-[12px] font-semibold text-white hover:bg-clay-dark">
              Copy message
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMode(mode === "editing" ? "draft" : "editing")}
              aria-pressed={mode === "editing"}
              className="h-[31px] rounded-full border border-line px-3.5 text-[12px] font-medium text-ink hover:border-ink/30"
            >
              {mode === "editing" ? "Done editing" : "Edit message"}
            </button>
            <button type="button" onClick={() => setMode("review")} className="h-[31px] rounded-full bg-clay px-3.5 text-[12px] font-semibold text-white hover:bg-clay-dark">
              Review before send
            </button>
          </>
        )}
      </div>
    </PanelCard>
  );
}

type AssistantPanelProps = {
  apartments: ComparisonApartment[];
  intro: string;
  messages: ChatMessage[];
  pending: boolean;
  onSend: (text: string) => void;
  onNewConversation: () => void;
  onAddPlace: () => void;
  focusId: string | null;
  onFocusChange: (id: string) => void;
  /** Phones and tablets show the panel as a drawer. */
  open: boolean;
  onClose: () => void;
};

export function AssistantPanel({
  apartments,
  intro,
  messages,
  pending,
  onSend,
  onNewConversation,
  onAddPlace,
  focusId,
  onFocusChange,
  open,
  onClose,
}: AssistantPanelProps) {
  const [draft, setDraft] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const focused = apartments.find((a) => a.id === focusId) ?? apartments[0];

  useEffect(() => {
    if (messages.length === 0) return;
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    onSend(trimmed);
    setDraft("");
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={onClose} aria-hidden="true" />}
      <aside
        aria-label="Housing assistant"
        className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl bg-panel shadow-2xl transition-transform duration-300 lg:sticky lg:top-[70px] lg:z-auto lg:h-[calc(100dvh-70px)] lg:max-h-none lg:translate-y-0 lg:rounded-none lg:border-l lg:border-line lg:shadow-none ${
          open ? "translate-y-0" : "translate-y-full max-lg:invisible"
        }`}
      >
        <div className="flex items-start gap-3 border-b border-line px-6 pt-6 pb-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] leading-[1.3] text-ink">What are you looking for in your future home?</h2>
            <p className="mt-2 text-[11px] text-ink-soft">Tell me what matters. I&rsquo;ll build your board.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              setDraft("");
            }}
            aria-label="Start a new conversation"
            title="Start a new conversation"
            className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-soft hover:bg-chip hover:text-ink"
          >
            <PencilSquare size={18} />
          </button>
          <button type="button" onClick={onClose} className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md hover:bg-chip lg:hidden" aria-label="Close assistant">
            <Close size={18} />
          </button>
        </div>

        <div ref={threadRef} className="flex flex-1 flex-col gap-6 overflow-y-auto px-6 pt-6 pb-6">
          <div>
            <p className="flex items-center gap-2 text-[12px] tracking-[0.02em] text-clay-dark uppercase">
              <Sparkle size={15} className="text-clay" />
              Housing assistant
            </p>
            <p className="mt-2.5 text-[14px] leading-[21px] text-ink">{intro}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {QUICK_REPLIES.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  disabled={pending}
                  onClick={() => submit(reply)}
                  className="h-[31px] rounded-full border border-line bg-paper-raised px-3 text-[12px] text-ink hover:border-ink/30 disabled:opacity-50"
                >
                  {reply}
                </button>
              ))}
            </div>
          </div>

          {focused && (
            <PanelCard title="Extra housing costs" pill="Sample / unverified">
              <p className="mt-3 text-[14px] leading-[21px] text-ink">
                I pulled a few extra cost examples from the property information. Keep in mind that published, estimated, and unknown charges are not the
                same thing.
              </p>
              <div className="mt-3 mb-2.5">
                <ApartmentPicker apartments={apartments} value={focused.id} onChange={onFocusChange} label="Apartment to break down" />
              </div>
              <FeeBreakdown apartment={focused} title={null} />
            </PanelCard>
          )}

          {focused && <ContactAdministrators apartments={apartments} focused={focused} onFocusChange={onFocusChange} />}

          {messages.length > 0 && (
            <ol className="flex flex-col gap-3" aria-live="polite">
              {messages.map((message) => (
                <li
                  key={message.id}
                  className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-[13.5px] leading-[20px] ${
                    message.role === "user" ? "self-end rounded-br-sm bg-clay-tint text-clay-dark" : "self-start rounded-bl-sm border border-line bg-paper-raised text-ink"
                  }`}
                >
                  <span className="sr-only">{message.role === "user" ? "You: " : "Assistant: "}</span>
                  {message.text}
                </li>
              ))}
              {pending && <li className="self-start rounded-xl border border-line bg-paper-raised px-3.5 py-2.5 text-[13px] text-ink-soft">Looking at your board…</li>}
            </ol>
          )}
        </div>

        <form
          className="px-5 pt-2 pb-3"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <p className="mb-2.5 flex items-center gap-2 text-[11px] text-sage-ink">
            <Board size={14} />
            Connected to Fall 2027 shortlist
          </p>
          <div className="rounded-lg border border-line bg-paper-raised px-3 pt-2.5 pb-2 focus-within:border-ink/30">
            <label htmlFor={inputId} className="sr-only">
              Ask a question or add another place
            </label>
            <textarea
              id={inputId}
              rows={2}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit(draft);
                }
              }}
              placeholder="Ask a question or add another place..."
              className="w-full resize-none bg-transparent text-[13px] placeholder:text-ink-soft focus:outline-none"
            />
            <div className="flex items-center justify-between">
              <button type="button" onClick={onAddPlace} aria-label="Add another place" className="grid h-[30px] w-[30px] place-items-center rounded-md text-ink-soft hover:bg-chip hover:text-ink">
                <Plus size={18} />
              </button>
              <button
                type="submit"
                disabled={!draft.trim() || pending}
                aria-label="Send"
                className="grid h-[30px] w-[30px] place-items-center rounded-md bg-clay text-white hover:bg-clay-dark disabled:opacity-40"
              >
                <ArrowUp size={17} />
              </button>
            </div>
          </div>
          <p className="mt-2.5 text-center text-[10px] leading-[15px] text-ink-soft">
            Sample assistant · Muse isn&rsquo;t connected yet
            <br />
            AI can make mistakes. Confirm details with the property.
          </p>
        </form>
      </aside>
    </>
  );
}
