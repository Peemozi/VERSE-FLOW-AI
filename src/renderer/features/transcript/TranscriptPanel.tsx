import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";

export function TranscriptPanel() {
  const simulationText = useAppStore((s) => s.simulationText);
  const setSimulationText = useAppStore((s) => s.setSimulationText);
  const runSimulation = useAppStore((s) => s.runSimulation);
  const simulationLog = useAppStore((s) => s.simulationLog);
  const resetDetection = useAppStore((s) => s.resetDetection);
  const detectionContext = useAppStore((s) => s.detectionContext);

  return (
    <Card className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Transcript · Simulation</CardTitle>
        <p className="text-xs text-muted-foreground">
          Type what a speaker would say. Uses the same detection pipeline live STT will use (Phase 4).
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-4">
        <textarea
          className="min-h-[88px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder='e.g. "John 3:16" or "verse 17" after a prior John context'
          value={simulationText}
          onChange={(e) => setSimulationText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void runSimulation();
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void runSimulation()}>
            Run detection
          </Button>
          <Button size="sm" variant="outline" onClick={() => void runSimulation({ resetContext: true })}>
            Run (reset context)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void resetDetection()}>
            Clear session
          </Button>
        </div>
        {detectionContext?.bookId ? (
          <p className="text-xs text-sky-200/90">
            Context: {detectionContext.bookId} {detectionContext.chapter}:{detectionContext.verse}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No active scripture context.</p>
        )}
        <ScrollArea className="min-h-[100px] flex-1 rounded-md border border-border/40">
          <ul className="divide-y divide-border/30 text-sm">
            {simulationLog.length === 0 ? (
              <li className="px-3 py-3 text-muted-foreground">Simulation log empty.</li>
            ) : (
              simulationLog.map((line, i) => (
                <li key={`${i}-${line}`} className="px-3 py-2 font-mono text-xs text-foreground/80">
                  {line}
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
