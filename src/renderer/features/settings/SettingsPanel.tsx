import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/stores/app-store";
import type { AppSettings } from "@shared/schemas";

export function SettingsPanel() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const translations = useAppStore((s) => s.translations);

  const patch = (partial: Partial<AppSettings>) => {
    void updateSettings({ ...settings, ...partial });
  };

  return (
    <Card className="bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Settings</CardTitle>
        <p className="text-xs text-muted-foreground">Persisted in app userData. More sections arrive in later phases.</p>
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
            <option value="bilingual">Bilingual / Mixed</option>
          </select>
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
            <option value="assisted">Assisted</option>
            <option value="automatic">Automatic</option>
          </select>
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
        </div>
      </CardContent>
    </Card>
  );
}
