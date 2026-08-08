let audioContext: AudioContext | null = null;

/**
 * Browsers block audio until a user gesture has happened on the page — call
 * this from a click handler (e.g. the "Enable Alerts" button) to warm up the
 * AudioContext so later automatic alert beeps (triggered by a poll response,
 * not a click) aren't silently blocked.
 */
export function primeAlertSound(): void {
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

const ALARM_FREQUENCY_HZ = 1600;
const ALARM_PEAK_GAIN = 0.45;
const DOT_SECONDS = 0.12;
const DASH_SECONDS = 0.36;
const ELEMENT_GAP_SECONDS = 0.12;
const LETTER_GAP_SECONDS = 0.3;

/**
 * High-pitched Morse "SOS" (···  −−−  ···) — deliberately loud and piercing
 * so it's audible from across a kitchen, not a soft chime. A short (~5ms)
 * gain ramp on each tone avoids the click/pop a square wave makes when it
 * starts/stops mid-cycle, without softening the alarm quality.
 */
function beepAt(ctx: AudioContext, startOffsetSeconds: number, durationSeconds: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = ALARM_FREQUENCY_HZ;
  oscillator.connect(gain);
  gain.connect(ctx.destination);

  const startTime = ctx.currentTime + startOffsetSeconds;
  const endTime = startTime + durationSeconds;
  const rampSeconds = 0.005;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(ALARM_PEAK_GAIN, startTime + rampSeconds);
  gain.gain.setValueAtTime(ALARM_PEAK_GAIN, endTime - rampSeconds);
  gain.gain.linearRampToValueAtTime(0, endTime);

  oscillator.start(startTime);
  oscillator.stop(endTime);
}

export function playAlertSound(): void {
  const ctx = audioContext ?? new AudioContext();
  audioContext = ctx;

  function sosPatternAt(patternStart: number): number {
    let t = patternStart;
    const dot = () => {
      beepAt(ctx, t, DOT_SECONDS);
      t += DOT_SECONDS + ELEMENT_GAP_SECONDS;
    };
    const dash = () => {
      beepAt(ctx, t, DASH_SECONDS);
      t += DASH_SECONDS + ELEMENT_GAP_SECONDS;
    };

    dot();
    dot();
    dot();
    t += LETTER_GAP_SECONDS - ELEMENT_GAP_SECONDS;
    dash();
    dash();
    dash();
    t += LETTER_GAP_SECONDS - ELEMENT_GAP_SECONDS;
    dot();
    dot();
    dot();

    return t;
  }

  const patternEnd = sosPatternAt(0);
  sosPatternAt(patternEnd + LETTER_GAP_SECONDS);
}
