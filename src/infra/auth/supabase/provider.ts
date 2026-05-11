import type { SupabaseClient, User } from "@supabase/supabase-js";
import type {
  AuthProvider,
  AuthUser,
  SignInResult,
  SimpleResult,
} from "../provider";

function toAuthUser(u: User): AuthUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const display =
    typeof meta.display_name === "string" && meta.display_name.length > 0
      ? meta.display_name
      : (u.email ?? "").split("@")[0] || "user";
  const avatar = typeof meta.avatar_url === "string" ? meta.avatar_url : null;
  return {
    id: u.id,
    email: u.email ?? "",
    displayName: display,
    avatarUrl: avatar,
  };
}

export function createSupabaseAuthProvider(
  client: SupabaseClient,
): AuthProvider {
  return {
    async getUser() {
      const { data, error } = await client.auth.getUser();
      if (error || !data.user) return null;
      return toAuthUser(data.user);
    },

    async signInWithPassword(email, password): Promise<SignInResult> {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.user) {
        return { ok: false, error: error?.message ?? "Sign-in failed" };
      }
      return { ok: true, user: toAuthUser(data.user) };
    },

    async signUpWithPassword(email, password, displayName): Promise<SignInResult> {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error || !data.user) {
        return { ok: false, error: error?.message ?? "Sign-up failed" };
      }
      return { ok: true, user: toAuthUser(data.user) };
    },

    async signInWithGoogle(redirectTo) {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error || !data.url) {
        return { error: error?.message ?? "OAuth init failed" };
      }
      return { url: data.url };
    },

    async signOut() {
      await client.auth.signOut();
    },

    async requestPasswordReset(email, redirectTo): Promise<SimpleResult> {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      // We deliberately don't propagate "user not found" — would let
      // anyone enumerate registered emails. Just log and return ok.
      if (error) {
        console.error("[auth] resetPasswordForEmail failed:", error.message);
      }
      return { ok: true };
    },

    async updatePassword(newPassword): Promise<SimpleResult> {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },
  };
}
