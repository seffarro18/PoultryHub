/**
 * Supabase's error objects (PostgrestError, AuthError, StorageError, ...)
 * are plain objects with a string `.message` — none of them extend the
 * native `Error` class, so `err instanceof Error` is always false for a
 * real Supabase failure. Every catch block across this app used to fall
 * back to a generic "Failed to..." string because of exactly that check,
 * silently discarding the actual database/auth error message. This checks
 * for a usable `.message` on anything error-shaped, not just real `Error`
 * instances, before giving up and using the fallback.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
