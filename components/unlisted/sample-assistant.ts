// Local copy for the tradeoff banner and the contact-admin draft.
// Chat replies come from POST /api/chat.
import { formatUsd, summarizeCosts } from "./costs";
import type { ComparisonApartment } from "./types";

export type AssistantAction = { type: "sort"; sort: "rent" | "monthly" | "walk" } | { type: "focus"; id: string } | { type: "add" };

export type AssistantReply = { text: string; action?: AssistantAction };

/** "Juniper on 24th" → "Juniper", "The Nueces" → "Nueces". */
export function shortName(apartment: ComparisonApartment) {
  return apartment.name.replace(/^The\s+/i, "").split(" ")[0];
}

function byRent(apartments: ComparisonApartment[]) {
  return [...apartments].sort((a, b) => (a.advertisedRent ?? Infinity) - (b.advertisedRent ?? Infinity));
}

function byMonthly(apartments: ComparisonApartment[]) {
  return [...apartments].sort((a, b) => (summarizeCosts(a).monthlyTotal ?? Infinity) - (summarizeCosts(b).monthlyTotal ?? Infinity));
}

function byWalk(apartments: ComparisonApartment[]) {
  return [...apartments].sort((a, b) => (a.walking?.durationSeconds ?? Infinity) - (b.walking?.durationSeconds ?? Infinity));
}

function monthly(apartment: ComparisonApartment) {
  const costs = summarizeCosts(apartment);
  return costs.monthlyTotal === null ? "an unknown amount" : `${costs.monthlyHasEstimate ? "about " : ""}${formatUsd(costs.monthlyTotal)}/mo`;
}

export function tradeoffSummary(apartments: ComparisonApartment[]): { title: string; body: string } | null {
  if (apartments.length < 2) return null;
  if (apartments.some((apartment) => apartment.walking === null || apartment.advertisedRent === null)) return null;
  const closest = byWalk(apartments)[0];
  const cheapest = byRent(apartments)[0];
  if (closest.id === cheapest.id) {
    return {
      title: `${shortName(closest)} wins on both walk and rent.`,
      body: `It is the shortest walk and the lowest base rent. Check its one-time charges before deciding.`,
    };
  }
  const minutes = Math.round(((cheapest.walking?.durationSeconds ?? 0) - (closest.walking?.durationSeconds ?? 0)) / 60);
  const savings = (closest.advertisedRent ?? 0) - (cheapest.advertisedRent ?? 0);
  const sharesBath = /shared bath/i.test(cheapest.floorPlan.note ?? "");
  return {
    title: "A shorter walk, or a little extra breathing room?",
    body: `${shortName(closest)} saves about ${minutes} minutes each way. ${shortName(cheapest)} saves ${formatUsd(savings)}/month in base rent${
      sharesBath ? ", but you'll share a bathroom" : ""
    }.`,
  };
}

export function introMessage(): string {
  return "Tell me what matters in your next home: your budget, commute, or must-haves. You can also use Add apartment to search for a specific place.";
}

export function draftContactMessage(apartment: ComparisonApartment): string {
  return `Hi — I'm reviewing ${apartment.name} for Fall 2027. Could you confirm the base rent, utilities estimate, parking cost, and any mandatory move-in fees? Thanks.`;
}

export function replyTo(question: string, apartments: ComparisonApartment[]): AssistantReply {
  const q = question.toLowerCase();

  if (/^add\b|add (another|a) place/.test(q)) {
    return { text: "Search by apartment name or address, then choose a result to add to your board.", action: { type: "add" } };
  }

  if (apartments.length === 0) {
    return { text: "Your board is empty. Add an apartment and I can compare it for you." };
  }

  if (/tradeoff|trade-off|talk me through/.test(q)) {
    const tradeoff = tradeoffSummary(apartments);
    return tradeoff
      ? { text: `${tradeoff.body} If the walk matters more, I'd keep the closest place first; if budget matters more, compare monthly totals, not just rent.` }
      : { text: "Add a second apartment and I'll compare the walk against the price." };
  }

  if (/one[- ]time|move[- ]in|deposit|upfront|application|admin/.test(q)) {
    const list = apartments
      .map((a) => {
        const costs = summarizeCosts(a);
        const unknown = costs.oneTimeUnknownCount > 0 ? `, plus ${costs.oneTimeUnknownCount} not disclosed` : "";
        return `${a.name}: ${formatUsd(costs.oneTimeTotal)} at move-in${unknown}`;
      })
      .join(". ");
    return { text: `One-time charges, kept apart from monthly rent. ${list}.` };
  }

  if (/fee|utilit|parking|hidden|included|extra|total/.test(q)) {
    const ranked = byMonthly(apartments);
    const list = ranked.map((a) => `${a.name}: ${monthly(a)} with monthly fees`).join(". ");
    return {
      text: `Sorted by what you'd pay each month once utilities and other recurring fees are added. ${list}. Fees marked "not listed" aren't included.`,
      action: { type: "sort", sort: "monthly" },
    };
  }

  if (/cheap|lower rent|rent|price|budget|afford|cost/.test(q)) {
    const ranked = byRent(apartments);
    const list = ranked.map((a) => `${a.name}: ${a.advertisedRent === null ? "unknown" : formatUsd(a.advertisedRent)} base rent, ${monthly(a)} with monthly fees`).join(". ");
    return {
      text: `Sorted by base rent. ${list}. Advertised rent leaves out utilities and parking.`,
      action: { type: "sort", sort: "rent" },
    };
  }

  if (/walk|close|closer|shorter|commute|campus|class|bike|tradeoff/.test(q)) {
    const ranked = byWalk(apartments);
    const list = ranked
      .map((a) => `${a.name}: ${a.walking?.formattedDuration ?? "unknown"} walk, ${a.cycling?.formattedDuration ?? "unknown"} by bike`)
      .join(". ");
    const tradeoff = tradeoffSummary(apartments);
    return { text: `Sorted by walk to the UT Tower. ${list}.${tradeoff ? ` ${tradeoff.body}` : ""}`, action: { type: "sort", sort: "walk" } };
  }

  if (/review|rating|score|resident|tour/.test(q)) {
    const list = apartments
      .map((a) =>
        a.honestRating === null
          ? `${a.name}: no resident score yet (Google ${a.googleRating ?? "—"})`
          : `${a.name}: ${a.honestRating.toFixed(1)} from ${a.honestCount} resident reviews (Google ${a.googleRating ?? "—"}, ${a.excludedTour} tour reviews left out)`,
      )
      .join(". ");
    return { text: `Resident scores only count reviews about living there. ${list}.` };
  }

  const named = apartments.find((a) => q.includes(shortName(a).toLowerCase()));
  if (named) {
    const costs = summarizeCosts(named);
    return {
      text: `${named.name}: ${formatUsd(named.advertisedRent ?? 0)} base rent, ${monthly(named)} with monthly fees, ${formatUsd(costs.oneTimeTotal)} known at move-in. ${named.walking?.formattedDuration ?? "Unknown"} walk to the UT Tower.`,
      action: { type: "focus", id: named.id },
    };
  }

  return {
    text: "I can compare rent, monthly fees, move-in costs, the walk to campus, or resident reviews. Try asking about one of those.",
  };
}
