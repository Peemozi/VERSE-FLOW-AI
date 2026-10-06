# VerseFlow AI — Semantic Search (optional)

Phase 9 adds an **architected, optional** semantic path. It is **disabled by default** and must never slow or block direct / contextual / quotation detection.

## Interfaces

| Interface | Role | Default |
| --- | --- | --- |
| `EmbeddingProvider` | Embed transcript + verse text for cosine ranking | `NoOpEmbeddingProvider` (`available: false`) |
| `ReferenceInterpretationProvider` | Optional LLM / heuristic reference guesser | `NoOpReferenceInterpretationProvider` |
| `SemanticMatcher` | Orchestrates async suggestions | Constructed with `semanticEnabled: false` |

Code: `src/main/scripture/EmbeddingProvider.ts`, `ReferenceInterpretationProvider.ts`, `SemanticMatcher.ts`.

## Runtime behaviour

1. `ScriptureDetector.processTranscript` runs **only** direct → contextual → quotation (sync).
2. Callers may then invoke `scheduleSemanticSuggestions(...)` which fires asynchronously.
3. Live STT (`LiveSessionController`) schedules semantic after broadcasting primary detections.
4. Semantic hits use method `semantic`, `isSuggestion: true`, and never update scripture context by themselves.

## Settings

- `detection.semanticEnabled` — default **`false`**
- `detection.semanticMinConfidence` — default `0.85`

## Enabling later (no secrets in repo)

1. Implement a real `EmbeddingProvider` (e.g. local ONNX under `resources/models/`, or a remote API reading credentials only from main-process env / secure storage).
2. Register it in `createEmbeddingProvider()` when the model path / env is present.
3. Optionally precompute verse embeddings into SQLite / a sidecar file and pass them as `SemanticMatcher` corpus.
4. Turn on **Settings → Semantic matching**, or set `semanticEnabled: true` in `settings.json` under AppData.
5. For LLM interpretation: implement `ReferenceInterpretationProvider`, but **always** pass results through `validateInterpretedReferences(...)` against the local Bible DB. Core must keep working with the no-op provider.

## Non-goals (this phase)

- Bundling a large embedding model
- Calling cloud LLMs by default
- Replacing FTS quotation or direct reference parsing
