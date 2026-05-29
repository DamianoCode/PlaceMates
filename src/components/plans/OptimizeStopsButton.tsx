"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Bike,
  Car,
  Check,
  Footprints,
  Loader2,
  Mountain,
  Route as RouteIcon,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer } from "vaul";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/map/category-icons";
import { cn } from "@/lib/utils";
import { formatDistance, formatDuration } from "@/lib/format-route";
import {
  previewOptimizeOrderAction,
  reorderStopsAction,
} from "@/app/(app)/plans/actions";
import type { OptimizationPreview } from "@/domain/trips/optimization";
import type { RoutingProfile } from "@/infra/routing/ors";

type SavingsStats = {
  /** Dodatnia = krócej; ujemna = dłużej; null = brak danych. */
  distanceDeltaM: number | null;
  durationDeltaS: number | null;
  proposedDistanceM: number | null;
  proposedDurationS: number | null;
  currentDistanceM: number | null;
  currentDurationS: number | null;
  /** Co najmniej jeden wymiar pokazuje oszczędność (>0). */
  anySaving: boolean;
  /** Co najmniej jeden wymiar pokazuje regresję (<0). */
  anyWorse: boolean;
};

/** Centralna kalkulacja diffu — używana zarówno w UI (StatsDiff,
 *  CTA label) jak i w toast po Apply. Wszystkie miejsca które chcą
 *  „o ile krócej" muszą przejść przez tę funkcję, żeby progi (>0)
 *  i interpretacja braku danych były spójne. */
function computeSavings(preview: OptimizationPreview): SavingsStats {
  const proposedDistanceM =
    preview.proposedDistanceM > 0 ? preview.proposedDistanceM : null;
  const proposedDurationS =
    preview.proposedDurationS > 0 ? preview.proposedDurationS : null;
  const currentDistanceM =
    preview.currentDistanceM !== null && preview.currentDistanceM > 0
      ? preview.currentDistanceM
      : null;
  const currentDurationS =
    preview.currentDurationS !== null && preview.currentDurationS > 0
      ? preview.currentDurationS
      : null;

  const distanceDeltaM =
    proposedDistanceM !== null && currentDistanceM !== null
      ? currentDistanceM - proposedDistanceM
      : null;
  const durationDeltaS =
    proposedDurationS !== null && currentDurationS !== null
      ? currentDurationS - proposedDurationS
      : null;

  return {
    distanceDeltaM,
    durationDeltaS,
    proposedDistanceM,
    proposedDurationS,
    currentDistanceM,
    currentDurationS,
    anySaving:
      (distanceDeltaM !== null && distanceDeltaM > 0) ||
      (durationDeltaS !== null && durationDeltaS > 0),
    anyWorse:
      (distanceDeltaM !== null && distanceDeltaM < 0) ||
      (durationDeltaS !== null && durationDeltaS < 0),
  };
}

const PROFILE_OPTIONS: ReadonlyArray<{
  value: RoutingProfile;
  label: string;
  icon: typeof Car;
}> = [
  { value: "driving-car", label: "Auto", icon: Car },
  { value: "cycling-regular", label: "Rower", icon: Bike },
  { value: "foot-walking", label: "Pieszo", icon: Footprints },
  { value: "foot-hiking", label: "Szlak", icon: Mountain },
];

/** Współdzielony z TripMapView — żeby preferencja profilu była
 *  konsystentna między widokiem Mapa a optymalizatorem. */
const PROFILE_STORAGE_KEY = "pm.trip.routing-profile";

/**
 * Przycisk + Vaul drawer do "Optymalizuj kolejność".
 *
 * Flow:
 *   1. Initial state — profile selector + opis "co się stanie" + CTA.
 *   2. Preview — loading → wynik z VROOM (stats diff + nowa kolejność).
 *   3. Confirm — "Zastosuj" woła reorderStopsAction (reuse — invaliduje
 *      trip_routes pod spodem).
 *
 * Disabled gdy stopCount < 3 — z mniej niż 3 stopami optymalizować
 * nie ma czego (anchor + ≥2 jobs to minimum sensowne).
 */
export function OptimizeStopsButton({
  tripId,
  stopCount,
}: {
  tripId: string;
  stopCount: number;
}) {
  const [open, setOpen] = useState(false);
  const disabled = stopCount < 3;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        aria-label={
          disabled
            ? "Optymalizuj kolejność (wymaga ≥3 stopów)"
            : "Optymalizuj kolejność"
        }
        title={
          disabled
            ? "Optymalizacja wymaga ≥3 stopów"
            : "Optymalizuj kolejność"
        }
        className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
      >
        <Sparkles size={16} />
      </button>

      {open && (
        <OptimizeDrawer
          open={open}
          onClose={() => setOpen(false)}
          tripId={tripId}
        />
      )}
    </>
  );
}

function OptimizeDrawer({
  open,
  onClose,
  tripId,
}: {
  open: boolean;
  onClose: () => void;
  tripId: string;
}) {
  const [profile, setProfile] = useState<RoutingProfile>("driving-car");
  // Wczytaj zapamiętany profil z localStorage (ten sam klucz co Mapa,
  // żeby preferencja była spójna). Czytamy w effect bo SSR nie ma
  // dostępu do localStorage. queueMicrotask + abort flag żeby
  // setState nie leciał synchronicznie w body effectu — to lint rule
  // (react-hooks/set-state-in-effect) który łapie cascading renders.
  useEffect(() => {
    let abort = false;
    queueMicrotask(() => {
      if (abort) return;
      try {
        const stored = window.localStorage.getItem(
          PROFILE_STORAGE_KEY,
        ) as RoutingProfile | null;
        if (stored && PROFILE_OPTIONS.some((p) => p.value === stored)) {
          setProfile(stored);
        }
      } catch {
        /* private mode / disabled storage — zostaw default */
      }
    });
    return () => {
      abort = true;
    };
  }, []);

  // Trójstanowy widok: 'idle' (formularz), 'loading' (preview leci),
  // 'preview' (wynik gotowy do zatwierdzenia).
  const [preview, setPreview] = useState<OptimizationPreview | null>(null);
  const [previewing, startPreviewing] = useTransition();
  const [applying, startApplying] = useTransition();

  function handlePreview() {
    setPreview(null);
    startPreviewing(async () => {
      const res = await previewOptimizeOrderAction(tripId, profile);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview(res.data);
    });
  }

  function handleApply() {
    if (!preview) return;
    startApplying(async () => {
      const res = await reorderStopsAction(tripId, preview.fullOrderedStopIds);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      // Toast formułowany na podstawie kierunku każdego wymiaru.
      // Mixed („krócej dystans / dłużej czas") pokazujemy oba człony
      // — userowi należy się prawda nawet po kliknięciu „Zastosuj
      // mimo to".
      const stats = computeSavings(preview);
      const parts: string[] = [];
      if (stats.distanceDeltaM !== null && stats.distanceDeltaM > 0) {
        parts.push(`krócej o ${formatDistance(stats.distanceDeltaM)}`);
      } else if (
        stats.distanceDeltaM !== null &&
        stats.distanceDeltaM < 0
      ) {
        parts.push(`dłużej o ${formatDistance(-stats.distanceDeltaM)}`);
      }
      if (stats.durationDeltaS !== null && stats.durationDeltaS > 0) {
        parts.push(`krócej o ${formatDuration(stats.durationDeltaS)}`);
      } else if (
        stats.durationDeltaS !== null &&
        stats.durationDeltaS < 0
      ) {
        parts.push(`dłużej o ${formatDuration(-stats.durationDeltaS)}`);
      }
      if (parts.length > 0) {
        toast.success(`Zoptymalizowano — ${parts.join(", ")}.`);
      } else {
        toast.success("Zapisano nową kolejność.");
      }
      onClose();
    });
  }

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-3xl border-t border-x bg-background outline-none pb-[env(safe-area-inset-bottom)] sm:mx-auto sm:max-w-md"
          aria-describedby={undefined}
        >
          <Drawer.Handle className="my-2.5 h-1.5 w-10 shrink-0 rounded-full bg-muted" />

          <div className="border-b border-border/60 px-5 pb-4">
            <Drawer.Title className="flex items-center gap-2 font-display text-xl leading-tight">
              <Sparkles
                size={18}
                className="text-primary"
                aria-hidden
              />
              Optymalizuj kolejność
            </Drawer.Title>
            <Drawer.Description className="mt-0.5 text-xs italic text-muted-foreground">
              {preview
                ? "Sprawdź propozycję i zastosuj, jeśli pasuje."
                : "ORS znajdzie najkrótszą trasę między stopami."}
            </Drawer.Description>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {/* Profile selector — widoczny zawsze, w preview disabled */}
            <ProfilePills
              value={profile}
              onChange={setProfile}
              disabled={previewing || applying || preview !== null}
            />

            {!preview && !previewing && (
              <IdleHelp />
            )}

            {previewing && <PreviewLoading />}

            {preview && !previewing && (
              <PreviewResult preview={preview} />
            )}

            <div className="mt-auto flex gap-2 pt-3">
              {!preview ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={previewing}
                    className="flex-1"
                  >
                    Anuluj
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePreview}
                    disabled={previewing}
                    className="flex-1"
                  >
                    {previewing ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Liczę…
                      </>
                    ) : (
                      "Pokaż propozycję"
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPreview(null)}
                    disabled={applying}
                    className="flex-1"
                  >
                    Wstecz
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApply}
                    disabled={applying || preview.unchanged}
                    className="flex-1"
                  >
                    {applying ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Zapisuję…
                      </>
                    ) : preview.unchanged ? (
                      "Bez zmian"
                    ) : computeSavings(preview).anyWorse ? (
                      "Zastosuj mimo to"
                    ) : (
                      "Zastosuj"
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function ProfilePills({
  value,
  onChange,
  disabled,
}: {
  value: RoutingProfile;
  onChange: (p: RoutingProfile) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Profil trasowania
      </p>
      <div
        role="radiogroup"
        aria-label="Profil trasowania"
        className="grid grid-cols-4 gap-1 rounded-full border border-border/60 bg-muted/40 p-1"
      >
        {PROFILE_OPTIONS.map(({ value: v, label, icon: Icon }) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(v)}
            disabled={disabled}
            className={cn(
              "inline-flex h-9 items-center justify-center gap-1 rounded-full px-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              value === v
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={13} aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function IdleHelp() {
  return (
    <div className="space-y-3 rounded-2xl border border-dashed bg-muted/20 p-4">
      <p className="text-sm text-foreground/90">
        Ustawimy kolejność tak, żeby trasa po drogach była najkrótsza.
      </p>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex gap-2">
          <span aria-hidden className="text-primary/70">
            ·
          </span>
          <span>
            Stopy <strong>ukończone</strong> zostają na początku, w tej
            samej kolejności co teraz.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-primary/70">
            ·
          </span>
          <span>
            <strong>Punkt startowy</strong> (pierwszy nieukończony albo
            ostatni odhaczony) nie zmienia pozycji.
          </span>
        </li>
        <li className="flex gap-2">
          <span aria-hidden className="text-primary/70">
            ·
          </span>
          <span>
            Reszta stopów zostanie przeplanowana pod najkrótszą trasę.
          </span>
        </li>
      </ul>
    </div>
  );
}

function PreviewLoading() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/20 px-6 py-10 text-center">
      <Loader2
        size={28}
        strokeWidth={1.5}
        className="animate-spin text-primary"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">
        Solver szuka najkrótszej trasy…
      </p>
    </div>
  );
}

function PreviewResult({ preview }: { preview: OptimizationPreview }) {
  if (preview.unchanged) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border bg-emerald-50/40 p-4 dark:bg-emerald-950/20">
        <span
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        >
          <Check size={20} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base leading-tight">
            Trasa jest już optymalna
          </p>
          <p className="mt-0.5 text-xs italic text-muted-foreground">
            Nie znaleziono krótszej kolejności dla tego profilu.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <StatsDiff preview={preview} />
      <NewOrderList proposed={preview.proposedOrder} />
    </div>
  );
}

function StatsDiff({ preview }: { preview: OptimizationPreview }) {
  const stats = computeSavings(preview);
  const {
    distanceDeltaM,
    durationDeltaS,
    proposedDistanceM,
    proposedDurationS,
    currentDistanceM,
    currentDurationS,
    anySaving,
    anyWorse,
  } = stats;

  // Procent oszczędności obliczamy tylko dla dystansu i tylko gdy
  // oba (current > 0 i delta > 0) — % dla czasu mniej intuicyjny
  // (user łatwiej rozumie „6 min mniej" niż „-25%").
  const savedDistancePct =
    distanceDeltaM !== null && distanceDeltaM > 0 && currentDistanceM !== null
      ? Math.round((distanceDeltaM / currentDistanceM) * 100)
      : null;

  return (
    <div className="space-y-2 rounded-2xl border bg-card p-4">
      {(currentDistanceM !== null || currentDurationS !== null) && (
        <StatLine label="Aktualna" muted distance={currentDistanceM} duration={currentDurationS} />
      )}
      <StatLine
        label="Po optymalizacji"
        emphasized
        distance={proposedDistanceM}
        duration={proposedDurationS}
      />

      {/* Diff: jeden wiersz na wymiar, każdy z własnym kolorem i
       *  ikoną. Mixed (np. krócej w km, dłużej w min) widoczne wprost
       *  — nie zatajamy regresji za pozytywnym agregatem. */}
      {(distanceDeltaM !== null || durationDeltaS !== null) && (
        <div className="space-y-1 border-t border-border/60 pt-2">
          {distanceDeltaM !== null && distanceDeltaM !== 0 && (
            <DeltaLine
              kind={distanceDeltaM > 0 ? "saving" : "worse"}
              label={
                distanceDeltaM > 0
                  ? "Krócej o"
                  : "Dłużej o"
              }
              value={formatDistance(Math.abs(distanceDeltaM))}
              pct={
                distanceDeltaM > 0 && savedDistancePct !== null
                  ? `-${savedDistancePct}%`
                  : null
              }
            />
          )}
          {durationDeltaS !== null && durationDeltaS !== 0 && (
            <DeltaLine
              kind={durationDeltaS > 0 ? "saving" : "worse"}
              label={
                durationDeltaS > 0
                  ? "Krócej o"
                  : "Dłużej o"
              }
              value={formatDuration(Math.abs(durationDeltaS))}
            />
          )}
        </div>
      )}

      {/* Komunikat tylko gdy obie metryki regresja albo brak savings.
       *  W mixed (jeden wymiar lepszy, drugi gorszy) nie wyświetlamy —
       *  DeltaLine'y same tłumaczą sytuację. */}
      {!anySaving && anyWorse && (
        <div className="border-t border-border/60 pt-2 text-xs italic text-muted-foreground">
          Proponowana trasa nie jest krótsza — możesz mimo wszystko
          zastosować, jeśli wolisz tę kolejność.
        </div>
      )}
    </div>
  );
}

/** Pojedynczy wiersz „Aktualna / Po optymalizacji". Hopuje brak
 *  jednego z wymiarów (np. distance niedostępny) — nie renderuje
 *  separatora wtedy. */
function StatLine({
  label,
  distance,
  duration,
  muted = false,
  emphasized = false,
}: {
  label: string;
  distance: number | null;
  duration: number | null;
  muted?: boolean;
  emphasized?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 text-sm",
        muted && "text-muted-foreground",
      )}
    >
      <span className={emphasized ? "font-medium text-foreground" : ""}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono tabular-nums",
          emphasized && "font-semibold",
        )}
      >
        {distance !== null && <>{formatDistance(distance)}</>}
        {distance !== null && duration !== null && (
          <span aria-hidden> · </span>
        )}
        {duration !== null && <>{formatDuration(duration)}</>}
        {distance === null && duration === null && (
          <span className="italic text-muted-foreground">brak danych</span>
        )}
      </span>
    </div>
  );
}

/** Wiersz różnicy per wymiar. `kind` decyduje o kolorze i ikonie. */
function DeltaLine({
  kind,
  label,
  value,
  pct,
}: {
  kind: "saving" | "worse";
  label: string;
  value: string;
  pct?: string | null;
}) {
  const isSaving = kind === "saving";
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-sm",
        isSaving
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-amber-700 dark:text-amber-400",
      )}
    >
      {isSaving ? (
        <TrendingDown size={14} aria-hidden />
      ) : (
        <TrendingUp size={14} aria-hidden />
      )}
      <span>
        {label}{" "}
        <strong className="font-semibold">{value}</strong>
        {pct && (
          <span
            className={cn(
              "ml-1",
              isSaving
                ? "text-emerald-700/80 dark:text-emerald-400/80"
                : "text-amber-700/80 dark:text-amber-400/80",
            )}
          >
            ({pct})
          </span>
        )}
      </span>
    </div>
  );
}

function NewOrderList({ proposed }: { proposed: OptimizationPreview["proposedOrder"] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        Nowa kolejność
      </p>
      <ol className="space-y-1.5 rounded-2xl border bg-card p-2">
        {proposed.map((s, i) => (
          <li
            key={s.stopId}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm",
              s.isCompleted && "opacity-60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
                s.isCompleted
                  ? "bg-emerald-500 text-white"
                  : s.isAnchor
                    ? "bg-amber-500 text-white"
                    : "bg-primary text-primary-foreground",
              )}
            >
              {s.isCompleted ? (
                <Check size={12} />
              ) : (
                i + 1
              )}
            </span>
            <CategoryIcon
              slug={s.placeCategorySlug}
              size={13}
              aria-hidden
              className="flex-shrink-0 text-muted-foreground"
            />
            <span className="min-w-0 flex-1 truncate">{s.placeName}</span>
            {s.isAnchor && !s.isCompleted && (
              <span
                className="flex-shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                aria-label="Punkt startowy — bez zmiany pozycji"
              >
                Start
              </span>
            )}
          </li>
        ))}
      </ol>
      <p className="px-1 text-[11px] italic text-muted-foreground/80">
        <span className="inline-flex items-center gap-1">
          <RouteIcon size={11} aria-hidden /> Numerujemy od 1 w nowej
          kolejności.
        </span>
      </p>
    </div>
  );
}

