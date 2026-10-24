import { AsyncLocalStorage } from "node:async_hooks";

const MAX_SERP_CALLS = 24;
const budgets = new AsyncLocalStorage<{ calls: number }>();

/** Give one user message its own budget, including across async tool calls. */
export function withSerpBudget<T>(fn: () => T): T {
  return budgets.run({ calls: 0 }, fn);
}

export async function serpSearch(
  params: Record<string, string>,
): Promise<unknown> {
  const budget = budgets.getStore();
  if (budget && budget.calls >= MAX_SERP_CALLS) {
    return { error: "serp_budget_exhausted" };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error("SERPAPI_KEY is required");

  const url = new URL("https://serpapi.com/search.json");
  url.search = new URLSearchParams({
    ...params,
    output: "json",
    hl: params.hl ?? "en",
    gl: params.gl ?? "us",
    api_key: apiKey,
  }).toString();

  // Increment before awaiting so parallel calls cannot exceed the cap.
  if (budget) budget.calls += 1;

  const response = await fetch(url, { cache: "no-store" });
  const data: unknown = await response.json();
  if (
    data !== null &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    throw new Error(data.error.split(apiKey).join("[redacted]"));
  }
  if (!response.ok) {
    throw new Error(`SerpAPI request failed (${response.status})`);
  }
  return data;
}
