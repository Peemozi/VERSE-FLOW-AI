import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";

export function DetectionPanel() {
  const detections = useAppStore((s) => s.detections);
  const suppressedCount = useAppStore((s) => s.suppressedCount);
  const loadDetectionToPreview = useAppStore((s) => s.loadDetectionToPreview);

  return (
    <Card className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Detections</CardTitle>
        <p className="text-xs text-muted-foreground">
          Direct + contextual parser · {suppressedCount} duplicate{suppressedCount === 1 ? "" : "s"} suppressed
        </p>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full min-h-[220px]">
          <ul className="divide-y divide-border/40">
            {detections.length === 0 ? (
              <li className="px-4 py-4 text-sm text-muted-foreground">
                No detections yet. Simulate a transcript on the left.
              </li>
            ) : (
              detections.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-accent/40"
                    onClick={() => void loadDetectionToPreview(d)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display font-semibold text-sky-200">{d.referenceLabel}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-secondary-foreground">
                        {d.method}
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
              ))
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
