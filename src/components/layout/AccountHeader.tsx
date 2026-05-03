"use client";

import { useActionState, useEffect, useRef } from "react";
import { Camera, LogOut, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CompassMark } from "@/components/brand/CompassMark";
import { signOutAction } from "@/app/(auth)/actions";
import {
  removeAvatarAction,
  uploadAvatarAction,
  type AvatarState,
} from "@/app/(app)/me/avatar-actions";
import { compressImage } from "@/lib/compress-image";

export function AccountHeader({
  displayName,
  email,
  avatarUrl,
}: {
  displayName: string;
  email: string;
  avatarUrl: string | null;
}) {
  const initials = (displayName || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Compressed avatar held in a ref because no rendering depends on
  // it — only the form-action wrapper reads it once on submit.
  const preparedAvatarRef = useRef<File | null>(null);
  const [uploadState, uploadAction, uploading] = useActionState<AvatarState, FormData>(
    uploadAvatarAction,
    null,
  );
  const [removeState, removeAction, removing] = useActionState<AvatarState, FormData>(
    removeAvatarAction,
    null,
  );

  // Surface server-action errors via toast without re-firing per render.
  useEffect(() => {
    if (uploadState && "error" in uploadState) toast.error(uploadState.error);
  }, [uploadState]);
  useEffect(() => {
    if (removeState && "error" in removeState) toast.error(removeState.error);
  }, [removeState]);

  return (
    <header className="relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-4">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-6 -right-6 text-primary/20"
      >
        <CompassMark size={120} />
      </span>
      <form
        ref={formRef}
        // Submit wrapper swaps the FormData "avatar" entry with the
        // compressed file from the ref, sidestepping the DataTransfer
        // / input.files mutation that's flaky on iOS Safari.
        action={async (formData) => {
          if (!preparedAvatarRef.current) return;
          formData.set(
            "avatar",
            preparedAvatarRef.current,
            preparedAvatarRef.current.name,
          );
          return uploadAction(formData);
        }}
        className="relative flex-shrink-0"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const picked = e.target.files?.[0];
            if (!picked) return;
            // Avatar uploads come from the same camera roll as place
            // photos. Compress aggressively — the avatar only ever
            // renders at 64-px in the UI.
            const { file } = await compressImage(picked, {
              maxSizeMB: 0.5,
              maxWidthOrHeight: 512,
            });
            preparedAvatarRef.current = file;
            formRef.current?.requestSubmit();
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          aria-label="Zmień zdjęcie profilowe"
          className="group relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/20 font-display text-2xl font-semibold text-primary transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span aria-hidden>{initials}</span>
          )}
          <span
            className="absolute inset-0 flex items-center justify-center bg-foreground/40 text-background opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden
          >
            <Camera size={20} />
          </span>
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <h2 className="font-display text-2xl leading-tight">{displayName}</h2>
        <p className="truncate text-sm italic text-muted-foreground">{email}</p>
        {avatarUrl && (
          <form action={removeAction} className="mt-1">
            <button
              type="submit"
              disabled={removing}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <X size={12} />
              {removing ? "Usuwam…" : "Usuń zdjęcie"}
            </button>
          </form>
        )}
      </div>

      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Wyloguj"
          title="Wyloguj"
        >
          <LogOut size={18} />
        </Button>
      </form>
    </header>
  );
}
