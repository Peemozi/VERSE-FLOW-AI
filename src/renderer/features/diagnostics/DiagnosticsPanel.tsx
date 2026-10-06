import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app-store";

export function DiagnosticsPanel() {
  const text = useAppStore((s) => s.diagnosticsText);
  const setText = useAppStore((s) => s.setDiagnosticsText);
  const result = useAppStore((s) => s.diagnosticsResult);
  const run = useAppStore((s) => s.runDiagnostics);
  const loading = useAppStore((s) => s.diagnosticsLoading);

  return (
    <Card className="bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Yoruba detection diagnostics</CardTitle>
        <p className="text-xs text-muted-foreground">
          Developer view: original → normalized → matched alias → parsed numbers → resolved ref +
          confidence. Uses verified / ASR / uncertain alias tiers from{" "}
          <code className="text-[11px]">book-aliases.yo.json</code>.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="space-y-1">
          <Label htmlFor="diag-input">Transcript</Label>
          <textarea
            id="diag-input"
            className="min-h-[88px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='e.g. "Johanu ori meta ese merindilogun" or "Saamu 23:1"'
          />
        </div>
        <Button size="sm" disabled={!text.trim() || loading} onClick={() => void run()}>
          {loading ? "Running…" : "Diagnose"}
        </Button>

        {result ? (
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <DiagBlock label="Original" value={result.originalTranscript} />
            <DiagBlock label="Normalized" value={result.normalizedTranscript} />
            <DiagBlock label="Digitized (numbers → digits)" value={result.digitizedTranscript} />
            <DiagBlock
              label="Top confidence"
              value={result.topConfidence == null ? "—" : String(result.topConfidence)}
            />
            <div className="md:col-span-2 space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Matched aliases
              </div>
              {result.matchedAliases.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {result.matchedAliases.map((a, i) => (
                    <li key={`${a.bookId}-${i}`} className="rounded bg-black/30 px-2 py-1 font-mono">
                      {a.alias} → {a.bookId} [{a.language}/{a.source}]
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:col-span-2 space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Parsed numbers
              </div>
              {result.parsedNumbers.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {result.parsedNumbers.map((n, i) => (
                    <li key={`${n.raw}-${i}`} className="rounded bg-black/30 px-2 py-1 font-mono">
                      “{n.raw}” → {n.value}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="md:col-span-2 space-y-1">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Resolved refs
              </div>
              {result.resolvedRefs.length === 0 ? (
                <p className="text-xs text-muted-foreground">None</p>
              ) : (
                <ul className="space-y-1 text-xs">
                  {result.resolvedRefs.map((r, i) => (
                    <li key={`${r.rawMatch}-${i}`} className="rounded bg-black/30 px-2 py-1 font-mono">
                      {r.bookId} {r.chapter}:{r.verse}
                      {r.endVerse ? `-${r.endVerse}` : ""} · alias={r.matchedAlias ?? "—"} (
                      {r.aliasSource ?? "—"}) · conf={r.confidence} · {r.method}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DiagBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="rounded bg-black/30 px-2 py-1.5 font-mono text-xs break-words">{value || "—"}</div>
    </div>
  );
}
