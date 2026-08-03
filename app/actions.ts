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
  const username = normalizeLogin(formData.get("username"));
  if (!username) return;

  redirect(`/u/${encodeURIComponent(username)}`);
}

/** Send the profile page's "Compare with" form to the comparison route. */
export async function compareUsers(formData: FormData) {
  const username = normalizeLogin(formData.get("username"));
  const other = normalizeLogin(formData.get("otherUsername"));
  if (!username || !other) return;

  redirect(
    `/u/${encodeURIComponent(username)}/compare/${encodeURIComponent(other)}`,
  );
}

/** Tolerate a pasted "@handle"; anything else is left for GitHub to reject as a 404. */
function normalizeLogin(value: FormDataEntryValue | null): string {
  return String(value ?? "")
    .trim()
    .replace(/^@/, "");
}
