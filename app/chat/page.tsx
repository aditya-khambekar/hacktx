import { Workspace } from "@/components/unlisted/workspace";
import { getLandingSession } from "@/lib/auth";

export default async function ChatPage() {
  const session = await getLandingSession();
  const headerUser = session?.user
    ? { name: session.user.name, email: session.user.email, image: session.user.image }
    : null;
  return <Workspace user={headerUser} />;
}
