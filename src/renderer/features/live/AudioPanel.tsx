import { Mic, MicOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app-store";

export function AudioPanel() {
  const audioDevices = useAppStore((s) => s.audioDevices);
  const settings = useAppStore((s) => s.settings);
  const setInputDevice = useAppStore((s) => s.setInputDevice);
  const refreshAudioDevices = useAppStore((s) => s.refreshAudioDevices);
  const audioLevel = useAppStore((s) => s.audioLevel);
  const noInputWarning = useAppStore((s) => s.noInputWarning);
  const isListening = useAppStore((s) => s.isListening);
  const startListening = useAppStore((s) => s.startListening);
  const stopListening = useAppStore((s) => s.stopListening);
  const sttStatus = useAppStore((s) => s.sttStatus);
  const sttDetail = useAppStore((s) => s.sttDetail);
  const sttCapabilities = useAppStore((s) => s.sttCapabilities);

  const levelPct = Math.min(100, Math.round(audioLevel * 280));
  const bilingual = sttCapabilities?.languageModes.bilingual;

  return (
    <Card className="bg-slate-950/40">
      <CardHeader className="border-b border-border/40 py-3">
        <CardTitle>Audio / Live speech</CardTitle>
        <p className="text-xs text-muted-foreground">
          Mic → PCM → Google STT (main) → same detector as Simulation. Audio is streamed and discarded — not recorded.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="mic">Input device</Label>
            <select
              id="mic"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={settings.audio.inputDeviceId ?? ""}
              onChange={(e) => void setInputDevice(e.target.value || null)}
              disabled={isListening}
            >
              <option value="">System default</option>
              {audioDevices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button size="sm" variant="outline" onClick={() => void refreshAudioDevices()} disabled={isListening}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isListening ? (
              <Button size="sm" variant="destructive" onClick={() => void stopListening()}>
                <MicOff className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button size="sm" onClick={() => void startListening()}>
                <Mic className="h-4 w-4" />
                Listen
              </Button>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Level</span>
            <span className="font-mono">{sttStatus}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-secondary">
            <div
              className={`h-full transition-[width] duration-75 ${noInputWarning ? "bg-amber-400" : "bg-emerald-400"}`}
              style={{ width: `${levelPct}%` }}
            />
          </div>
          {noInputWarning ? (
            <p className="mt-1 text-xs text-amber-200">No input detected — check mute, cable, or device.</p>
          ) : null}
        </div>

        {sttDetail ? <p className="text-xs text-muted-foreground">{sttDetail}</p> : null}

        <div className="rounded-md border border-border/40 bg-background/30 p-2 text-xs text-muted-foreground">
          <p>
            Provider: <span className="text-foreground">{sttCapabilities?.displayName ?? "…"}</span>
            {sttCapabilities?.credentialsConfigured ? " · credentials OK" : " · set GOOGLE_APPLICATION_CREDENTIALS"}
          </p>
          {bilingual ? (
            <p className="mt-1">
              Bilingual: {bilingual.supported ? bilingual.bilingualStrategy : "unsupported"}
              {bilingual.notes ? ` — ${bilingual.notes}` : ""}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
