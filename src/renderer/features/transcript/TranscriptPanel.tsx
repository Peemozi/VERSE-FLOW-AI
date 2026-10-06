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
  const interimTranscript = useAppStore((s) => s.interimTranscript);
  const finalTranscripts = useAppStore((s) => s.finalTranscripts);

  return (
    <Card className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Transcript</CardTitle>
        <p className="text-xs text-muted-foreground">
          Live STT finals and Simulation Mode both feed the same ScriptureDetector.
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-4">
        {interimTranscript ? (
          <div className="rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm italic text-sky-100">
            {interimTranscript}
            <span className="ml-2 text-[10px] uppercase not-italic text-sky-300/80">interim</span>
          </div>
        ) : null}

        <textarea
          className="min-h-[72px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          placeholder='Simulation: type "John 3:16" or speak with Listen'
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
            Simulate
          </Button>
          <Button size="sm" variant="outline" onClick={() => void runSimulation({ resetContext: true })}>
            Simulate (reset ctx)
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
            {finalTranscripts.length === 0 && simulationLog.length === 0 ? (
              <li className="px-3 py-3 text-muted-foreground">No transcript yet.</li>
            ) : (
              <>
                {finalTranscripts.map((line, i) => (
                  <li key={`f-${i}-${line}`} className="px-3 py-2 text-foreground/90">
                    <span className="mr-2 text-[10px] uppercase text-emerald-300/80">final</span>
                    {line}
                  </li>
                ))}
                {simulationLog.map((line, i) => (
                  <li key={`s-${i}-${line}`} className="px-3 py-2 font-mono text-xs text-foreground/70">
                    {line}
                  </li>
                ))}
              </>
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
