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

/** Three sharp beeps — deliberately attention-grabbing, not a soft chime, since this means "start preparing an order now." */
export function playAlertSound(): void {
  const ctx = audioContext ?? new AudioContext();
  audioContext = ctx;

  const beepAt = (startOffsetSeconds: number) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(ctx.destination);

    const startTime = ctx.currentTime + startOffsetSeconds;
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.18);
  };

  beepAt(0);
  beepAt(0.28);
  beepAt(0.56);
}
