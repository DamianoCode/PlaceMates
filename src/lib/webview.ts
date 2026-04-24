export type WebViewKind =
  | "messenger"
  | "facebook"
  | "instagram"
  | "tiktok"
  | "linkedin"
  | "line"
  | "wechat"
  | "twitter"
  | "android-webview"
  | "ios-webview"
  | null;

const APP_LABEL: Record<Exclude<WebViewKind, null>, string> = {
  messenger: "Messenger",
  facebook: "aplikacji Facebook",
  instagram: "Instagrama",
  tiktok: "TikToka",
  linkedin: "LinkedIna",
  line: "LINE",
  wechat: "WeChat",
  twitter: "X (Twittera)",
  "android-webview": "przeglądarki w aplikacji",
  "ios-webview": "przeglądarki w aplikacji",
};

/**
 * Matches user-agents of common in-app browsers that wrap a link in
 * their own WebView. Google's OAuth explicitly refuses to authenticate
 * in these surfaces with a 403 disallowed_useragent — see
 * https://developers.google.com/identity/protocols/OAuth2UserAgent
 *
 * Called from the server (via `headers()`) so we can render the
 * warning banner immediately without a client-side flash.
 */
export function detectWebView(userAgent: string | null): WebViewKind {
  if (!userAgent) return null;

  // Named apps — order matters because Facebook's UA also contains "FBAN".
  if (userAgent.includes("FBAN/MessengerForiOS") || userAgent.includes("MessengerLiteForiOS")) {
    return "messenger";
  }
  if (/FBAV|FBAN|FBIOS/.test(userAgent)) return "facebook";
  if (userAgent.includes("Instagram")) return "instagram";
  if (userAgent.includes("LinkedInApp")) return "linkedin";
  if (userAgent.includes("Line/")) return "line";
  if (userAgent.includes("MicroMessenger")) return "wechat";
  if (/TikTok|musical_ly|ByteLocale/i.test(userAgent)) return "tiktok";
  if (/Twitter(?!bot)/.test(userAgent)) return "twitter";

  // Generic Android WebView: `; wv)` marker added by WebView.
  if (/; wv\)/.test(userAgent)) return "android-webview";

  // Generic iOS WebView: iPhone/iPad but NEITHER "Safari/" nor an
  // alternate browser marker (CriOS = Chrome, FxiOS = Firefox, EdgiOS = Edge).
  if (
    /iPhone|iPad|iPod/.test(userAgent) &&
    !/Safari\//.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS/.test(userAgent)
  ) {
    return "ios-webview";
  }

  return null;
}

export function webViewLabel(kind: Exclude<WebViewKind, null>): string {
  return APP_LABEL[kind];
}
