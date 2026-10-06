import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/app-store";

export function BibleSearchPanel() {
  const translations = useAppStore((s) => s.translations);
  const selectedTranslationId = useAppStore((s) => s.selectedTranslationId);
  const setSelectedTranslation = useAppStore((s) => s.setSelectedTranslation);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const searchResults = useAppStore((s) => s.searchResults);
  const runSearch = useAppStore((s) => s.runSearch);
  const loadVerseToPreview = useAppStore((s) => s.loadVerseToPreview);
  const status = useAppStore((s) => s.status);

  return (
    <Card className="flex h-full flex-col overflow-hidden bg-slate-950/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle>Manual Bible lookup</CardTitle>
        <p className="text-xs text-muted-foreground">
          Ctrl/Cmd+K · Offline search against the local SQLite Bible DB
        </p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-4">
        {!status?.bibleReady ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            No verses imported yet. Run <code className="font-mono text-xs">npm run bible:import</code> then restart.
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[140px_1fr_auto]">
          <div className="space-y-1">
            <Label htmlFor="translation">Translation</Label>
            <select
              id="translation"
              className="flex h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={selectedTranslationId}
              onChange={(e) => setSelectedTranslation(e.target.value)}
            >
              {translations.length === 0 ? (
                <option value={selectedTranslationId}>{selectedTranslationId}</option>
              ) : (
                translations.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id} ({t.verseCount})
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="bible-search-input">Search</Label>
            <Input
              id="bible-search-input"
              placeholder="John 3:16 or search text…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runSearch();
              }}
            />
          </div>
          <div className="flex items-end">
            <Button className="w-full sm:w-auto" onClick={() => void runSearch()}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </div>

        <ScrollArea className="min-h-[160px] flex-1 rounded-md border border-border/40">
          <ul className="divide-y divide-border/40">
            {searchResults.length === 0 ? (
              <li className="px-3 py-4 text-sm text-muted-foreground">No results.</li>
            ) : (
              searchResults.map((r) => (
                <li key={`${r.translationId}-${r.bookId}-${r.chapter}-${r.verse}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left transition-colors hover:bg-accent/40"
                    onClick={() => void loadVerseToPreview(r)}
                  >
                    <div className="font-medium text-sky-200">{r.referenceLabel}</div>
                    <div className="line-clamp-2 text-sm text-muted-foreground">{r.originalText}</div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
