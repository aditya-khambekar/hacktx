import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace · Unlisted",
  description: "Compare West Campus apartments: rent, monthly fees, and move-in costs side by side.",
};

export default function WorkspaceLayout({ children }: LayoutProps<"/workspace">) {
  return <div className="flex min-h-full flex-1 flex-col bg-paper font-sans text-ink">{children}</div>;
}
