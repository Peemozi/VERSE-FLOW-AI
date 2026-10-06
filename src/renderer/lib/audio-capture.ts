import { TARGET_SAMPLE_RATE } from "@shared/audio/constants";

export interface CapturedDevice {
  deviceId: string;
  label: string;
  groupId: string;
  isDefault: boolean;
}

export async function listInputDevices(): Promise<CapturedDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  // Prompt once so labels are available
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
    tmp.getTracks().forEach((t) => t.stop());
  } catch {
    // permission denied — still try enumerate
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((d) => d.kind === "audioinput");
  return inputs.map((d, i) => ({
    deviceId: d.deviceId,
    label: d.label || `Microphone ${i + 1}`,
    groupId: d.groupId,
    isDefault: d.deviceId === "default" || i === 0,
  }));
}

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Int16Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const newLen = Math.floor(input.length / ratio);
  const out = new Int16Array(newLen);
  for (let i = 0; i < newLen; i++) {
    const idx = Math.floor(i * ratio);
    const s = Math.max(-1, Math.min(1, input[idx] ?? 0));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export interface AudioCaptureHandle {
  stop: () => void;
  getLevel: () => number;
}

/**
 * Capture mic → level meter + PCM16 @ 16kHz chunks (discarded after send; no disk recording).
 */
export async function startAudioCapture(options: {
  deviceId: string | null;
  onPcm: (pcm: ArrayBuffer) => void;
  onLevel: (level: number) => void;
}): Promise<AudioCaptureHandle> {
  const constraints: MediaStreamConstraints = {
    audio: options.deviceId
      ? { deviceId: { exact: options.deviceId }, echoCancellation: true, noiseSuppression: true }
      : { echoCancellation: true, noiseSuppression: true },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  const ctx = new AudioContext();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  // ScriptProcessor is deprecated but reliable without a separate worklet bundle.
  const bufferSize = 4096;
  const processor = ctx.createScriptProcessor(bufferSize, 1, 1);
  let level = 0;

  processor.onaudioprocess = (ev) => {
    const input = ev.inputBuffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    level = Math.sqrt(sum / input.length);
    options.onLevel(level);

    const pcm = downsampleTo16k(input, ctx.sampleRate);
    const copy = new Int16Array(pcm.length);
    copy.set(pcm);
    options.onPcm(copy.buffer);
  };

  source.connect(processor);
  processor.connect(ctx.destination);

  return {
    getLevel: () => level,
    stop: () => {
      try {
        processor.disconnect();
        source.disconnect();
        analyser.disconnect();
      } catch {
        // ignore
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
