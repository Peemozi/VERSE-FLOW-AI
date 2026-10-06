import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/stores/app-store";

export function PreviewLivePanel() {
  const preview = useAppStore((s) => s.preview);
  const live = useAppStore((s) => s.live);
  const sendPreviewToLive = useAppStore((s) => s.sendPreviewToLive);
  const clearLive = useAppStore((s) => s.clearLive);

  return (
    <div className="flex h-full flex-col gap-3">
      <Card className="flex-1 overflow-hidden bg-slate-950/40">
        <CardHeader className="border-b border-border/40">
          <CardTitle>Preview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {preview ? (
            <>
              <p className="font-display text-base font-semibold text-sky-200">{preview.referenceLabel}</p>
              <p className="text-sm leading-relaxed text-foreground/90">{preview.originalText}</p>
              <p className="text-xs text-muted-foreground">{preview.translationId}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a verse from search to preview.</p>
          )}
          <Button size="sm" disabled={!preview} onClick={sendPreviewToLive}>
            Send to Live
          </Button>
        </CardContent>
      </Card>

      <Card className={`flex-1 overflow-hidden ${live ? "ring-2 ring-live/70 bg-live/10" : "bg-slate-950/40"}`}>
        <CardHeader className="border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className={live ? "text-live" : undefined}>{live ? "LIVE" : "Live"}</CardTitle>
            <Button size="sm" variant="destructive" onClick={clearLive} disabled={!live}>
              Clear Live
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          {live ? (
            <>
              <p className="font-display text-lg font-semibold text-rose-100">{live.referenceLabel}</p>
              <p className="text-sm leading-relaxed">{live.originalText}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing on air. vMix output arrives in Phase 6.</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-950/40">
        <CardHeader className="border-b border-border/40 py-3">
          <CardTitle>Queue</CardTitle>
        </CardHeader>
        <CardContent className="py-3 text-sm text-muted-foreground">Queue workflow ships in Phase 5.</CardContent>
      </Card>
    </div>
  );
}
