import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchApartmentReviews,
  getMapsPlace,
  searchApartmentLinks,
  searchApartmentWebsites,
  searchWestCampusMaps,
  serpSearch,
  travelTimeBetween,
  UT_TOWER_COORDS,
  withSerpBudget,
} from "./serpapi";

const START = "30.2915,-97.7412";
const RIO_GRANDE = "1900 Rio Grande St, Austin, TX";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("travelTimeBetween", () => {
  it("requests a walking leg to the UT Tower and reads directions[0]", async () => {
    const fetchMock = mockFetch(
      directionsPayload({
        travel_mode: "Walking",
        distance: 1482,
        duration: 1080,
        formatted_distance: "0.9 mi",
        formatted_duration: "18 min",
      }),
    );

    const leg = await travelTimeBetween(
      { coords: "30.2915, -97.7412", address: RIO_GRANDE },
      "walking",
    );

    expect(leg).toEqual({
      distance: 1482,
      duration: 1080,
      formatted_distance: "0.9 mi",
      formatted_duration: "18 min",
      travel_mode: "Walking",
    });
    const request = requested(fetchMock);
    expect(request.init).toEqual({ cache: "no-store" });
    expect(request.params.get("engine")).toBe("google_maps_directions");
    expect(request.params.get("travel_mode")).toBe("2");
    expect(request.params.get("distance_unit")).toBe("1");
    expect(request.params.get("hl")).toBe("en");
    expect(request.params.get("gl")).toBe("us");
    expect(request.params.get("start_coords")).toBe(START);
    expect(request.params.get("start_addr")).toBeNull();
    expect(request.params.get("end_coords")).toBe(UT_TOWER_COORDS);
    expect(request.params.get("end_addr")).toBeNull();
    expect(request.params.get("api_key")).toBe("test-serp-key");
    expect(request.params.get("output")).toBe("json");
  });

  it("requests cycling with travel_mode 1 and prefers coordinates on both ends", async () => {
    const fetchMock = mockFetch(
      directionsPayload({
        travel_mode: "Cycling",
        distance: 1609,
        duration: 420,
        formatted_distance: "1.0 mi",
        formatted_duration: "7 min",
      }),
    );

    const leg = await travelTimeBetween(
      { coords: START, address: RIO_GRANDE },
      { coords: "30.2862, -97.7394", address: "UT Tower, Austin, TX" },
      "cycling",
    );

    expect(leg).toEqual({
      distance: 1609,
      duration: 420,
      formatted_distance: "1.0 mi",
      formatted_duration: "7 min",
      travel_mode: "Cycling",
    });
    const params = requested(fetchMock).params;
    expect(params.get("travel_mode")).toBe("1");
    expect(params.get("start_coords")).toBe(START);
    expect(params.get("start_addr")).toBeNull();
    expect(params.get("end_coords")).toBe(UT_TOWER_COORDS);
    expect(params.get("end_addr")).toBeNull();
  });

  it("falls back to addresses when coordinates are missing", async () => {
    const fetchMock = mockFetch(
      directionsPayload({
        travel_mode: "Walking",
        distance: 1800,
        duration: 1300,
        formatted_distance: "1.1 mi",
        formatted_duration: "22 min",
      }),
    );

    await travelTimeBetween(
      { coords: "  ", address: RIO_GRANDE },
      "University of Texas Tower, Austin, TX",
      "walking",
    );

    const params = requested(fetchMock).params;
    expect(params.get("start_addr")).toBe(RIO_GRANDE);
    expect(params.get("start_coords")).toBeNull();
    expect(params.get("end_addr")).toBe("University of Texas Tower, Austin, TX");
    expect(params.get("end_coords")).toBeNull();
    expect(params.get("travel_mode")).toBe("2");
  });

  it("treats a non-pair coords string as missing and uses the address", async () => {
    const fetchMock = mockFetch(directionsPayload());

    await travelTimeBetween(
      { coords: "near Guadalupe", address: RIO_GRANDE },
      { coords: "the tower", address: "UT Tower, Austin, TX" },
      "cycling",
    );

    const params = requested(fetchMock).params;
    expect(params.get("start_addr")).toBe(RIO_GRANDE);
    expect(params.get("start_coords")).toBeNull();
    expect(params.get("end_addr")).toBe("UT Tower, Austin, TX");
    expect(params.get("end_coords")).toBeNull();
    expect(params.get("travel_mode")).toBe("1");
  });

  it("treats a coordinate string as coords and any other string as an address", async () => {
    const fetchMock = mockFetch(directionsPayload());

    await travelTimeBetween(RIO_GRANDE, `${UT_TOWER_COORDS} `, "cycling");

    const params = requested(fetchMock).params;
    expect(params.get("start_addr")).toBe(RIO_GRANDE);
    expect(params.get("start_coords")).toBeNull();
    expect(params.get("end_coords")).toBe(UT_TOWER_COORDS);
    expect(params.get("end_addr")).toBeNull();
    expect(params.get("travel_mode")).toBe("1");
  });

  it("counts walking and cycling as separate requests", async () => {
    const fetchMock = mockFetch(directionsPayload());

    await travelTimeBetween(START, "walking");
    await travelTimeBetween(START, "cycling");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requested(fetchMock, 0).params.get("travel_mode")).toBe("2");
    expect(requested(fetchMock, 1).params.get("travel_mode")).toBe("1");
  });

  it("copies only the first directions leg and ignores trips and durations", async () => {
    mockFetch({
      directions: [
        {
          travel_mode: "Walking",
          via: "Guadalupe St",
          distance: 1482,
          duration: 1080,
          formatted_distance: "0.9 mi",
          formatted_duration: "18 min",
          trips: [
            {
              travel_mode: "Walking",
              distance: 10,
              duration: 5,
              formatted_distance: "33 ft",
              formatted_duration: "5 sec",
            },
          ],
        },
        {
          travel_mode: "Driving",
          distance: 99999,
          duration: 99999,
          formatted_distance: "62 mi",
          formatted_duration: "27 hr",
        },
      ],
      durations: [
        {
          travel_mode: "Walking",
          duration: 9999,
          formatted_duration: "2 hr",
        },
      ],
    });

    await expect(travelTimeBetween(START, "walking")).resolves.toEqual({
      distance: 1482,
      duration: 1080,
      formatted_distance: "0.9 mi",
      formatted_duration: "18 min",
      travel_mode: "Walking",
    });
  });

  it("returns null when directions is missing or empty", async () => {
    mockFetch({
      trips: [
        {
          distance: 1,
          duration: 1,
          formatted_distance: "1 m",
          formatted_duration: "1 sec",
          travel_mode: "Walking",
        },
      ],
      durations: [{ travel_mode: "Walking", duration: 1 }],
    });
    await expect(travelTimeBetween(START, "walking")).resolves.toBeNull();

    mockFetch({ directions: [] });
    await expect(travelTimeBetween(START, "cycling")).resolves.toBeNull();

    mockFetch({});
    await expect(travelTimeBetween(START, "walking")).resolves.toBeNull();
  });

  it("returns the budget object without fetching once 24 calls are spent", async () => {
    const fetchMock = mockFetch(directionsPayload());

    await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await travelTimeBetween(START, call % 2 === 0 ? "walking" : "cycling");
      }
      expect(fetchMock).toHaveBeenCalledTimes(24);
      await expect(travelTimeBetween(START, "walking")).resolves.toEqual({
        error: "serp_budget_exhausted",
      });
      expect(fetchMock).toHaveBeenCalledTimes(24);
    });
  });

  it("keeps fetching outside withSerpBudget", async () => {
    const fetchMock = mockFetch(directionsPayload());

    for (let call = 0; call < 25; call += 1) {
      await travelTimeBetween(START, "walking");
    }

    expect(fetchMock).toHaveBeenCalledTimes(25);
  });

  it("throws a SerpAPI error string instead of returning a leg", async () => {
    const fetchMock = mockFetch({ error: "Invalid API key" });

    await expect(travelTimeBetween(START, "walking")).rejects.toThrow(
      "Invalid API key",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not fetch when the start point has neither coordinates nor an address", async () => {
    const fetchMock = mockFetch(directionsPayload());

    await expect(travelTimeBetween({ coords: null, address: " " }, "walking")).rejects.toThrow(
      /start coordinates or an address/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function directionsPayload(
  leg: {
    travel_mode: string;
    distance: number;
    duration: number;
    formatted_distance: string;
    formatted_duration: string;
  } = {
    travel_mode: "Walking",
    distance: 100,
    duration: 60,
    formatted_distance: "328 ft",
    formatted_duration: "1 min",
  },
) {
  return { directions: [leg] };
}

function mockFetch(body: unknown) {
  vi.stubEnv("SERPAPI_KEY", "test-serp-key");
  const fetchMock = vi.fn(async () => Response.json(body));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requested(fetchMock: ReturnType<typeof vi.fn>, call = 0) {
  const [url, init] = fetchMock.mock.calls[call] as [string, RequestInit];
  const parsed = new URL(url);
  expect(`${parsed.origin}${parsed.pathname}`).toBe(
    "https://serpapi.com/search.json",
  );
  return { params: parsed.searchParams, init };
}

describe("serpSearch", () => {
  it("defaults hl and gl and ignores a caller api_key", async () => {
    const fetchMock = mockFetch({ organic_results: [] });

    await serpSearch({
      engine: "google",
      q: "west campus",
      api_key: "caller-key",
      output: "html",
    });

    const request = requested(fetchMock);
    expect(request.init).toEqual({ cache: "no-store" });
    expect(request.params.get("hl")).toBe("en");
    expect(request.params.get("gl")).toBe("us");
    expect(request.params.get("api_key")).toBe("test-serp-key");
    expect(request.params.get("output")).toBe("json");
    expect(request.params.get("q")).toBe("west campus");
  });

  it("keeps caller hl and gl", async () => {
    const fetchMock = mockFetch({ organic_results: [] });

    await serpSearch({
      engine: "google",
      q: "west campus",
      hl: "es",
      gl: "mx",
    });

    const params = requested(fetchMock).params;
    expect(params.get("hl")).toBe("es");
    expect(params.get("gl")).toBe("mx");
  });

  it("defaults only the locale key the caller omitted", async () => {
    const fetchMock = mockFetch({ organic_results: [] });

    await serpSearch({ q: "west campus", hl: "es" });

    const params = requested(fetchMock).params;
    expect(params.get("hl")).toBe("es");
    expect(params.get("gl")).toBe("us");
  });

  it("returns the body when error is not a string", async () => {
    const body = { error: { message: "nope" }, organic_results: [] };
    mockFetch(body);

    await expect(serpSearch({ q: "west campus" })).resolves.toEqual(body);
  });

  it("throws the SerpAPI error string from an HTTP 200 body", async () => {
    const fetchMock = mockFetch({ error: "Invalid API key" });

    await expect(serpSearch({ q: "west campus" })).rejects.toThrow(
      "Invalid API key",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws before fetching when SERPAPI_KEY is missing", async () => {
    vi.stubEnv("SERPAPI_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(serpSearch({ q: "west campus" })).rejects.toThrow(
      "SERPAPI_KEY is not set",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at 24 calls inside withSerpBudget and keeps fetching outside it", async () => {
    const fetchMock = mockFetch({ organic_results: [] });

    await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await serpSearch({ q: `inside-${call}` });
      }
      await expect(serpSearch({ q: "over" })).resolves.toEqual({
        error: "serp_budget_exhausted",
      });
    });
    expect(fetchMock).toHaveBeenCalledTimes(24);

    for (let call = 0; call < 3; call += 1) {
      await serpSearch({ q: `outside-${call}` });
    }
    expect(fetchMock).toHaveBeenCalledTimes(27);
  });

  it("counts a thrown SerpAPI error toward the cap", async () => {
    const fetchMock = mockFetch({ error: "Invalid API key" });

    await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await expect(serpSearch({ q: String(call) })).rejects.toThrow(
          "Invalid API key",
        );
      }
      await expect(serpSearch({ q: "over" })).resolves.toEqual({
        error: "serp_budget_exhausted",
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(24);
  });

  it("stops concurrent calls at 24 before they fetch", async () => {
    const fetchMock = mockFetch({ organic_results: [] });

    const results = await withSerpBudget(() =>
      Promise.all(
        Array.from({ length: 30 }, (_, call) => serpSearch({ q: String(call) })),
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(24);
    const exhausted = results.filter(
      (result) =>
        typeof result === "object" &&
        result !== null &&
        "error" in result &&
        result.error === "serp_budget_exhausted",
    );
    expect(exhausted).toHaveLength(6);
  });

  it("gives each withSerpBudget call its own counter", async () => {
    const fetchMock = mockFetch({ organic_results: [] });

    await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await serpSearch({ q: `first-${call}` });
      }
      await expect(serpSearch({ q: "first-over" })).resolves.toEqual({
        error: "serp_budget_exhausted",
      });
    });

    await withSerpBudget(async () => {
      await expect(serpSearch({ q: "second" })).resolves.toEqual({
        organic_results: [],
      });
    });

    await Promise.all([
      withSerpBudget(async () => {
        for (let call = 0; call < 24; call += 1) {
          await serpSearch({ q: `a-${call}` });
        }
      }),
      withSerpBudget(async () => {
        for (let call = 0; call < 24; call += 1) {
          await serpSearch({ q: `b-${call}` });
        }
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(73);
  });
});

describe("searchApartmentWebsites", () => {
  it("searches the place on the web and keeps title, link, and snippet", async () => {
    const fetchMock = mockFetch({
      organic_results: [
        {
          title: "The Callaway",
          link: "https://example.com/callaway",
          snippet: "West Campus Austin apartment",
          position: 1,
          displayed_link: "example.com",
        },
        {
          title: 2,
          link: "https://example.com/other",
          snippet: null,
          position: 2,
        },
        "not-a-result",
      ],
    });

    const result = await searchApartmentWebsites("The Callaway");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = requested(fetchMock);
    expect(request.init).toEqual({ cache: "no-store" });
    expect(request.params.get("engine")).toBe("google");
    expect(request.params.get("q")).toBe(
      "The Callaway West Campus Austin apartment",
    );
    expect(request.params.get("hl")).toBe("en");
    expect(request.params.get("gl")).toBe("us");
    expect(request.params.get("num")).toBe("5");
    expect(request.params.get("output")).toBe("json");
    expect(request.params.get("api_key")).toBe("test-serp-key");
    expect(result).toEqual([
      {
        title: "The Callaway",
        link: "https://example.com/callaway",
        snippet: "West Campus Austin apartment",
      },
      { link: "https://example.com/other" },
    ]);
  });

  it("returns an empty list when organic_results is missing", async () => {
    mockFetch({ search_metadata: {} });

    await expect(searchApartmentWebsites("The Callaway")).resolves.toEqual([]);
  });

  it("returns the budget object and does not fetch another website search", async () => {
    const fetchMock = mockFetch({ organic_results: [] });

    await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await searchApartmentWebsites("spent");
      }
      expect(fetchMock).toHaveBeenCalledTimes(24);
      await expect(searchApartmentWebsites("The Callaway")).resolves.toEqual({
        error: "serp_budget_exhausted",
      });
      expect(fetchMock).toHaveBeenCalledTimes(24);
    });
  });
});

describe("searchApartmentLinks", () => {
  it("searches quoted floor-plan and rent pages", async () => {
    const fetchMock = mockFetch({
      organic_results: [
        {
          title: "Callaway floor plans",
          link: "https://example.com/floor-plans",
          snippet: "Studio rent from the listing page",
          rich_snippet: { top: { detected_extensions: { price: 1200 } } },
        },
      ],
    });

    const result = await searchApartmentLinks("The Callaway");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const params = requested(fetchMock).params;
    expect(params.get("engine")).toBe("google");
    expect(params.get("q")).toBe(
      '"The Callaway" floor plan rent West Campus Austin',
    );
    expect(params.get("hl")).toBe("en");
    expect(params.get("gl")).toBe("us");
    expect(params.get("num")).toBe("8");
    expect(params.get("output")).toBe("json");
    expect(params.get("api_key")).toBe("test-serp-key");
    expect(result).toEqual([
      {
        title: "Callaway floor plans",
        link: "https://example.com/floor-plans",
        snippet: "Studio rent from the listing page",
      },
    ]);
  });

  it("returns the budget object instead of searching for listing pages", async () => {
    const fetchMock = mockFetch({});

    await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await searchApartmentLinks("spent");
      }
      expect(fetchMock).toHaveBeenCalledTimes(24);
      await expect(searchApartmentLinks("The Callaway")).resolves.toEqual({
        error: "serp_budget_exhausted",
      });
      expect(fetchMock).toHaveBeenCalledTimes(24);
    });
  });
});

const firstReview = {
  review_id: "r1",
  rating: 5,
  snippet: "Lived here a year.",
  extracted_snippet: { original: "Lived here a year." },
  iso_date: "2025-08-01T00:00:00Z",
  date: "2 months ago",
  user: { name: "Ada", thumbnail: "https://example.com/ada.jpg" },
  link: "https://maps.example/r1",
  position: 1,
  likes: 4,
};

const secondReview = {
  review_id: "r2",
  rating: 2,
  snippet: "",
  extracted_snippet: { original: "Tour was pushy." },
  iso_date: "2025-09-01T00:00:00Z",
  date: "a month ago",
  user: { name: "Grace" },
  link: "https://maps.example/r2",
  position: 2,
  source: "ignored",
};

function mockReviewPages(pages: unknown[]) {
  vi.stubEnv("SERPAPI_KEY", "test-serp-key");
  let index = 0;
  const fetchMock = vi.fn(async () => {
    const body = pages[Math.min(index, pages.length - 1)] ?? {};
    index += 1;
    return Response.json(body);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchApartmentReviews", () => {
  it("pages by qualityScore, 20 at a time, and stops after two pages", async () => {
    const fetchMock = mockReviewPages([
      {
        place_info: { rating: 4.2, title: "Ion" },
        reviews: [firstReview],
        serpapi_pagination: { next_page_token: "page-2" },
      },
      {
        place_info: { rating: 1 },
        reviews: [secondReview, "not-a-review"],
        serpapi_pagination: { next_page_token: "page-3" },
      },
      {
        reviews: [{ review_id: "r3", rating: 1, position: 3 }],
        serpapi_pagination: { next_page_token: "page-4" },
      },
    ]);

    const result = await fetchApartmentReviews("ChIJwestcampus");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requested(fetchMock, 0);
    expect(first.init).toEqual({ cache: "no-store" });
    expect(first.params.get("engine")).toBe("google_maps_reviews");
    expect(first.params.get("place_id")).toBe("ChIJwestcampus");
    expect(first.params.get("hl")).toBe("en");
    expect(first.params.get("num")).toBe("20");
    expect(first.params.get("sort_by")).toBe("qualityScore");
    expect(first.params.get("next_page_token")).toBeNull();
    expect(first.params.get("output")).toBe("json");
    expect(first.params.get("api_key")).toBe("test-serp-key");

    const second = requested(fetchMock, 1);
    expect(second.params.get("engine")).toBe("google_maps_reviews");
    expect(second.params.get("place_id")).toBe("ChIJwestcampus");
    expect(second.params.get("hl")).toBe("en");
    expect(second.params.get("num")).toBe("20");
    expect(second.params.get("sort_by")).toBe("qualityScore");
    expect(second.params.get("next_page_token")).toBe("page-2");

    expect(result).toEqual({
      place_info: { rating: 4.2 },
      reviews: [
        {
          review_id: "r1",
          rating: 5,
          snippet: "Lived here a year.",
          extracted_snippet: { original: "Lived here a year." },
          iso_date: "2025-08-01T00:00:00Z",
          date: "2 months ago",
          user: { name: "Ada", thumbnail: "https://example.com/ada.jpg" },
          link: "https://maps.example/r1",
          position: 1,
        },
        {
          review_id: "r2",
          rating: 2,
          snippet: "",
          extracted_snippet: { original: "Tour was pushy." },
          iso_date: "2025-09-01T00:00:00Z",
          date: "a month ago",
          user: { name: "Grace" },
          link: "https://maps.example/r2",
          position: 2,
        },
      ],
    });
  });

  it("stops when the next page token is absent", async () => {
    const fetchMock = mockReviewPages([
      {
        reviews: [firstReview],
        serpapi_pagination: {},
      },
      {
        reviews: [secondReview],
        serpapi_pagination: { next_page_token: "should-not-fetch" },
      },
    ]);

    const result = await fetchApartmentReviews("ChIJnotoken");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      place_info: {},
      reviews: [
        {
          review_id: "r1",
          rating: 5,
          snippet: "Lived here a year.",
          extracted_snippet: { original: "Lived here a year." },
          iso_date: "2025-08-01T00:00:00Z",
          date: "2 months ago",
          user: { name: "Ada", thumbnail: "https://example.com/ada.jpg" },
          link: "https://maps.example/r1",
          position: 1,
        },
      ],
    });
  });

  it("treats an empty next page token as the last page", async () => {
    const fetchMock = mockReviewPages([
      {
        place_info: { rating: 0 },
        reviews: [],
        serpapi_pagination: { next_page_token: "" },
      },
    ]);

    const result = await fetchApartmentReviews("ChIJempty");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ place_info: { rating: 0 }, reviews: [] });
  });

  it("returns the budget object and does not request another review page", async () => {
    const fetchMock = mockReviewPages([
      {
        place_info: { rating: 4.4 },
        reviews: [firstReview],
        serpapi_pagination: { next_page_token: "page-2" },
      },
    ]);

    const result = await withSerpBudget(async () => {
      for (let call = 0; call < 23; call += 1) {
        await serpSearch({ engine: "google", q: `warm-${call}` });
      }
      return fetchApartmentReviews("ChIJbudget");
    });

    expect(result).toEqual({ error: "serp_budget_exhausted" });
    expect(fetchMock).toHaveBeenCalledTimes(24);
    const last = requested(fetchMock, 23);
    expect(last.params.get("engine")).toBe("google_maps_reviews");
    expect(last.params.get("place_id")).toBe("ChIJbudget");
    expect(last.params.get("num")).toBe("20");
    expect(last.params.get("sort_by")).toBe("qualityScore");
    expect(last.params.get("next_page_token")).toBeNull();
  });

  it("does not fetch reviews when the budget is already exhausted", async () => {
    const fetchMock = mockReviewPages([{}]);

    const result = await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await serpSearch({ engine: "google", q: String(call) });
      }
      return fetchApartmentReviews("ChIJspent");
    });

    expect(result).toEqual({ error: "serp_budget_exhausted" });
    expect(fetchMock).toHaveBeenCalledTimes(24);
    for (let call = 0; call < fetchMock.mock.calls.length; call += 1) {
      expect(requested(fetchMock, call).params.get("engine")).toBe("google");
    }
  });
});

const callawayLocal = {
  title: "The Callaway",
  place_id: "ChIJcallaway",
  data_id: "0xcallaway",
  address: "1900 Rio Grande St, Austin, TX",
  gps_coordinates: { latitude: 30.2915, longitude: -97.7412 },
  rating: 4.1,
  reviews: 320,
  type: "Apartment building",
  thumbnail: "https://example.com/callaway.jpg",
};

describe("searchWestCampusMaps", () => {
  it("searches Google Maps around West Campus and returns local_results", async () => {
    const fetchMock = mockFetch({
      local_results: [
        callawayLocal,
        { title: "Unlisted loft", type: ["Housing"] },
        "not-a-place",
      ],
      search_metadata: { status: "Success" },
    });

    const result = await searchWestCampusMaps("apartments near dean keeton");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = requested(fetchMock);
    expect(request.init).toEqual({ cache: "no-store" });
    expect(request.params.get("engine")).toBe("google_maps");
    expect(request.params.get("type")).toBe("search");
    expect(request.params.get("q")).toBe("apartments near dean keeton");
    expect(request.params.get("ll")).toBe("@30.291,-97.752,15z");
    expect(request.params.get("hl")).toBe("en");
    expect(request.params.get("gl")).toBe("us");
    expect(request.params.get("output")).toBe("json");
    expect(request.params.get("api_key")).toBe("test-serp-key");
    expect(result).toEqual([
      callawayLocal,
      { title: "Unlisted loft", type: ["Housing"] },
    ]);
  });

  it("returns an empty list when local_results is missing", async () => {
    mockFetch({ search_metadata: {} });

    await expect(searchWestCampusMaps("quiet studio")).resolves.toEqual([]);
  });

  it("returns the budget object and does not fetch another maps search", async () => {
    const fetchMock = mockFetch({ local_results: [callawayLocal] });

    await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await searchWestCampusMaps("spent");
      }
      expect(fetchMock).toHaveBeenCalledTimes(24);
      await expect(searchWestCampusMaps("apartments")).resolves.toEqual({
        error: "serp_budget_exhausted",
      });
      expect(fetchMock).toHaveBeenCalledTimes(24);
    });
  });
});

const callawayPlace = {
  title: "The Callaway",
  place_id: "ChIJcallaway",
  data_id: "0xcallaway",
  address: "1900 Rio Grande St, Austin, TX",
  gps_coordinates: { latitude: 30.2915, longitude: -97.7412 },
  rating: 4.1,
  reviews: 320,
  website: "https://example.com/callaway",
  phone: "(512) 555-0100",
  type: ["Apartment building", "Housing"],
  description: "West Campus high rise",
};

describe("getMapsPlace", () => {
  it("loads place_results by place id and does not send type", async () => {
    const fetchMock = mockFetch({
      place_results: callawayPlace,
      search_metadata: { status: "Success" },
    });

    const result = await getMapsPlace("ChIJcallaway");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = requested(fetchMock);
    expect(request.init).toEqual({ cache: "no-store" });
    expect(request.params.get("engine")).toBe("google_maps");
    expect(request.params.get("place_id")).toBe("ChIJcallaway");
    expect(request.params.get("hl")).toBe("en");
    expect(request.params.get("gl")).toBe("us");
    expect(request.params.get("type")).toBeNull();
    expect(request.params.get("output")).toBe("json");
    expect(request.params.get("api_key")).toBe("test-serp-key");
    expect(result).toEqual(callawayPlace);
  });

  it("returns null when place_results is missing", async () => {
    mockFetch({ search_information: { local_results_state: "Fully empty" } });

    await expect(getMapsPlace("ChIJmissing")).resolves.toBeNull();
  });

  it("returns the budget object and does not fetch the place", async () => {
    const fetchMock = mockFetch({ place_results: callawayPlace });

    const result = await withSerpBudget(async () => {
      for (let call = 0; call < 24; call += 1) {
        await serpSearch({ engine: "google", q: String(call) });
      }
      return getMapsPlace("ChIJspent");
    });

    expect(result).toEqual({ error: "serp_budget_exhausted" });
    expect(fetchMock).toHaveBeenCalledTimes(24);
    for (let call = 0; call < fetchMock.mock.calls.length; call += 1) {
      expect(requested(fetchMock, call).params.get("engine")).toBe("google");
    }
  });

  it("throws a SerpAPI error string instead of returning place_results", async () => {
    const fetchMock = mockFetch({ error: "Google Maps hasn't returned any results" });

    await expect(getMapsPlace("ChIJbad")).rejects.toThrow(
      "Google Maps hasn't returned any results",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
