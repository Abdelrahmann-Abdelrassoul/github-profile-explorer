"use server";

import { redirect } from "next/navigation";

/**
 * Search submit handler.
 *
 * A Server Action rather than a client component so the form works without JavaScript.
 * `next/form` was not used here: it submits to a query string, but we navigate to a
 * path segment (`/u/{username}`).
 */
export async function searchUser(formData: FormData) {
  // Tolerate a pasted "@handle" — anything else is left for GitHub to reject as 404.
  const username = String(formData.get("username") ?? "")
    .trim()
    .replace(/^@/, "");

  if (!username) return;

  redirect(`/u/${encodeURIComponent(username)}`);
}
