export type LabeledReview = {
  rating: number;
  about: "tour" | "apartment" | "unclear";
};

export type HonestRatingResult = {
  honestRating: number | null;
  honestCount: number;
  excludedTour: number;
  unclearCount: number;
};

export function honestRating(reviews: LabeledReview[]): HonestRatingResult {
  let honestCount = 0;
  let ratingSum = 0;
  let excludedTour = 0;
  let unclearCount = 0;

  for (const review of reviews) {
    if (review.about === "apartment") {
      honestCount += 1;
      ratingSum += review.rating;
    } else if (review.about === "tour") {
      excludedTour += 1;
    } else if (review.about === "unclear") {
      unclearCount += 1;
    }
  }

  return {
    honestRating: honestCount === 0 ? null : ratingSum / honestCount,
    honestCount,
    excludedTour,
    unclearCount,
  };
}
