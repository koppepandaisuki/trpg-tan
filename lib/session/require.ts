import "server-only";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser, type CurrentUser } from "./get-user";

/**
 * Auth/Role guards for Server Components and Server Actions.
 *
 * Behavior:
 *   - Not signed in            -> redirect to /login?next=<current path>
 *   - Signed in, missing role  -> redirect to /403
 *
 * The current path is read from the x-pathname header set by middleware,
 * with a safe fallback to "/".
 */

function currentPath(): string {
  const h = headers();
  return h.get("x-pathname") ?? "/";
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(currentPath())}`);
  }
  return user;
}

export async function requireCreator(): Promise<CurrentUser> {
  const user = await requireUser();
  // admin is allowed to enter creator screens (confirmed in Phase 3 design)
  if (!user.isCreator && !user.isAdmin) {
    redirect("/403");
  }
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) {
    redirect("/403");
  }
  return user;
}
