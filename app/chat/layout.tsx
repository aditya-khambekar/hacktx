import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard · Unlisted",
  description: "Find apartments, compare fees and resident reviews, and talk through your options.",
};

export default function ChatLayout({ children }: LayoutProps<"/chat">) {
  return <div className="flex min-h-full flex-1 flex-col bg-paper font-sans text-ink">{children}</div>;
}
