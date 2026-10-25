import "server-only";

import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { load } from "cheerio";
import type { ListingFloorplan, ListingFee } from "./listing-types";

export type ListingEvidence = {
  id: string;
  title: string;
  link: string;
  snippet: string;
  sourceKind: "official page" | "search snippet";
};
type Page = { url: string; html: string };
type Row = Record<string, unknown>;
const MAX_PAGES = 5;
const MAX_BYTES = 2_000_000;
const privateV4 = new BlockList();
const privateV6 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3],
] as const) privateV4.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["::", 128], ["::1", 128], ["::ffff:0:0", 96], ["64:ff9b::", 96],
  ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16],
  ["fc00::", 7], ["fe80::", 10], ["ff00::", 8],
] as const) privateV6.addSubnet(address, prefix, "ipv6");

export function publicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !privateV4.check(address, "ipv4") : family === 6 && !privateV6.check(address, "ipv6");
}

function publicUrl(input: string): URL {
  const url = new URL(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!/^https?:$/.test(url.protocol) || url.username || url.password ||
      (url.port && url.port !== "80" && url.port !== "443") ||
      !host.includes(".") && !isIP(host) || /(^|\.)(localhost|local|internal)$/.test(host) ||
      isIP(host) && !publicAddress(host)) throw new Error("unsafe_official_url");
  url.hash = "";
  // Do not forward tracking identifiers or arbitrary credentials to the website.
  for (const key of [...url.searchParams.keys()]) {
    if (/api.?key|token|auth|secret|^utm_|^gclid$|^fbclid$/i.test(key)) url.searchParams.delete(key);
  }
  return url;
}

/** Resolve and pin a public address for each request, including every redirect. */
async function readPage(input: string, redirects = 0): Promise<Page> {
  const url = publicUrl(input);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) throw new Error("unsafe_official_address");
  const address = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      method: "GET", family: address.family,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [{ address: address.address, family: address.family }]);
        else callback(null, address.address, address.family);
      },
      headers: { "User-Agent": "UnlistedApartmentResearch/1.0", Accept: "text/html,application/xhtml+xml" },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        if (redirects >= 4) return reject(new Error("official_redirect_limit"));
        readPage(new URL(response.headers.location, url).href, redirects + 1).then(resolve, reject);
        return;
      }
      if (status !== 200 || !/text\/html|application\/xhtml/i.test(response.headers["content-type"] ?? "")) {
        response.resume();
        reject(new Error("official_page_unavailable"));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) request.destroy(new Error("official_page_too_large"));
        else chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => resolve({ url: url.href, html: Buffer.concat(chunks).toString("utf8") }));
    });
    const timer = setTimeout(() => request.destroy(new Error("official_page_timeout")), 12_000);
    request.on("close", () => clearTimeout(timer));
    request.on("error", reject);
    request.end();
  });
}

const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.map(row) : [];
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
function amount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).replace(/[$,]/g, "").trim();
  return /^\d+(\.\d{1,2})?$/.test(raw) && Number.isFinite(Number(raw)) ? Number(raw) : null;
}

/** Parse a public JSON assignment as data. Never execute a property's scripts. */
export function calculatorData(html: string): Row {
  const $ = load(html);
  for (const script of $("script").toArray()) {
    const text = $(script).text();
    const match = /window\.feeCalculatorData\s*=\s*/.exec(text);
    if (!match) continue;
    const raw = text.slice(match.index + match[0].length);
    let depth = 0, quoted = false, escaped = false;
    if (raw[0] !== "{") continue;
    for (let i = 0; i < raw.length; i += 1) {
      const char = raw[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) {
        try { return row(JSON.parse(raw.slice(0, i + 1))); } catch { break; }
      }
    }
  }
  return {};
}

function sameId(value: unknown, id: unknown): boolean {
  const scalar = (v: unknown) => String(row(v).ID ?? row(v).id ?? v);
  return value === undefined || value === false || value === null || scalar(value) === scalar(id);
}

function calculatorFees(data: Row, planId: number, configuration: string, term: Row, sourceUrl: string): ListingFee[] {
  const fees: ListingFee[] = [];
  for (const fee of rows(data.fees)) {
    if (Array.isArray(fee.wp_floor_plans) && !fee.wp_floor_plans.includes(planId) ||
        fee.spaceconfiguration && fee.spaceconfiguration !== configuration ||
        !sameId(fee.wp_lease_term, term.lease_term) || !sameId(fee.wp_lease_start_window, term.lease_start_window)) continue;
    const cost = amount(fee.rateamount);
    if (cost === null || typeof fee.chargecodename !== "string") continue; // Excludes negative concessions, already reflected in visible base rent.
    const description = typeof fee.chargecodedescription === "string" ? clean(fee.chargecodedescription) : "";
    const eligibility = rows(fee.customerrelationships).map((item) => item.customerRelationshipName).filter((x): x is string => typeof x === "string");
    const conditions = [description !== fee.chargecodename ? description : "", eligibility.length ? `Eligibility: ${eligibility.join(", ")}.` : ""].filter(Boolean).join(" ");
    const timing = typeof fee.chargetiming === "string" ? fee.chargetiming : null;
    const cadence = timing && /month|installment/i.test(timing) ? "monthly" : timing && /move.in|completed/i.test(timing) ? `one-time · ${timing}` : timing;
    const applies = fee.isoptional === true ? "optional" : eligibility.length || /if applicable|if .*contracted/i.test(description) ? "conditional" : "required";
    const name = clean(fee.chargecodename);
    if (!fees.some((other) => other.name === name && other.amount === cost && other.cadence === cadence && other.conditions === conditions)) {
      fees.push({ name, amount: cost, cadence, applies, conditions: conditions || null, sourceUrl });
    }
  }
  return fees;
}

/** Landmark cards publish promotional base rent separately from inclusive rent. */
export function landmarkFloorplans(page: Page, calculator?: Page): ListingFloorplan[] {
  const $ = load(page.html);
  const data = calculator ? calculatorData(calculator.html) : {};
  const terms = rows(data.floorplansByLeaseTerm);
  const plans: ListingFloorplan[] = [];
  $(".floorplans > .floorplan").each((_index, element) => {
    const card = $(element).clone();
    card.find(".floorplan-modal, del, s, .floorplan__price--slash").remove();
    const name = clean(card.find(".floorplan__name").first().text());
    if (!name) return;
    const id = Number(card.attr("id")?.replace("floorplan-", ""));
    const matchingTerms = terms.flatMap((term) => rows((Array.isArray(term.bedrooms) ? term.bedrooms : []).flat()).filter((plan) => plan.ID === id).map((plan) => ({ term, plan })));
    // Never choose one of several lease terms arbitrarily.
    const match = matchingTerms.length === 1 ? matchingTerms[0] : null;
    const details = clean(card.find(".floorplan__details").text());
    const disclaimer = clean(card.find(".floorplan__disclaimer").first().text());
    const basis = /per person|per bed/i.test(disclaimer) ? "per person" : /per unit|per apartment/i.test(disclaimer) ? "per unit" : null;
    const bedMatch = /\b(\d+)\s*bed/i.exec(details);
    const bathMatch = /\b(\d+(?:\.\d+)?)\s*bath/i.exec(details);
    const sizeMatch = /\b([\d,]+)\s*sq\s*ft/i.exec(details);
    const hasSizeRange = /[\d,]+\s*[–-]\s*[\d,]+\s*sq/i.test(details);
    const variants = card.find(".floorplan__price").filter((_i, node) => $(node).find(".floorplan__price--base-rate").length > 0);
    variants.each((_i, node) => {
      const price = $(node);
      const base = /Base Price:\s*\$([\d,.]+)/i.exec(price.find(".floorplan__price--base-rate").text());
      const current = price.find(".floorplan__price--value").first().text().match(/\$([\d,.]+)/);
      const configuration = clean(price.find(".floorplan__price--label").text());
      const baseRent = amount(base?.[1]);
      const inclusive = /inclusive monthly|base rent plus all mandatory fees/i.test(disclaimer) ? amount(current?.[1]) : null;
      if (baseRent === null && inclusive === null) return;
      plans.push({
        name: variants.length > 1 ? `${name} · ${configuration}` : name,
        beds: match ? amount(match.plan.unit_bedrooms) : /studio/i.test(details) ? 0 : amount(bedMatch?.[1]),
        baths: match ? amount(match.plan.unit_bathrooms) : amount(bathMatch?.[1]),
        sqft: hasSizeRange ? null : amount(sizeMatch?.[1]),
        baseRent, publishedMonthlyTotal: inclusive !== null && (baseRent === null || inclusive >= baseRent) ? inclusive : null,
        rentBasis: basis, priceKind: /Starting At/i.test(price.text()) || /Starting At/i.test(card.find(".floorplan__prices").text()) ? "starting at" : null,
        leaseTerm: match && typeof match.term.name === "string" ? match.term.name : null,
        sourceKind: "official page", sourceUrl: card.attr("id") ? `${page.url}#${card.attr("id")}` : page.url,
        fees: match && calculator ? calculatorFees(data, id, configuration, match.term, calculator.url) : [],
      });
    });
  });
  return plans;
}

function pageEvidence(page: Page, index: number): ListingEvidence[] {
  const $ = load(page.html);
  const title = clean($("title").text());
  $("script, style, noscript, nav, header, footer, .floorplan-modal, del, s, .floorplan__price--slash").remove();
  const blocks = $(".floorplans > .floorplan, .floorplan-card, .floor-plan-card, [data-floorplan-id]").toArray();
  const evidence: ListingEvidence[] = [];
  for (const [i, node] of blocks.slice(0, 32).entries()) {
    evidence.push({ id: `official-${index}-plan-${i}`, title, link: page.url, snippet: clean($(node).text()).slice(0, 2500), sourceKind: "official page" });
  }
  // Each plan is a separate evidence block, so its price cannot validate a different plan.
  if (blocks.length) $(blocks).remove();
  evidence.push({ id: `official-${index}`, title, link: page.url, snippet: clean($("body").text()).slice(0, 10000), sourceKind: "official page" });
  return evidence;
}

/** SerpAPI finds links; bounded server GETs read the official property's evidence. */
export async function readOfficialPages(website: string | null, organicLinks: string[]) {
  const pages: Page[] = [];
  const failures: string[] = [];
  const failed = (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const code = row(error).code;
    const reason = /^(unsafe_|official_)[a-z_]+$/.test(message) ? message : typeof code === "string" && /^[A-Z_0-9]+$/.test(code) ? code : "official_fetch_failed";
    failures.push(reason);
    console.info("[listing]", { operation: "official_page_unavailable", reason });
  };
  if (!website) return { evidence: [] as ListingEvidence[], floorplans: [] as ListingFloorplan[], sources: [] as string[], failures };
  try { pages.push(await readPage(website)); } catch (error) {
    failed(error);
    return { evidence: [] as ListingEvidence[], floorplans: [] as ListingFloorplan[], sources: [] as string[], failures };
  }
  const origin = new URL(pages[0].url).origin;
  const queue = new Set<string>();
  const attempted = new Set([pages[0].url]);
  const addLinks = (page: Page) => {
    const $ = load(page.html);
    const links = [...organicLinks, ...$("a[href]").toArray().map((a) => $(a).attr("href") ?? "")];
    for (const href of links) {
      try {
        const url = publicUrl(new URL(href, page.url).href);
        if (url.origin === origin && /floor.?plans?|pricing|price.calculator|fees|cost.of.living/i.test(url.pathname) &&
            !/apply|application|login|sign.?in/i.test(url.pathname) && !attempted.has(url.href)) queue.add(url.href);
      } catch { /* Invalid or non-public links are not followed. */ }
    }
  };
  addLinks(pages[0]);
  while (queue.size && attempted.size < MAX_PAGES) {
    const next = [...queue].sort((a, b) => Number(/calculator|fees/.test(b)) - Number(/calculator|fees/.test(a)))[0];
    queue.delete(next);
    attempted.add(next);
    try {
      const page = await readPage(next);
      if (new URL(page.url).origin !== origin || pages.some((p) => p.url === page.url)) continue;
      pages.push(page);
      addLinks(page);
    } catch (error) { failed(error); }

  }
  const calculator = pages.find((p) => p.html.includes("window.feeCalculatorData"));
  return {
    evidence: pages.flatMap(pageEvidence).filter((item, index, all) => all.slice(0, index).reduce((length, source) => length + source.snippet.length, 0) < 65_000),
    floorplans: pages.flatMap((page) => landmarkFloorplans(page, calculator)),
    sources: pages.map((page) => page.url),
    failures,
  };
}
