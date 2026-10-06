import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function TranscriptPanel() {
  return (
    <Card className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Transcript</CardTitle>
        <p className="text-xs text-muted-foreground">Live speech arrives in Phase 4. Simulation mode in Phase 3.</p>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full min-h-[220px] p-4">
          <div className="rounded-md border border-dashed border-border/50 bg-background/30 p-4 text-sm text-muted-foreground">
            No transcript yet. Speech recognition is intentionally not enabled in Phase 1–2.
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
