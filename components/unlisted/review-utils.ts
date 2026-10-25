import type { ApartmentProfile } from "./types";
export type ReviewFilter = "all" | "critical" | "positive";
export function filterReviews(reviews: ApartmentProfile["reviews"], filter: ReviewFilter, keyword: string) {
  const query = keyword.trim().toLocaleLowerCase();
  return reviews.filter((review) =>
    (filter === "all" || (filter === "critical" ? review.rating <= 2 : review.rating >= 4)) &&
    (!query || review.text.toLocaleLowerCase().includes(query))
  ).sort((a, b) => filter === "critical" ? a.rating - b.rating : filter === "positive" ? b.rating - a.rating : 0);
}
