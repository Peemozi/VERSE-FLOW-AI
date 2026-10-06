import { Mic, Radio, Database, WifiOff } from "lucide-react";
import { useAppStore } from "@/stores/app-store";
import { APP_NAME } from "@shared/constants/app";

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "warn" | "off" | "live";
}) {
  const tones = {
    ok: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    warn: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    off: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
    live: "bg-live/20 text-rose-100 ring-live/40 animate-pulse",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ring-1 ${tones[tone]}`}>
      {label}
    </span>
  );
}

export function StatusBar() {
  const status = useAppStore((s) => s.status);
  const live = useAppStore((s) => s.live);

  return (
    <header className="flex items-center justify-between border-b border-border/50 bg-black/20 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/20 text-primary">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
          <p className="text-xs text-muted-foreground">Operator dashboard · Phase 1–3</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label={status?.bibleReady ? "Bible ready" : "Bible not imported"}
          tone={status?.bibleReady ? "ok" : "warn"}
        />
        <StatusPill label="STT unavailable" tone="off" />
        <StatusPill label="vMix disconnected" tone="off" />
        {live ? <StatusPill label="LIVE" tone="live" /> : null}
        <span className="ml-2 hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          <Database className="h-3.5 w-3.5" />
          {status?.dbReady ? "SQLite" : "DB…"}
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
          <Mic className="h-3.5 w-3.5" />
          Listen later
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:inline-flex">
          <WifiOff className="h-3.5 w-3.5" />
          Offline Bible OK
        </span>
      </div>
    </header>
  );
}
