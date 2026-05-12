# Bug report draft: `AudioAnalysis` stays zero on the first scene `AudioSource`

## Summary

On Decentraland SDK 7, the `AudioAnalysis` component on the **first** `AudioSource` entity created in scene code appears to stay at default values (e.g. `band0`–`band7` and `amplitude` all `0`) even while that source is playing at non‑zero volume. Calling `AudioAnalysis.readIntoView(firstEntity, view)` therefore fills the view with zeros.

A **second** `AudioSource` + `AudioAnalysis` pair created the same way (same clip URL, same options) starts receiving non‑zero band data as expected once it is the active audible layer.

This was observed while building a hype meter that switches which track is audible and which entity is passed to `readIntoView` each frame.

## Environment (fill in when filing)

- **@dcl/sdk** (from `package.json`): `7.20.4-22561917759.commit-d944d0d`
- **Client**: Explorer desktop / web + build number
- **Scene**: SDK7 ECS, single parcel (adjust)

## Reproduction (conceptual)

1. Create entity `A`: `Transform`, `AudioSource` (`playing: true`, `loop: true`, `global: true`, `volume: 1`), `AudioAnalysis.createAudioAnalysis(A)`.
2. Each frame: `AudioAnalysis.readIntoView(A, view)` and log `view.bands[0]` (or any band).
3. **Observe**: bands stay `0` (or do not reflect the playing audio).
4. Create entity `B` the same way (can use same `audioClipUrl`).
5. Route audio so `B` is the one playing audibly (or also at `volume: 1`).
6. Call `AudioAnalysis.readIntoView(B, view)` each frame.
7. **Observe**: bands become non‑zero as expected.

Minimal scene repro can be reduced to: two identical sources; only read analysis from `A` vs only from `B` and compare.

## Expected behavior

For every `AudioSource` that is actively playing and has `AudioAnalysis` attached, the engine should update the `AudioAnalysis` protobuf fields each frame (or at the documented cadence) so `readIntoView` reflects the audio driving that source—including the **first** such entity in the scene.

## Actual behavior

The first `AudioSource` + `AudioAnalysis` pair behaves as if analysis is never computed (all zeros in component / after `readIntoView`). Subsequent pairs work.

## Workaround used in this repo

1. Add a **muted bootstrap** entity at `audioSlots[0]`: `AudioSource` at `volume: 0`, `playing: true`, plus `AudioAnalysis`, never chosen as the audible layer.
2. Map hype tier `N` to `audioSlots[N]` so tier 1 uses the **second** entity (`audioSlots[1]`), which receives valid FFT data.
3. Run `trackHype` (which calls `readIntoView`) at a **higher** system priority than the visualizer so the view is filled before bars read it (`@dcl/ecs` default priority order between equal‑priority systems is not stable).

## Making the bootstrap lighter (optional)

The bootstrap still needs a valid `audioClipUrl` and a playing graph in practice; the SDK does not document a “component‑only” analysis probe.

To reduce cost vs decoding the same long music loop twice:

- Point `Constants.AudioAnalysisBootstrapClipUrl` at a **very small** silent loop asset you ship with the scene (short OGG/MP3, looped), instead of reusing a full hype track URL.
- Keep `volume: 0` and never raise it for the bootstrap entity.

## Links / references

- Scene workaround: `src/index.ts` (bootstrap entity), `src/systems.ts` (`audioSlots[0]` reserved, `clampSlotIndex(hypeMeter.currentThreshold, …)` for active entity).
