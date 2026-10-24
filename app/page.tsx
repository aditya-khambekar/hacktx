import type { Metadata } from "next";
import { LandingPage } from "@/components/unlisted/landing-page";

export const metadata: Metadata = {
  title: "Unlisted · A clearer way home",
  description: "Compare West Campus apartments by rent, monthly fees, move-in costs, and the walk to the UT Tower.",
};

export default function Home() {
  return <LandingPage />;
}
