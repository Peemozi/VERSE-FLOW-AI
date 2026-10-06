# Bible data

## Translations

| ID | Name | Language | Licence | Source |
| --- | --- | --- | --- | --- |
| WEB | World English Bible | English | Public Domain | eBible.org `engwebp` USFM |
| OYCB | Open Yoruba Contemporary Bible (Biblica) | Yoruba | CC BY-SA 4.0 | eBible.org `yor` USFM |

VerseFlow never invents WEB/OYCB/KJV/NIV text. If a source is missing, import skips it.

## Import

```bash
npm run bible:import
```

Defaults:

- Database: `./data/verseflow.db` (override with `VERSEFLOW_DB_PATH`)
- Raw USFM cache: `resources/bible/raw/` (gitignored)
- Downloads WEB + OYCB from eBible.org when not cached

### WEB

Downloads `https://ebible.org/Scriptures/engwebp_usfm.zip` when not already cached, unzips to `resources/bible/raw/web/`, parses USFM, upserts into SQLite.

### OYCB

Downloads `https://ebible.org/Scriptures/yor_usfm.zip` (CC BY-SA 4.0) by default.

```bash
# Skip remote OYCB
SKIP_OYCB=1 npm run bible:import

# Or use a local folder / alternate URL
OYCB_USFM_DIR=/path/to/oycb-usfm npm run bible:import
OYCB_ZIP_URL=https://example.permitted/oycb.zip npm run bible:import
```

Optional attribution overrides: `OYCB_LICENSE`, `OYCB_ATTRIBUTION`.

**Licence note:** OYCB is © Biblica, Inc., shared under CC BY-SA 4.0. Keep attribution; Biblica® trademark requires permission for trademark use beyond the licence terms.

## Schema notes

- `original_text` — display (preserves Yoruba Unicode)
- `normalized_text` — diacritic-insensitive search key
- Canonical book IDs: `GEN` … `REV` (language-neutral)

## Manual lookup

Operator dashboard → Manual Bible lookup (Ctrl/Cmd+K). Works offline once imported.
