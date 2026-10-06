import { StatusBar } from "@/components/layout/StatusBar";
import { TranscriptPanel } from "@/features/transcript/TranscriptPanel";
import { DetectionPanel } from "@/features/detection/DetectionPanel";
import { PreviewLivePanel } from "@/features/live/PreviewLivePanel";
import { BibleSearchPanel } from "@/features/bible/BibleSearchPanel";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { useAppStore } from "@/stores/app-store";

export function DashboardPage() {
  const error = useAppStore((s) => s.error);
  const loading = useAppStore((s) => s.loading);

  return (
    <div className="flex min-h-screen flex-col bg-app">
      <StatusBar />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 p-3 md:p-4">
        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
            {error}
          </div>
        ) : null}
        {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}

        <div className="grid flex-1 gap-3 lg:grid-cols-[1.1fr_1.1fr_0.9fr]">
          <div className="flex min-h-[280px] flex-col gap-3">
            <TranscriptPanel />
            <BibleSearchPanel />
          </div>
          <div className="min-h-[280px]">
            <DetectionPanel />
          </div>
          <div className="min-h-[280px]">
            <PreviewLivePanel />
          </div>
        </div>

        <footer className="grid gap-3 border-t border-border/40 pt-3 md:grid-cols-[1.4fr_1fr]">
          <SettingsPanel />
          <div className="rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
            <p className="font-display text-sm font-semibold text-foreground">Session / Audio / vMix</p>
            <p className="mt-1">
              Bottom status strip placeholders for audio levels, vMix latency, and session controls — wired in Phases
              4–6.
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
