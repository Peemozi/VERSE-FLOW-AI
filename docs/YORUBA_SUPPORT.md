# VerseFlow AI — Yoruba Support

How VerseFlow matches **spoken and typed Yoruba** Bible references without inventing book names or treating uncertain forms as authoritative.

## Principles

1. **Match vs display** — Detection uses diacritic-insensitive normalization (`yorubaNormalize` / `normalizeForMatch`). Verse text shown to operators and overlays always keeps original Unicode from the Bible DB (`original_text`).
2. **OYCB-first aliases** — Verified book names come from Biblica Open Yoruba Contemporary Bible (OYCB) USFM `\h` / `\toc2` metadata (eBible.org). ASCII folded forms are stored alongside for STT.
3. **Do not invent** — Uncertain and ASR forms live in separate JSON sections and never claim to be liturgical authority.
4. **Reviewer-correctable numbers** — `resources/numbers/numbers.yo.json` holds verified bases, generated conservative compounds, and an `_overrides` map.

## Book aliases

File: `resources/aliases/book-aliases.yo.json`

| Section | Role | Confidence |
| --- | --- | --- |
| Top-level book keys | **Verified** (OYCB + consistent liturgical forms) | Full |
| `_uncertain` | Plausible but not confirmed against OYCB headers | Reduced (~0.7×) |
| `_asr` | Safe STT mishearings of verified forms only | Reduced (~0.85×) |

Examples of OYCB-verified titles: `Gẹnẹsisi`, `Eksodu`, `Saamu`, `Matiu` (not only “Matteu”), `Johanu`, `Ìṣe àwọn Aposteli`, `Kọrinti`, `Timotiu`, `Ìfihàn`.

Edit the JSON and restart / reload aliases (alias table rebuilds on process start; tests call `resetAliasTableForTests()`).

## Numbers

File: `resources/numbers/numbers.yo.json`

- Coverage target: chapters **1–150**, verses **1–176** (digits always accepted).
- `_verified` — hand-curated bases (1–25 forms, tens, 100, …).
- Flat entries — includes conservative generated compounds such as `ogun ati meta` → 23, `ogorun ati mewa` → 110.
- `_overrides` — reviewer corrections win last.

Generator helpers live in `src/shared/scripture/yorubaNumbers.ts` (`buildYorubaNumberMap`). Prefer fixing the JSON over inventing complex subtractive Yoruba forms (e.g. rare `din` constructions) unless a reviewer confirms them.

## Spoken chapter / verse keywords

Transcript normalizer maps:

| Spoken | Normalized to |
| --- | --- |
| `ori` / `ipin` | `chapter` |
| `ese` | `verse` |

Example: `Johanu ori meta ese merindilogun` → `johanu chapter 3 verse 16`.

## Diagnostics

Operator UI → **Diagnostics** (status bar):

- Original transcript
- Normalized transcript
- Digitized transcript (spoken numbers → digits)
- Matched aliases (book / language / source tier)
- Parsed numbers
- Resolved ref + confidence

IPC: `detection:diagnose` → `diagnoseTranscript()` in `src/main/scripture/yorubaDiagnostics.ts`.

## Tests

`tests/unit/scripture/yoruba-hardening.test.ts` — verified aliases only for book assertions, plus number coverage, ASR safety case, and diagnostics shape. Unknown books must not resolve.

## Gaps / reviewer TODOs

- Promote or delete `_uncertain` entries after Nigerian church review.
- Expand subtractive Yoruba number speech if operators need it (currently conservative `ati` compounds).
- Secondary translation auto-fetch on Send Live is wired when `bible.secondaryTranslationId` is set (bilingual overlay).
- Quotation / semantic detection are later phases and must not block this path.
