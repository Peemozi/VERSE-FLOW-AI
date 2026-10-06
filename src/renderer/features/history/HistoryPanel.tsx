import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";

export function HistoryPanel() {
  const history = useAppStore((s) => s.history);
  const refreshHistory = useAppStore((s) => s.refreshHistory);
  const exportHistory = useAppStore((s) => s.exportHistory);
  const endHistorySession = useAppStore((s) => s.endHistorySession);
  const setView = useAppStore((s) => s.setView);

  return (
    <Card className="flex min-h-[70vh] flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Session history</CardTitle>
            <p className="text-xs text-muted-foreground">
              Operator events only — no audio. Export CSV or JSON for logs.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => void refreshHistory()}>
              Refresh
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportHistory("csv")}>
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => void exportHistory("json")}>
              Export JSON
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void endHistorySession()}>
              End session
            </Button>
            <Button size="sm" onClick={() => setView("dashboard")}>
              Back to dashboard
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full min-h-[50vh]">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-card/90 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Conf</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                    No operator events yet.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="hover:bg-accent/20">
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                      {row.createdAt}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs uppercase">{row.kind}</td>
                    <td className="px-3 py-2 text-sky-200">{row.referenceLabel ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{row.method ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {row.confidence != null ? `${Math.round(row.confidence * 100)}%` : "—"}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2 text-xs text-muted-foreground">
                      {row.notes ?? row.verseText ?? ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
