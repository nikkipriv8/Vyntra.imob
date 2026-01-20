let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  return audioCtx;
}

export async function ensureAudioEnabled() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === "running";
}

export async function playNotificationBeep(opts?: { volume?: number; frequency?: number }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state !== "running") {
    // Must be resumed by a user gesture; fail silently.
    return;
  }

  const volume = Math.min(Math.max(opts?.volume ?? 0.06, 0), 1);
  const frequency = Math.min(Math.max(opts?.frequency ?? 880, 80), 2000);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = frequency;

  // Soft attack/release to avoid clicking.
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.18);
}
