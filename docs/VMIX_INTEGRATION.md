# VerseFlow AI — vMix Integration

How VerseFlow sends LIVE scripture to **vMix** and a local **browser overlay**.

## Architecture

```
Operator Send Live / Clear Live
        │
        ▼
  OutputController (main)
        ├── VmixOutputAdapter  → HTTP :8088 (SetText, Overlay) + TCP :8099 (health)
        └── OverlayServer      → HTTP + WebSocket (transparent /overlay page)
```

- Default host: `127.0.0.1`
- Default HTTP API: `8088`
- Default TCP API: `8099`
- Overlay default: `http://127.0.0.1:8791/overlay`

vMix must have **Settings → Web Controller** enabled (HTTP API). TCP API is used for connection health and as an alternate command path.

## Point vMix at the overlay

1. In VerseFlow **Settings → OUTPUT**, leave Overlay server **Enabled** (port `8791` by default).
2. In vMix, add a **Browser** input.
3. Set the Browser URL to:

   ```
   http://127.0.0.1:8791/overlay
   ```

4. Enable **Transparent** (or equivalent) so the page background stays clear.
5. Optionally place that Browser input on an Overlay channel (1–4).

Themes (Settings → OUTPUT → Theme):

| Theme id | Display name | Use |
| --- | --- | --- |
| `clean-lower-third` | Clean Lower Third | Default lower-third bar |
| `full-scripture` | Full Scripture | Large centered card; long text pages every 6s |
| `minimal` | Minimal | Text + shadow only |
| `bilingual` | Bilingual | Primary + secondary verse block |

WebSocket updates push LIVE changes instantly; `/api/state` is available for debugging.

## Title field mapping (GT / Title inputs)

Configure under **Settings → VMIX**:

| Setting | Default | Maps to |
| --- | --- | --- |
| Title input | `Scripture` | vMix Input name or number |
| Reference field | `Reference` | → `Reference.Text` via SetText |
| Verse field | `Verse` | → `Verse.Text` |
| Translation field | `Translation` | → `Translation.Text` |

Create a GT Title (or similar) in vMix with those field names, or change VerseFlow to match your existing title.

### SetText (URL-encoded)

Example:

```
http://127.0.0.1:8088/api/?Function=SetText&Input=Scripture&SelectedName=Reference.Text&Value=John%203%3A16
```

Values with spaces, punctuation, or Yoruba diacritics are URL-encoded automatically.

## Auto show / hide overlay

When **Auto show/hide overlay** is On:

- **Send Live** → `OverlayInputNIn` with your title input (`N` = overlay channel 1–4)
- **Clear Live** → `OverlayInputNOut`

This is independent of the local browser overlay server (which always show/hides its own HTML when enabled).

## Test Connection

**Settings → VMIX → Test Connection** probes:

1. HTTP `GET /api/` (expects vMix XML)
2. TCP connect + `XML` request on the TCP port

Status pills: Connected / Disconnected / Error (reconnect uses exponential backoff with jitter when Connect is active and vMix drops).

## Operator wiring

Phase 5 **Send Live**, **Clear Live**, queue→live, and automatic mode all call `OutputController`:

- vMix SetText (if VMIX enabled)
- Overlay WebSocket state (if OUTPUT overlay enabled)

Failures surface in the UI error line and never crash the app. Offline Bible + manual Preview still work if vMix is down.

## Mock server (tests)

`MockVmixServer` in `src/main/vmix/MockVmixServer.ts` implements HTTP `/api/` + TCP XML for Vitest. See `tests/unit/vmix/vmix-output.test.ts`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Test Connection fails | Web Controller on; firewall; host/ports |
| Text not updating | Input name + field names match GT title |
| Overlay blank in vMix | URL ends with `/overlay`; transparent enabled; overlay server Enabled |
| Yoruba glyphs missing | Use a title font that covers Latin Extended; overlay uses system UI fonts |
