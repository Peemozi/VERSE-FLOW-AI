import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export function DetectionPanel() {
  const detections = useAppStore((s) => s.detections);
  const suppressedCount = useAppStore((s) => s.suppressedCount);
  const selectedDetectionIndex = useAppStore((s) => s.selectedDetectionIndex);
  const setSelectedDetectionIndex = useAppStore((s) => s.setSelectedDetectionIndex);
  const loadDetectionToPreview = useAppStore((s) => s.loadDetectionToPreview);
  const mode = useAppStore((s) => s.settings.detection.mode);
  const minConfidence = useAppStore((s) => s.settings.detection.minConfidence);
  const quotationMin = useAppStore((s) => s.settings.detection.quotationMinConfidence);

  return (
    <Card className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Recent detections</CardTitle>
        <p className="text-xs text-muted-foreground">
          {mode} mode · direct ≥ {(minConfidence * 100).toFixed(0)}% · quote ≥{" "}
          {(quotationMin * 100).toFixed(0)}% · ↑↓ select · P preview · {suppressedCount} dup
          suppressed
        </p>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full min-h-[220px]">
          <ul className="divide-y divide-border/40">
            {detections.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted-foreground">
                No detections yet. Simulate a transcript or start Listen.
              </li>
            ) : (
              detections.map((d, index) => {
                const suggestion = d.method === "quotation" || d.isSuggestion;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      className={cn(
                        "w-full px-4 py-3 text-left transition-colors hover:bg-accent/40",
                        index === selectedDetectionIndex &&
                          "bg-primary/15 ring-1 ring-inset ring-primary/40",
                      )}
                      onClick={() => {
                        setSelectedDetectionIndex(index);
                        void loadDetectionToPreview(d);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display font-semibold text-sky-200">
                          {d.referenceLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          {suggestion ? (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-200">
                              suggestion
                            </span>
                          ) : null}
                          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-secondary-foreground">
                            {d.method}
                          </span>
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {d.verseText ?? "Verse text unavailable — import Bible data if missing."}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                        conf {(d.confidence * 100).toFixed(0)}% · “{d.rawMatch}”
                      </p>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
