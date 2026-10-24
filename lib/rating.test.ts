import { describe, expect, it } from "vitest";
import { honestRating } from "./rating";

describe("honestRating", () => {
  it("keeps a 5-star apartment review in the mean", () => {
    expect(honestRating([{ rating: 5, about: "apartment" }])).toEqual({
      honestRating: 5,
      honestCount: 1,
      excludedTour: 0,
      unclearCount: 0,
    });
  });

  it("keeps a tour review of any star value out of the mean", () => {
    expect(
      honestRating([
        { rating: 3, about: "apartment" },
        { rating: 5, about: "tour" },
      ]),
    ).toEqual({
      honestRating: 3,
      honestCount: 1,
      excludedTour: 1,
      unclearCount: 0,
    });
  });

  it("keeps an empty-text unclear review out of the mean", () => {
    const reviews = [
      { rating: 4, about: "apartment" as const, text: "Quiet and clean." },
      { rating: 5, about: "unclear" as const, text: "" },
    ];

    expect(honestRating(reviews)).toEqual({
      honestRating: 4,
      honestCount: 1,
      excludedTour: 0,
      unclearCount: 1,
    });
  });

  it("returns honestRating null when every review is a tour", () => {
    expect(
      honestRating([
        { rating: 5, about: "tour" },
        { rating: 1, about: "tour" },
      ]),
    ).toEqual({
      honestRating: null,
      honestCount: 0,
      excludedTour: 2,
      unclearCount: 0,
    });
  });

  it("averages every apartment review and leaves the mean unrounded", () => {
    expect(
      honestRating([
        { rating: 5, about: "apartment" },
        { rating: 1, about: "apartment" },
      ]),
    ).toEqual({
      honestRating: 3,
      honestCount: 2,
      excludedTour: 0,
      unclearCount: 0,
    });

    expect(
      honestRating([
        { rating: 5, about: "apartment" },
        { rating: 4, about: "apartment" },
      ]),
    ).toEqual({
      honestRating: 4.5,
      honestCount: 2,
      excludedTour: 0,
      unclearCount: 0,
    });

    expect(
      honestRating([
        { rating: 5, about: "apartment" },
        { rating: 4, about: "apartment" },
        { rating: 5, about: "apartment" },
      ]),
    ).toEqual({
      honestRating: 14 / 3,
      honestCount: 3,
      excludedTour: 0,
      unclearCount: 0,
    });
  });

  it("counts apartment, tour, and unclear reviews independently", () => {
    expect(
      honestRating([
        { rating: 4, about: "apartment" },
        { rating: 5, about: "tour" },
        { rating: 1, about: "tour" },
        { rating: 5, about: "unclear" },
      ]),
    ).toEqual({
      honestRating: 4,
      honestCount: 1,
      excludedTour: 2,
      unclearCount: 1,
    });
  });

  it("keeps a 1-star apartment review in the mean", () => {
    expect(
      honestRating([
        { rating: 1, about: "apartment" },
        { rating: 1, about: "tour" },
      ]),
    ).toEqual({
      honestRating: 1,
      honestCount: 1,
      excludedTour: 1,
      unclearCount: 0,
    });
  });

  it("returns null when the sample has no apartment reviews", () => {
    expect(honestRating([])).toEqual({
      honestRating: null,
      honestCount: 0,
      excludedTour: 0,
      unclearCount: 0,
    });

    expect(
      honestRating([
        { rating: 5, about: "unclear" },
        { rating: 2, about: "unclear" },
      ]),
    ).toEqual({
      honestRating: null,
      honestCount: 0,
      excludedTour: 0,
      unclearCount: 2,
    });

    expect(
      honestRating([
        { rating: 5, about: "tour" },
        { rating: 4, about: "unclear" },
      ]),
    ).toEqual({
      honestRating: null,
      honestCount: 0,
      excludedTour: 1,
      unclearCount: 1,
    });
  });

  it("returns the same result regardless of review order", () => {
    const expected = {
      honestRating: 2,
      honestCount: 1,
      excludedTour: 1,
      unclearCount: 1,
    };

    expect(
      honestRating([
        { rating: 2, about: "apartment" },
        { rating: 5, about: "tour" },
        { rating: 4, about: "unclear" },
      ]),
    ).toEqual(expected);

    expect(
      honestRating([
        { rating: 4, about: "unclear" },
        { rating: 5, about: "tour" },
        { rating: 2, about: "apartment" },
      ]),
    ).toEqual(expected);
  });

  it("ignores model-authored fields other than rating and about", () => {
    const withModelFields = [
      {
        rating: 5,
        about: "apartment" as const,
        text: "Lived here a year.",
        reason: "mentions living there",
        honestRating: 1,
      },
    ];

    expect(honestRating(withModelFields)).toEqual(
      honestRating([{ rating: 5, about: "apartment" }]),
    );
  });

  it("returns the result synchronously", () => {
    const result = honestRating([{ rating: 5, about: "apartment" }]);

    expect(result).toEqual({
      honestRating: 5,
      honestCount: 1,
      excludedTour: 0,
      unclearCount: 0,
    });
    expect(result).not.toBeInstanceOf(Promise);
  });
});
