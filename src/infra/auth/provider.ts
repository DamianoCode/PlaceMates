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
}
