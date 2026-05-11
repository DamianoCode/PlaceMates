/**
 * Authentication provider interface. The rest of the app depends only on
 * this; swapping Supabase for Better-Auth/Lucia means implementing it.
 */

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export type SignInResult =
  | { ok: true; user: AuthUser }
  | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

export interface AuthProvider {
  getUser(): Promise<AuthUser | null>;
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  signUpWithPassword(
    email: string,
    password: string,
    displayName: string,
  ): Promise<SignInResult>;
  signInWithGoogle(redirectTo: string): Promise<{ url: string } | { error: string }>;
  signOut(): Promise<void>;
  /**
   * Triggers a password-reset email containing a magic link that
   * lands on `redirectTo` (typically `/auth/callback?next=/reset-password`).
   * The link sets a temporary session — the next page can call
   * `updatePassword` to finish the flow.
   *
   * Always returns ok=true to avoid leaking which emails are
   * registered (account enumeration); errors are logged server-side.
   */
  requestPasswordReset(email: string, redirectTo: string): Promise<SimpleResult>;
  /**
   * Updates the currently-authenticated user's password. Requires an
   * active session (set by either normal login or a recovery magic
   * link click).
   */
  updatePassword(newPassword: string): Promise<SimpleResult>;
}
