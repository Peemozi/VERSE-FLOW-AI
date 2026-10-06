import { useEffect } from "react";
import { resolveOperatorShortcut } from "@shared/operator/workflow";
import { useAppStore } from "@/stores/app-store";

/** Global operator shortcuts — ignored while typing in inputs (except Ctrl/Cmd+K). */
export function useOperatorShortcuts(): void {
  const sendPreviewToLive = useAppStore((s) => s.sendPreviewToLive);
  const clearLive = useAppStore((s) => s.clearLive);
  const focusBibleSearch = useAppStore((s) => s.focusBibleSearch);
  const selectPrevDetection = useAppStore((s) => s.selectPrevDetection);
  const selectNextDetection = useAppStore((s) => s.selectNextDetection);
  const detectionToPreview = useAppStore((s) => s.detectionToPreview);
  const enqueuePreview = useAppStore((s) => s.enqueuePreview);
  const liveFromQueueOrPreview = useAppStore((s) => s.liveFromQueueOrPreview);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const action = resolveOperatorShortcut(e);
      if (!action) return;
      e.preventDefault();
      switch (action) {
        case "previewToLive":
          void sendPreviewToLive();
          break;
        case "clearLive":
          void clearLive();
          break;
        case "focusSearch":
          focusBibleSearch();
          break;
        case "selectPrev":
          selectPrevDetection();
          break;
        case "selectNext":
          selectNextDetection();
          break;
        case "detectionToPreview":
          void detectionToPreview();
          break;
        case "enqueuePreview":
          void enqueuePreview();
          break;
        case "liveFromQueueOrPreview":
          void liveFromQueueOrPreview();
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    sendPreviewToLive,
    clearLive,
    focusBibleSearch,
    selectPrevDetection,
    selectNextDetection,
    detectionToPreview,
    enqueuePreview,
    liveFromQueueOrPreview,
  ]);
}
