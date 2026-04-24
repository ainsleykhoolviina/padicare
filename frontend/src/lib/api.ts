import { auth } from "./firebase";

/**
 * Wrapper around fetch that automatically adds the Firebase ID token
 * as a Bearer token in the Authorization header.
 */
export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);

  if (auth?.currentUser) {
    const token = await auth.currentUser.getIdToken();
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...options, headers });
}
