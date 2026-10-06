import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export function DetectionPanel() {
  return (
    <Card className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Detections</CardTitle>
        <p className="text-xs text-muted-foreground">Automatic detections land here after Phase 3.</p>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full min-h-[220px] p-4">
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="rounded-md border border-border/40 bg-background/20 px-3 py-2">
              Waiting for reference parser / simulation…
            </li>
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
