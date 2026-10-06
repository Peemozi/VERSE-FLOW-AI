import { StatusBar } from "@/components/layout/StatusBar";
import { TranscriptPanel } from "@/features/transcript/TranscriptPanel";
import { DetectionPanel } from "@/features/detection/DetectionPanel";
import { PreviewLivePanel } from "@/features/live/PreviewLivePanel";
import { AudioPanel } from "@/features/live/AudioPanel";
import { BibleSearchPanel } from "@/features/bible/BibleSearchPanel";
import { SettingsPanel } from "@/features/settings/SettingsPanel";
import { HistoryPanel } from "@/features/history/HistoryPanel";
import { useAppStore } from "@/stores/app-store";
import { useOperatorShortcuts } from "@/hooks/useOperatorShortcuts";

export function DashboardPage() {
  const error = useAppStore((s) => s.error);
  const loading = useAppStore((s) => s.loading);
  const view = useAppStore((s) => s.view);
  useOperatorShortcuts();

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

        {view === "history" ? (
          <HistoryPanel />
        ) : (
          <>
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

            <footer className="grid gap-3 border-t border-border/40 pt-3 lg:grid-cols-2">
              <SettingsPanel />
              <AudioPanel />
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
