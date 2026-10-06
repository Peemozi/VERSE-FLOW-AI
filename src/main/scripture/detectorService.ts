import type { LanguageMode } from "../../shared/schemas";
import { BibleRepository } from "../database/BibleRepository";
import { getDatabase } from "../database/connection";
import { loadSettings } from "../settings/store";
import type { AliasLanguage } from "./bookAliasEngine";
import { QuotationDetector } from "./QuotationDetector";
import { ScriptureDetector } from "./ScriptureDetector";

let detector: ScriptureDetector | null = null;

function languagesForMode(mode: LanguageMode): AliasLanguage[] {
  switch (mode) {
    case "english":
      return ["en"];
    case "yoruba":
      return ["yo", "en"];
    case "bilingual":
    default:
      return ["en", "yo"];
  }
}

function buildDetector(): ScriptureDetector {
  const settings = loadSettings();
  const repo = new BibleRepository(getDatabase());
  repo.seedCanonicalBooks();
  // Ensure FTS is populated if verses exist but index is empty (upgrade path)
  try {
    for (const t of repo.listTranslations()) {
      if (t.verseCount > 0 && repo.getFtsCount(t.id) === 0) {
        repo.rebuildFtsForTranslation(t.id);
      }
    }
  } catch {
    /* FTS optional until migration applied */
  }
  const translationId = settings.bible.defaultTranslationId;

  const quotationDetector = new QuotationDetector({
    repo,
    translationId,
    settings: {
      enabled: settings.detection.quotationEnabled,
      minChars: settings.detection.quotationMinChars,
      minSignificantWords: settings.detection.quotationMinWords,
    },
  });

  return new ScriptureDetector({
    translationId,
    languages: languagesForMode(settings.general.languageMode),
    quotationDetector,
    verseExists: (bookId, chapter, verse) => {
      const anyVerses = repo.listTranslations().some((t) => t.verseCount > 0);
      if (!anyVerses) return true;
      if (repo.getVerse(translationId, bookId, chapter, verse)) return true;
      return repo.listTranslations().some((t) => Boolean(repo.getVerse(t.id, bookId, chapter, verse)));
    },
    getVerse: (tid, bookId, chapter, verse) => repo.getVerse(tid, bookId, chapter, verse),
  });
}

export function getScriptureDetector(): ScriptureDetector {
  const settings = loadSettings();
  if (!detector) {
    detector = buildDetector();
  } else {
    detector.setTranslationId(settings.bible.defaultTranslationId);
    detector.setLanguages(languagesForMode(settings.general.languageMode));
    detector.updateQuotationSettings({
      enabled: settings.detection.quotationEnabled,
      minChars: settings.detection.quotationMinChars,
      minSignificantWords: settings.detection.quotationMinWords,
    });
  }
  return detector;
}

export function resetScriptureDetector(): void {
  detector?.reset();
  detector = null;
}
