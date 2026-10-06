import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";

export function PreviewLivePanel() {
  const preview = useAppStore((s) => s.preview);
  const live = useAppStore((s) => s.live);
  const queue = useAppStore((s) => s.queue);
  const sendPreviewToLive = useAppStore((s) => s.sendPreviewToLive);
  const clearLive = useAppStore((s) => s.clearLive);
  const enqueuePreview = useAppStore((s) => s.enqueuePreview);
  const removeFromQueue = useAppStore((s) => s.removeFromQueue);
  const liveFromQueueHead = useAppStore((s) => s.liveFromQueueHead);
  const mode = useAppStore((s) => s.settings.detection.mode);

  return (
    <div className="flex h-full flex-col gap-3">
      <Card className="flex-1 overflow-hidden bg-slate-950/40">
        <CardHeader className="border-b border-border/40">
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Preview</CardTitle>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {mode} · Space/Enter → Live · Q queue
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {preview ? (
            <>
              <p className="font-display text-base font-semibold text-sky-200">{preview.referenceLabel}</p>
              <p className="text-sm leading-relaxed text-foreground/90">{preview.originalText}</p>
              <p className="text-xs text-muted-foreground">{preview.translationId}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a detection or search result to preview.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!preview} onClick={() => void sendPreviewToLive()}>
              Send to Live
            </Button>
            <Button size="sm" variant="outline" disabled={!preview} onClick={() => void enqueuePreview()}>
              Add to Queue
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`relative flex-1 overflow-hidden ${
          live
            ? "bg-live/15 ring-4 ring-live shadow-[0_0_40px_rgba(225,29,72,0.35)]"
            : "bg-slate-950/40"
        }`}
      >
        {live ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-live px-3 py-1 text-center font-display text-xs font-bold tracking-[0.2em] text-live-foreground">
            ● LIVE ON AIR
          </div>
        ) : null}
        <CardHeader className={`border-b border-border/40 ${live ? "pt-8" : ""}`}>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className={live ? "text-live text-lg tracking-wide" : undefined}>
              {live ? "LIVE" : "Live"}
            </CardTitle>
            <Button size="sm" variant="destructive" onClick={() => void clearLive()}>
              Clear Live
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {live ? (
            <>
              <p className="font-display text-xl font-semibold text-rose-50">{live.referenceLabel}</p>
              <p className="text-base leading-relaxed text-rose-50/95">{live.originalText}</p>
              <p className="text-xs text-rose-100/70">{live.translationId} · Esc clears</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing on air. CLEAR LIVE stays available. vMix output arrives in Phase 6.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-950/40">
        <CardHeader className="border-b border-border/40 py-3">
          <div className="flex items-center justify-between">
            <CardTitle>Queue ({queue.length})</CardTitle>
            <Button size="sm" variant="outline" disabled={queue.length === 0} onClick={() => void liveFromQueueHead()}>
              Live next (L)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="max-h-36">
            <ul className="divide-y divide-border/40">
              {queue.length === 0 ? (
                <li className="px-3 py-3 text-sm text-muted-foreground">Queue empty. Press Q to enqueue Preview.</li>
              ) : (
                queue.map((item, index) => (
                  <li key={`${item.bookId}-${item.chapter}-${item.verse}-${index}`} className="flex items-center gap-2 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-sky-200">{item.referenceLabel}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.originalText}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeFromQueue(index)}>
                      Remove
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
