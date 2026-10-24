type RatedReview = {
  rating: number;
  about: "tour" | "apartment" | "unclear";
};

export function honestRating(reviews: readonly RatedReview[]) {
  let sum = 0;
  let honestCount = 0;
  let excludedTour = 0;
  let unclearCount = 0;

  for (const review of reviews) {
    if (review.about === "apartment") {
      sum += review.rating;
      honestCount += 1;
    } else if (review.about === "tour") {
      excludedTour += 1;
    } else {
      unclearCount += 1;
    }
  }

  return {
    honestRating: honestCount === 0 ? null : sum / honestCount,
    honestCount,
    excludedTour,
    unclearCount,
  };
}
