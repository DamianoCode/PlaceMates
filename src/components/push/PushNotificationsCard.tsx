"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  setNotificationPrefAction,
  subscribeToPushAction,
  unsubscribeFromPushAction,
} from "@/app/(app)/me/push-actions";
import type { NotificationKind } from "@/domain/push/service";

/**
 * Push subscription + per-event preference card. State machine:
 *
 *   unsupported          — browser doesn't have Notification / ServiceWorker
 *   denied               — user blocked permission; we can't recover, link
 *                          to browser settings
 *   not-subscribed       — supported, permission default/granted, but no
 *                          active subscription
 *   subscribed           — actively receiving
 *
 * Master toggle subscribes/unsubscribes; the three per-event toggles
 * stay editable even when not-subscribed (preferences survive
 * re-subscription so a user who turns off one type keeps that
 * preference forever).
 */
type PrefRow = {
  kind: NotificationKind;
  label: string;
  hint: string;
};

const PREF_ROWS: PrefRow[] = [
  {
    kind: "stopCompleted",
    label: "Odhaczenie stopu w planie",
    hint: "Asia odhaczyła Bosko w „Sobota w Zamościu”.",
  },
  {
    kind: "rating",
    label: "Ocena Twojego miejsca",
    hint: "Marek ocenił Bramę Spotkań na 4.5.",
  },
  {
    kind: "newPlace",
    label: "Nowe miejsce w grupie",
    hint: "Asia dodała kawiarnię „Piramida Smaku”.",
  },
  {
    kind: "photo",
    label: "Nowe zdjęcie",
    hint: "Marek dodał zdjęcie do „Bramy Spotkań”.",
  },
  {
    kind: "trip",
    label: "Nowy plan w grupie",
    hint: "Asia zaplanowała „Weekend w Krakowie”.",
  },
  {
    kind: "member",
    label: "Nowy członek grupy",
    hint: "Kasia dołączyła do grupy.",
  },
];

export function PushNotificationsCard({
  initialPrefs,
  vapidPublicKey,
}: {
  initialPrefs: Record<NotificationKind, boolean>;
  /** From server env (NEXT_PUBLIC_VAPID_PUBLIC_KEY). Empty when push
   *  is not configured server-side — we degrade gracefully. */
  vapidPublicKey: string;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unknown">(
    "unknown",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, startTransition] = useTransition();
  const [prefs, setPrefs] = useState(initialPrefs);

  // Detect support + current state on mount. queueMicrotask defers
  // the setState calls to satisfy react-compiler's
  // set-state-in-effect rule. navigator + Notification.permission
  // are browser-only so we read them inside the deferred callback.
  useEffect(() => {
    let abort = false;
    queueMicrotask(async () => {
      if (abort) return;
      const isSupported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;
      setSupported(isSupported);
      if (!isSupported) return;
      setPermission(Notification.permission);
      // Probe current subscription — granted permission doesn't
      // guarantee an active push subscription (user might have
      // unsubscribed via OS settings).
      try {
        const reg = await navigator.serviceWorker.ready;
        if (abort) return;
        const sub = await reg.pushManager.getSubscription();
        if (abort) return;
        setSubscribed(!!sub);
      } catch {
        /* SW not ready or rejected — leave subscribed=false */
      }
    });
    return () => {
      abort = true;
    };
  }, []);

  async function subscribe() {
    if (!vapidPublicKey) {
      toast.error("Powiadomienia są tymczasowo niedostępne.");
      return;
    }
    startTransition(async () => {
      try {
        // Permission first — if denied, can't proceed.
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") return;

        const reg = await navigator.serviceWorker.ready;
        // Re-use existing subscription if any — pushManager.subscribe
        // returns the existing one when the params match.
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });
        }
        const json = sub.toJSON() as {
          endpoint: string;
          keys: { p256dh: string; auth: string };
        };
        const res = await subscribeToPushAction(
          { endpoint: json.endpoint, keys: json.keys },
          navigator.userAgent || null,
        );
        if (res.ok) {
          setSubscribed(true);
          toast.success("Powiadomienia włączone.");
        } else {
          toast.error(res.error);
        }
      } catch (err) {
        console.error("[push] subscribe failed", err);
        toast.error("Nie udało się włączyć powiadomień.");
      }
    });
  }

  async function unsubscribe() {
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await unsubscribeFromPushAction(sub.endpoint);
        }
        setSubscribed(false);
        toast.success("Powiadomienia wyłączone.");
      } catch (err) {
        console.error("[push] unsubscribe failed", err);
        toast.error("Nie udało się wyłączyć powiadomień.");
      }
    });
  }

  function togglePref(kind: NotificationKind) {
    const next = !prefs[kind];
    // Optimistic flip — server action will revalidate /me on success.
    setPrefs((prev) => ({ ...prev, [kind]: next }));
    startTransition(async () => {
      const res = await setNotificationPrefAction(kind, next);
      if (!res.ok) {
        // Revert on failure.
        setPrefs((prev) => ({ ...prev, [kind]: !next }));
        toast.error(res.error);
      }
    });
  }

  // Don't render anything during SSR / before detection.
  if (supported === null) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl">
          <Bell size={18} /> Powiadomienia
        </CardTitle>
        <CardDescription>
          Push-notyfikacje na lockscreenie gdy coś dzieje się w grupie.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!supported ? (
          <p className="text-sm italic text-muted-foreground">
            Twoja przeglądarka nie wspiera powiadomień. Spróbuj na
            zainstalowanej PWA na telefonie.
          </p>
        ) : permission === "denied" ? (
          <p className="text-sm italic text-muted-foreground">
            Powiadomienia są zablokowane w ustawieniach przeglądarki.
            Odblokuj je tam, żeby je włączyć.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {subscribed ? "Powiadomienia włączone" : "Włącz powiadomienia"}
              </p>
              <p className="text-xs italic text-muted-foreground">
                {subscribed
                  ? "Otrzymujesz push'e na tym urządzeniu."
                  : "Włącz, żeby dostawać powiadomienia o aktywności w grupach."}
              </p>
            </div>
            <Button
              onClick={subscribed ? unsubscribe : subscribe}
              variant={subscribed ? "outline" : "default"}
              disabled={busy}
              className="flex-shrink-0"
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : subscribed ? (
                <>
                  <BellOff size={16} className="mr-1.5" />
                  Wyłącz
                </>
              ) : (
                <>
                  <Bell size={16} className="mr-1.5" />
                  Włącz
                </>
              )}
            </Button>
          </div>
        )}

        {/* Granular per-event toggles — editable even when not
         *  subscribed, so the user can pre-tune what they want
         *  before flipping the master switch. */}
        <div className="divide-y divide-border/40">
          {PREF_ROWS.map((row) => (
            <PrefToggle
              key={row.kind}
              label={row.label}
              hint={row.hint}
              checked={prefs[row.kind]}
              onChange={() => togglePref(row.kind)}
              disabled={busy}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PrefToggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
  disabled: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start justify-between gap-3 py-3",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        <span className="block text-xs italic text-muted-foreground">
          {hint}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
          disabled && "cursor-not-allowed",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

/** Convert URL-safe base64 (VAPID public key encoding) to a Uint8Array
 *  backed by an ArrayBuffer (not SharedArrayBuffer). TS/lib.dom's
 *  BufferSource requires the ArrayBuffer variant, so we allocate
 *  explicitly to match. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
