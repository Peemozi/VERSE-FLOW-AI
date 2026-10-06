import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app-store";

/**
 * Dev / church-tech test: push a verse to the local overlay over WebSocket
 * without needing STT or Bible DB lookup.
 */
export function OverlayTestPanel() {
  const sendTestVerse = useAppStore((s) => s.sendTestVerse);
  const overlayStatus = useAppStore((s) => s.overlayStatus);
  const [reference, setReference] = useState("John 3:16");
  const [verse, setVerse] = useState(
    "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
  );
  const [translation, setTranslation] = useState("WEB");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const onSend = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendTestVerse({
        referenceLabel: reference.trim() || "Test",
        verseText: verse.trim() || "(empty)",
        translationId: translation.trim() || "TEST",
      });
      if (result.overlayOk) {
        setMessage("Sent — overlay should update instantly via WebSocket (no refresh).");
      } else {
        setMessage(result.errors.join("; ") || "Overlay send failed");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Overlay test</CardTitle>
        <p className="text-xs text-muted-foreground">
          Send a test verse to the local browser overlay (127.0.0.1). Open the overlay URL in a
          browser or vMix Browser input, then click Send Test Verse — the page updates over
          WebSocket without refreshing.
        </p>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="ov-test-ref">Reference</Label>
          <input
            id="ov-test-ref"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ov-test-tr">Translation</Label>
          <input
            id="ov-test-tr"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
          />
        </div>
        <div className="space-y-1 md:col-span-3">
          <Label htmlFor="ov-test-verse">Verse</Label>
          <textarea
            id="ov-test-verse"
            className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={verse}
            onChange={(e) => setVerse(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-3">
          <Button size="sm" disabled={busy} onClick={() => void onSend()}>
            {busy ? "Sending…" : "Send Test Verse"}
          </Button>
          <span className="text-xs text-muted-foreground">
            Overlay: {overlayStatus?.status ?? "—"}
            {overlayStatus?.url ? ` · ${overlayStatus.url}` : ""}
          </span>
        </div>
        {message ? <p className="text-xs text-sky-200/90 md:col-span-3">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
