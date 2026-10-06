import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app-store";
import type { AppSettings } from "@shared/schemas";

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const translations = useAppStore((s) => s.translations);
  const status = useAppStore((s) => s.status);
  const vmixDetail = useAppStore((s) => s.vmixDetail);
  const overlayUrl = useAppStore((s) => s.overlayUrl);
  const testVmixConnection = useAppStore((s) => s.testVmixConnection);
  const connectVmix = useAppStore((s) => s.connectVmix);

  const patch = (partial: Partial<AppSettings>) => {
    void updateSettings({ ...settings, ...partial });
  };

  return (
    <Card className="bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Settings</CardTitle>
        <p className="text-xs text-muted-foreground">
          Persisted in app userData. VMIX + OUTPUT control Send Live / Clear Live destinations.
        </p>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="lang-mode">Language mode</Label>
          <select
            id="lang-mode"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.general.languageMode}
            onChange={(e) =>
              patch({
                general: {
                  ...settings.general,
                  languageMode: e.target.value as AppSettings["general"]["languageMode"],
                },
              })
            }
          >
            <option value="english">English</option>
            <option value="yoruba">Yoruba</option>
            <option value="bilingual">Bilingual / Mixed (alt. language codes)</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            Bilingual uses Google alternativeLanguageCodes — not dual independent ASR.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="default-tr">Default translation</Label>
          <select
            id="default-tr"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.bible.defaultTranslationId}
            onChange={(e) =>
              patch({
                bible: { ...settings.bible, defaultTranslationId: e.target.value },
              })
            }
          >
            {(translations.length ? translations : [{ id: "WEB", name: "WEB" }]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="secondary-tr">Secondary (bilingual overlay)</Label>
          <select
            id="secondary-tr"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.bible.secondaryTranslationId ?? ""}
            onChange={(e) =>
              patch({
                bible: {
                  ...settings.bible,
                  secondaryTranslationId: e.target.value || null,
                },
              })
            }
          >
            <option value="">None</option>
            {(translations.length ? translations : [{ id: "OYCB", name: "OYCB" }]).map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            On Send Live, fetches this translation for the bilingual overlay theme.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="det-mode">Detection mode</Label>
          <select
            id="det-mode"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.detection.mode}
            onChange={(e) =>
              patch({
                detection: {
                  ...settings.detection,
                  mode: e.target.value as AppSettings["detection"]["mode"],
                },
              })
            }
          >
            <option value="assisted">Assisted (preview only)</option>
            <option value="automatic">Automatic (high-conf → LIVE)</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="min-conf">Min auto-live confidence</Label>
          <input
            id="min-conf"
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.detection.minConfidence}
            onChange={(e) =>
              patch({
                detection: {
                  ...settings.detection,
                  minConfidence: Number(e.target.value),
                },
              })
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Automatic mode takes detections ≥ this threshold straight to LIVE (direct/contextual).
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="quote-conf">Quotation auto-live confidence</Label>
          <input
            id="quote-conf"
            type="number"
            min={0}
            max={1}
            step={0.05}
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.detection.quotationMinConfidence}
            onChange={(e) =>
              patch({
                detection: {
                  ...settings.detection,
                  quotationMinConfidence: Number(e.target.value),
                },
              })
            }
          />
          <p className="text-[11px] text-muted-foreground">
            Quotation matches stay as suggestions unless confidence ≥ this higher bar (default 0.9).
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="quote-enabled">Quotation detection</Label>
          <select
            id="quote-enabled"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.detection.quotationEnabled ? "yes" : "no"}
            onChange={(e) =>
              patch({
                detection: {
                  ...settings.detection,
                  quotationEnabled: e.target.value === "yes",
                },
              })
            }
          >
            <option value="yes">Enabled (FTS5, after direct)</option>
            <option value="no">Disabled</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="semantic-enabled">Semantic matching</Label>
          <select
            id="semantic-enabled"
            className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={settings.detection.semanticEnabled ? "yes" : "no"}
            onChange={(e) =>
              patch({
                detection: {
                  ...settings.detection,
                  semanticEnabled: e.target.value === "yes",
                },
              })
            }
          >
            <option value="no">Disabled (default)</option>
            <option value="yes">Enabled (async; needs embedding model)</option>
          </select>
          <p className="text-[11px] text-muted-foreground">
            Optional. Stub provider until a model is bundled — see docs/SEMANTIC_SEARCH.md.
          </p>
        </div>

        <div className="md:col-span-3 border-t border-border/40 pt-3">
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground">VMIX</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="vmix-enabled">Enabled</Label>
              <select
                id="vmix-enabled"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.enabled ? "yes" : "no"}
                onChange={(e) =>
                  patch({
                    vmix: { ...settings.vmix, enabled: e.target.value === "yes" },
                  })
                }
              >
                <option value="no">Disabled</option>
                <option value="yes">Enabled</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-host">Host</Label>
              <input
                id="vmix-host"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.host}
                onChange={(e) => patch({ vmix: { ...settings.vmix, host: e.target.value } })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-http">HTTP port</Label>
              <input
                id="vmix-http"
                type="number"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.httpPort}
                onChange={(e) =>
                  patch({ vmix: { ...settings.vmix, httpPort: Number(e.target.value) } })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-tcp">TCP port</Label>
              <input
                id="vmix-tcp"
                type="number"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.tcpPort}
                onChange={(e) =>
                  patch({ vmix: { ...settings.vmix, tcpPort: Number(e.target.value) } })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-input">Title input</Label>
              <input
                id="vmix-input"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.inputName}
                onChange={(e) =>
                  patch({ vmix: { ...settings.vmix, inputName: e.target.value } })
                }
                placeholder="Scripture"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-ref">Reference field</Label>
              <input
                id="vmix-ref"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.fieldReference}
                onChange={(e) =>
                  patch({ vmix: { ...settings.vmix, fieldReference: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-verse">Verse field</Label>
              <input
                id="vmix-verse"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.fieldVerse}
                onChange={(e) =>
                  patch({ vmix: { ...settings.vmix, fieldVerse: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-tr">Translation field</Label>
              <input
                id="vmix-tr"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.fieldTranslation}
                onChange={(e) =>
                  patch({ vmix: { ...settings.vmix, fieldTranslation: e.target.value } })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-auto">Auto show/hide overlay</Label>
              <select
                id="vmix-auto"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.autoOverlay ? "yes" : "no"}
                onChange={(e) =>
                  patch({
                    vmix: { ...settings.vmix, autoOverlay: e.target.value === "yes" },
                  })
                }
              >
                <option value="no">Off</option>
                <option value="yes">On (OverlayInputN In/Out)</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vmix-ch">Overlay channel (1–4)</Label>
              <input
                id="vmix-ch"
                type="number"
                min={1}
                max={4}
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.vmix.overlayChannel}
                onChange={(e) =>
                  patch({
                    vmix: { ...settings.vmix, overlayChannel: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div className="flex flex-wrap items-end gap-2 md:col-span-3">
              <Button size="sm" variant="outline" onClick={() => void testVmixConnection()}>
                Test Connection
              </Button>
              <Button size="sm" onClick={() => void connectVmix()} disabled={!settings.vmix.enabled}>
                Connect
              </Button>
              <span className="text-xs text-muted-foreground">
                Status: {status?.vmixStatus ?? "disconnected"}
                {vmixDetail ? ` — ${vmixDetail}` : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="md:col-span-3 border-t border-border/40 pt-3">
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-foreground">OUTPUT · Browser overlay</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="ov-enabled">Overlay server</Label>
              <select
                id="ov-enabled"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.output.overlayEnabled ? "yes" : "no"}
                onChange={(e) =>
                  patch({
                    output: {
                      ...settings.output,
                      overlayEnabled: e.target.value === "yes",
                    },
                  })
                }
              >
                <option value="yes">Enabled</option>
                <option value="no">Disabled</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="ov-port">Port</Label>
              <input
                id="ov-port"
                type="number"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.output.overlayPort}
                onChange={(e) =>
                  patch({
                    output: { ...settings.output, overlayPort: Number(e.target.value) },
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="ov-theme">Theme</Label>
              <select
                id="ov-theme"
                className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={settings.output.overlayTheme}
                onChange={(e) =>
                  patch({
                    output: {
                      ...settings.output,
                      overlayTheme: e.target.value as AppSettings["output"]["overlayTheme"],
                    },
                  })
                }
              >
                <option value="clean-lower-third">Clean Lower Third</option>
                <option value="full-scripture">Full Scripture</option>
                <option value="minimal">Minimal</option>
                <option value="bilingual">Bilingual</option>
              </select>
            </div>
            <div className="md:col-span-3 text-xs text-muted-foreground">
              Point a vMix Browser input at{" "}
              <code className="rounded bg-black/40 px-1 py-0.5 text-[11px] text-sky-200">
                {overlayUrl ?? `http://127.0.0.1:${settings.output.overlayPort}/overlay`}
              </code>{" "}
              (transparent background). See docs/VMIX_INTEGRATION.md.
            </div>
          </div>
        </div>

        <div className="md:col-span-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              patch({
                advanced: {
                  ...settings.advanced,
                  logLevel: settings.advanced.logLevel === "debug" ? "info" : "debug",
                },
              })
            }
          >
            Log level: {settings.advanced.logLevel}
          </Button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Shortcuts: Space/Enter live · Esc clear · Ctrl/Cmd+K search · ↑↓ detections · P preview · Q
            queue · L live next
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
