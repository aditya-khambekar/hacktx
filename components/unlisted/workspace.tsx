"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApartmentDetail } from "./apartment-detail";
import { AddApartmentDialog } from "./add-apartment-dialog";
import { ApartmentComparison, type SortKey } from "./apartment-comparison";
import { AssistantPanel, type AddSuggestionResult, type ChatMessage } from "./assistant-panel";
import {
  chatFailureCopy,
  chatRequestBody,
  conversationIdFrom,
  errorCodeFrom,
  mergeDashboard,
  messageTextFrom,
  readChatStream,
  readFailureCode,
  statusPhaseFrom,
  holdSuggestion,
  releaseHeldSuggestions,
  suggestionFrom,
  upsertDashboard,
} from "./chat-client";
import { ArrowUpRight, Plus, Receipt, Sparkle } from "./icons";
import { PreferencesBar, budgetFromPreferences } from "./preferences-bar";
import { introMessage, tradeoffSummary } from "./sample-assistant";
import { SiteHeader, type HeaderUser, type WorkspaceView } from "./site-header";
import { toComparisonApartment } from "./costs";
import type { ApartmentProfile, ComparisonApartment, Preference } from "./types";

function subscribeToNavigation(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("unlisted:navigate", callback);
  return () => { window.removeEventListener("popstate", callback); window.removeEventListener("unlisted:navigate", callback); };
}
function detailLocation() { return new URLSearchParams(window.location.search).get("apartment") ?? ""; }

let messageCount = 0;
const nextMessageId = () => `m${++messageCount}`;

export function Workspace({ user }: { user?: HeaderUser | null }) {
  const detailId = useSyncExternalStore(subscribeToNavigation, detailLocation, () => "");
  const [loaded, setLoaded] = useState(false);
  function openApartment(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set("apartment", id);
    window.history.pushState({ unlistedDetail: true }, "", url);
    window.dispatchEvent(new Event("unlisted:navigate"));
    window.scrollTo({ top: 0 });
  }
  function closeApartment() {
    if (window.history.state?.unlistedDetail) { window.history.back(); return; }
    const url = new URL(window.location.href);
    url.searchParams.delete("apartment");
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("unlisted:navigate"));
  }
  const [view, setView] = useState<WorkspaceView>("workspace");
  const [shortlist, setShortlist] = useState<ComparisonApartment[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [sort, setSort] = useState<SortKey>("added");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [statusPhase, setStatusPhase] = useState<string | null>(null);
  const [shareLabel, setShareLabel] = useState("Share shortlist");
  const conversationRef = useRef<string | null>(null);
  const runGeneration = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const boardEpoch = useRef(0);

  const refreshBoard = useCallback(async (signal?: AbortSignal) => {
    const epoch = ++boardEpoch.current;
    const response = await fetch("/api/apartments", { signal });
    if (signal?.aborted || epoch !== boardEpoch.current) return;
    if (!response.ok) return;
    const rows: { id: string; profile: ApartmentProfile }[] = await response.json();
    if (signal?.aborted || epoch !== boardEpoch.current) return;
    setShortlist((current) => mergeDashboard(current, rows));
  }, []);

  useEffect(() => {
    const request = new AbortController();
    refreshBoard(request.signal)
      .catch(() => { /* Signed-out visitors start with an empty dashboard. */ })
      .finally(() => { if (!request.signal.aborted) setLoaded(true); });
    return () => request.abort();
  }, [refreshBoard]);

  useEffect(() => () => {
    runGeneration.current += 1;
    abortRef.current?.abort();
  }, []);

  const visible = view === "saved" ? shortlist.filter((a) => savedIds.has(a.id)) : shortlist;
  const budget = budgetFromPreferences(preferences);
  const tradeoff = tradeoffSummary(shortlist);

  const send = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || (abortRef.current && !abortRef.current.signal.aborted)) return;

    const generation = ++runGeneration.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const assistantId = nextMessageId();
    const stillCurrent = () => runGeneration.current === generation && !controller.signal.aborted;

    setMessages((current) => [...current, { id: nextMessageId(), role: "user", text: trimmed }]);
    setPending(true);
    setStatusPhase(null);

    const writeAssistant = (update: (message: ChatMessage) => ChatMessage) => {
      setMessages((current) => {
        if (!stillCurrent()) return current;
        const index = current.findIndex((message) => message.id === assistantId);
        if (index === -1) return [...current, update({ id: assistantId, role: "assistant", text: "" })];
        return current.map((message) => (message.id === assistantId ? update(message) : message));
      });
    };

    const note = (copy: string) => {
      writeAssistant((message) => {
        if (!message.text) return { ...message, text: copy };
        if (message.text.includes(copy)) return message;
        return { ...message, text: `${message.text}\n\n${copy}` };
      });
    };

    void (async () => {
      let sawReply = false;
      let refresh = false;
      let heldSuggestions: ApartmentProfile[] | undefined;
      let suggestionsReleased = false;
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          signal: controller.signal,
          body: JSON.stringify(chatRequestBody(trimmed, conversationRef.current, preferences.map((item) => item.label))),
        });
        if (!stillCurrent()) return;

        if (!response.ok || !response.body) {
          const code = response.status === 401 ? "unauthorized" : await readFailureCode(response);
          if (!stillCurrent()) return;
          if (code === "not_found") conversationRef.current = null;
          sawReply = true;
          note(chatFailureCopy(code));
          return;
        }

        await readChatStream(response.body, (event) => {
          if (!stillCurrent()) return;
          if (event.event === "status") {
            const phase = statusPhaseFrom(event.data);
            if (phase) setStatusPhase(phase);
            return;
          }
          if (event.event === "suggestion") {
            const profile = suggestionFrom(event.data);
            if (!profile) return;
            sawReply = true;
            heldSuggestions = holdSuggestion(heldSuggestions, profile);
            return;
          }
          if (event.event === "message") {
            const reply = messageTextFrom(event.data);
            if (reply === null || !reply.trim()) return;
            sawReply = true;
            const held = heldSuggestions;
            suggestionsReleased = true;
            writeAssistant((message) => releaseHeldSuggestions({ ...message, text: reply }, held));
            return;
          }
          if (event.event === "error") {
            sawReply = true;
            note(chatFailureCopy(errorCodeFrom(event.data)));
            return;
          }
          if (event.event === "done") {
            const id = conversationIdFrom(event.data);
            if (id) conversationRef.current = id;
            refresh = true;
          }
        });

        if (!stillCurrent()) return;
        if (!suggestionsReleased && heldSuggestions?.length) {
          suggestionsReleased = true;
          const held = heldSuggestions;
          writeAssistant((message) => releaseHeldSuggestions(message, held));
        }
        if (!sawReply) note("The assistant didn’t reply. Try again.");
        if (refresh) {
          try {
            await refreshBoard();
          } catch {
            // The reply still stands when the board cannot refresh.
          }
        }
      } catch {
        if (!stillCurrent()) return;
        note("Couldn’t reach the assistant. Try again.");
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (stillCurrent()) {
          setPending(false);
          setStatusPhase(null);
        }
      }
    })();
  }, [preferences, refreshBoard]);

  const closeAssistant = useCallback(() => setAssistantOpen(false), []);

  function newConversation() {
    runGeneration.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    conversationRef.current = null;
    setMessages([]);
    setPending(false);
    setStatusPhase(null);
  }

  async function addSuggestion(profile: ApartmentProfile): Promise<AddSuggestionResult> {
    try {
      const response = await fetch("/api/apartments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      if (response.status === 401) return "signin";
      if (!response.ok) return "failed";
      const saved: { id?: unknown; profile?: unknown } = await response.json();
      if (typeof saved.id !== "string" || !saved.id) return "failed";
      const stored = suggestionFrom(saved.profile) ?? profile;
      let apartment: ComparisonApartment | null = null;
      for (const candidate of [stored, profile]) {
        try {
          apartment = { ...toComparisonApartment(candidate), databaseId: saved.id };
          break;
        } catch {
          apartment = null;
        }
      }
      if (!apartment) return "failed";
      const column = apartment;
      setShortlist((current) => upsertDashboard(current, column));
      setView("workspace");
      try {
        await refreshBoard();
      } catch {
        // The saved row is already on the board.
      }
      return "saved";
    } catch {
      return "failed";
    }
  }

  function removeApartment(id: string) {
    const target = shortlist.find((apartment) => apartment.id === id);
    setShortlist((current) => current.filter((apartment) => apartment.id !== id));
    if (!target?.databaseId) return;
    const databaseId = target.databaseId;
    const removed = target;
    void (async () => {
      let ok = false;
      try {
        const response = await fetch(`/api/apartments/${encodeURIComponent(databaseId)}`, { method: "DELETE" });
        ok = response.ok || response.status === 404;
      } catch {
        ok = false;
      }
      if (!ok) {
        setShortlist((current) => current.some((apartment) => apartment.id === id) ? current : upsertDashboard(current, removed));
      }
    })();
  }

  function toggleSaved(id: string) {
    setSavedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const researchingIds = useRef(new Set<string>());

  async function research(apartment: ComparisonApartment, force = false) {
    if (researchingIds.current.has(apartment.id)) return;
    researchingIds.current.add(apartment.id);
    setShortlist((current) => current.map((item) => item.id === apartment.id ? { ...item, researchStatus: "loading", researchError: undefined } : item));
    try {
      const url = force && apartment.databaseId
        ? `/api/apartments/${encodeURIComponent(apartment.databaseId)}/refresh`
        : `/api/apartments/discover/${encodeURIComponent(apartment.id)}`;
      const response = await fetch(url, { method: "POST" });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to research and save this apartment." : "Research failed. Your previous information is kept. Try again.");
      const result = await response.json();
      let saved = result;
      if (!(force && apartment.databaseId)) {
        const save = await fetch("/api/apartments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profile: result }) });
        if (!save.ok) throw new Error("Couldn’t save the research. Please try again.");
        saved = await save.json();
      }
      const updated = { ...toComparisonApartment(saved.profile), databaseId: saved.id, researchStatus: "ready" as const };
      setShortlist((current) => current.map((item) => item.id === apartment.id ? updated : item));
    } catch (failure) {
      setShortlist((current) => current.map((item) => item.id === apartment.id ? { ...item, researchStatus: "error", researchError: failure instanceof Error ? failure.message : "Research failed. Try again." } : item));
    } finally { researchingIds.current.delete(apartment.id); }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareLabel("Link copied");
    } catch {
      setShareLabel("Copy failed");
    }
    setTimeout(() => setShareLabel("Share shortlist"), 2000);
  }

  const emptyState = (
    <div className="rounded-[10px] border border-dashed border-line bg-paper-raised px-6 py-14 text-center">
      <p className="text-[20px]">{view === "saved" ? "Nothing saved yet." : "Your board is empty."}</p>
      <p className="mx-auto mt-2 max-w-sm text-[13px] text-ink-soft">
        {view === "saved"
          ? "Tap the heart on an apartment to keep it here."
          : "Add an apartment to compare rent, monthly fees, and move-in costs side by side."}
      </p>
      {view === "workspace" && (
        <button type="button" onClick={() => setAddOpen(true)} className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-full bg-clay px-4 text-[13px] font-semibold text-white hover:bg-clay-dark">
          <Plus size={16} />
          Add apartment
        </button>
      )}
    </div>
  );

  return (
    <>
      <SiteHeader
        view={view}
        onViewChange={(next) => { if (detailId) closeApartment(); setView(next); }}
        savedCount={savedIds.size}
        saveStatus={shortlist.some((apartment) => apartment.researchStatus === "loading") ? "Researching apartment details…" : shortlist.some((apartment) => apartment.researchStatus === "error") ? "Some apartments need attention" : shortlist.length ? "Added apartments saved" : "No apartments added"}
        onShare={share}
        shareLabel={shareLabel}
        user={user}
      />

      <div className={`grid w-full flex-1 ${detailId ? "" : "lg:grid-cols-[minmax(0,1fr)_368px]"}`}>
        <main className="flex min-w-0 flex-col gap-6 px-4 pt-[26px] pb-28 sm:px-6 lg:px-8 lg:pb-10">
          {detailId ? (() => {
            const apartment = shortlist.find((item) => item.id === detailId);
            return apartment ? <ApartmentDetail key={apartment.id} apartment={apartment} onBack={closeApartment} onRetry={() => { void research(apartment, true); }} /> : <div className="py-12"><p>{loaded ? "This apartment is not on your dashboard. Sign in or add it to view its details." : "Loading apartment details…"}</p><button type="button" onClick={closeApartment} className="mt-4 min-h-10 rounded-md border border-line px-4">Back to all apartments</button></div>;
          })() : <>
          <h1 className="sr-only">{view === "saved" ? "Saved places" : "Fall 2027 shortlist"}</h1>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><h2 className="text-2xl text-ink">Your apartment shortlist</h2><p className="mt-1 text-sm text-ink-soft">Find a specific place and compare it on your own terms.</p></div>
            <button type="button" onClick={() => setAddOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-clay px-4 text-sm font-semibold text-white hover:bg-clay-dark"><Plus size={17} />Add apartment</button>
          </div>
          <PreferencesBar preferences={preferences} onChange={setPreferences} />

          <ApartmentComparison
            onOpen={openApartment}
            onRefresh={(apartment) => { void research(apartment, true); }}
            apartments={visible}
            sort={sort}
            onSortChange={setSort}
            budget={budget}
            savedIds={savedIds}
            onToggleSaved={toggleSaved}
            onRemove={removeApartment}
            selectedId={selectedId}
            onSelect={setSelectedId}
            emptyState={emptyState}
          />

          {tradeoff && view === "workspace" && (
            <section className="flex flex-col gap-3 rounded-[10px] bg-sage px-4 py-4 sm:flex-row sm:items-center sm:py-5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-paper-raised text-sage-ink">
                <Sparkle size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] text-ink">{tradeoff.title}</h2>
                <p className="mt-1.5 text-[12px] text-sage-ink">{tradeoff.body}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  send("Talk me through the tradeoff between price and the walk to campus");
                  setAssistantOpen(true);
                }}
                className="flex items-center gap-1 self-start text-[12px] font-semibold text-clay-dark hover:underline sm:self-center"
              >
                Talk it through
                <ArrowUpRight size={14} />
              </button>
            </section>
          )}

          <section className="flex gap-3 rounded-[10px] border border-line bg-paper-raised px-4 py-5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-clay-tint text-clay-dark">
              <Receipt size={17} />
            </span>
            <div className="min-w-0">
              <h2 className="text-[12.5px] font-semibold text-ink">Extra housing costs</h2>
              <p className="mt-2 text-[12px] text-ink">
                Advertised rent, additional monthly fees, and one-time move-in charges are separated so you can compare the full cost before you reach out to
                administrators.
              </p>
              <p className="mt-2 text-[10.5px] leading-relaxed text-ink-soft">
                Published = listed by the property. Estimate (~) = approximate cost. Unknown = not disclosed in the current listing. Absence of a fee does
                not mean it is zero.
              </p>
            </div>
          </section>
          </>}
        </main>

        {!detailId && <AssistantPanel
          apartments={shortlist}
          intro={introMessage()}
          messages={messages}
          pending={pending}
          statusPhase={statusPhase}
          dashboardIds={new Set(shortlist.flatMap((apartment) => apartment.databaseId ? [apartment.id] : []))}
          onSend={send}
          onAddSuggestion={addSuggestion}
          onNewConversation={newConversation}
          onAddPlace={() => setAddOpen(true)}
          focusId={selectedId}
          onFocusChange={setSelectedId}
          open={assistantOpen}
          onClose={closeAssistant}
        />}
      </div>

      {!detailId && !assistantOpen && (
        <button
          type="button"
          onClick={() => setAssistantOpen(true)}
          className="fixed right-4 bottom-4 z-30 flex h-12 items-center gap-2 rounded-full bg-clay px-5 text-sm font-semibold text-white shadow-lg hover:bg-clay-dark lg:hidden"
        >
          <Sparkle size={18} />
          Ask Unlisted
        </button>
      )}

      <AddApartmentDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        shortlistIds={new Set(shortlist.map((a) => a.id))}
        onAdd={(apartment) => {
          setShortlist((current) => [...current.filter((item) => item.id !== apartment.id), apartment]);
          setView("workspace");
          setSelectedId(apartment.id);
          setAddOpen(false);
          void research(apartment);
        }}
      />
    </>
  );
}
