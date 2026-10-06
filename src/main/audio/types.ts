export { TARGET_SAMPLE_RATE } from "../../shared/audio/constants";

/**
 * Renderer-side audio helpers (device list happens in renderer via Web APIs).
 * Main process only receives PCM for STT — no recording to disk by default.
 */
export interface AudioDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
  isDefault: boolean;
}
