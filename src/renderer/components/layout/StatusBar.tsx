import { Mic, Radio, Database, WifiOff, History } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function sttTone(status: string | undefined): "ok" | "warn" | "off" | "live" {
  switch (status) {
    case "listening":
      return "live";
    case "reconnecting":
    case "error":
      return "warn";
    case "idle":
      return "ok";
    default:
      return "off";
  }
}

export function StatusBar() {
  const status = useAppStore((s) => s.status);
  const sttStatus = useAppStore((s) => s.sttStatus);
  const live = useAppStore((s) => s.live);
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const mode = useAppStore((s) => s.settings.detection.mode);
  const clearLive = useAppStore((s) => s.clearLive);

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border/50 bg-black/20 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/20 text-primary">
          <Radio className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
          <p className="text-xs text-muted-foreground">Operator dashboard · Phase 1–6</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StatusPill
          label={status?.bibleReady ? "Bible ready" : "Bible not imported"}
          tone={status?.bibleReady ? "ok" : "warn"}
        />
        <StatusPill label={`STT ${sttStatus}`} tone={sttTone(sttStatus)} />
        <StatusPill
          label={`vMix ${status?.vmixStatus ?? "disconnected"}`}
          tone={
            status?.vmixStatus === "connected"
              ? "ok"
              : status?.vmixStatus === "error"
                ? "warn"
                : "off"
          }
        />
        <StatusPill label={mode} tone={mode === "automatic" ? "warn" : "ok"} />
        {live ? <StatusPill label="LIVE" tone="live" /> : null}
        <Button size="sm" variant="destructive" onClick={() => void clearLive()}>
          Clear Live
        </Button>
        <Button
          size="sm"
          variant={view === "history" ? "default" : "outline"}
          onClick={() => setView(view === "history" ? "dashboard" : "history")}
        >
          <History className="h-4 w-4" />
          History
        </Button>
        <span className="ml-1 hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
          <Database className="h-3.5 w-3.5" />
          {status?.dbReady ? "SQLite" : "DB…"}
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground md:inline-flex">
          <Mic className="h-3.5 w-3.5" />
          {status?.sttCredentialsConfigured ? "Creds set" : "No STT creds"}
        </span>
        <span className="hidden items-center gap-1 text-xs text-muted-foreground lg:inline-flex">
          <WifiOff className="h-3.5 w-3.5" />
          Offline Bible OK
        </span>
      </div>
    </header>
  );
}
