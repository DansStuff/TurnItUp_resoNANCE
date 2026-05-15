/** One entry per hype stage (threshold 1 → first URL, etc.). `MaxHypePerDancer` is derived from this list. */
const hypeTrackClipUrls = [
  'assets/scene/Audio/dcl_loop1.mp3',
  'assets/scene/Audio/dcl_loop2.mp3',
  'assets/scene/Audio/dcl_loop3.mp3'
]

export const Constants = {
  HypeTrackClipUrls: hypeTrackClipUrls,
  MaxHypePerDancer: 1.0 / hypeTrackClipUrls.length,
  NumTracks: hypeTrackClipUrls.length,
  HypeAccelPerDancer: 0.08,
  HypeDecay: 1.0,
  BarsHeight: 10,
  /**
   * Muted `AudioSource` used only to occupy the first analysis slot (see `docs/DCL-AudioAnalysis-first-source-zeros.md`).
   * Defaults to the first hype clip; replace with a tiny silent loop asset to avoid decoding the same long track twice.
   */
  AudioAnalysisBootstrapClipUrl: hypeTrackClipUrls[0],
  /** Yaw rotation for player spotlights, in degrees per second. */
  SpotlightRotationSpeed: 120,
  SpotlightIntensityMin: 0,
  SpotlightIntensityMax: 300_000,
  SpotlightIntensityHypeMin: 0.01,
  SpotlightIntensityHypeMax: 1,
}