// A gently moving waveform (see .wave in src/styles/global.css), different for each episode.
export const waveBars = (seed: number, count = 24): number[] =>
  Array.from({ length: count }, (_, i) =>
    Number((0.22 + 0.78 * Math.abs(Math.sin(i * 0.6 + seed) * Math.cos(i * 0.27 + seed * 1.7))).toFixed(2))
  );
