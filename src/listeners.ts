import { AudioSource, Entity } from '@dcl/sdk/ecs'

import { HypeMeter } from './components'
import type { AudioSlot } from './systems'

/** Payload when `HypeMeter.currentThreshold` changes after hype math runs. */
export type HypeThresholdChangeContext = {
  lastThreshold: number
  currentThreshold: number
}

export type HypeThresholdChangeListener = (ctx: HypeThresholdChangeContext) => void

function clampSlotIndex(idx: number, slotsLength: number) {
  if (slotsLength <= 0) return 0
  if (idx < 0) return 0
  if (idx >= slotsLength) return slotsLength - 1
  return idx
}

/** Logs hype track threshold transitions (for debugging). */
export function createLogHypeThresholdChange(): HypeThresholdChangeListener {
  return ({ lastThreshold, currentThreshold }) => {
    console.log(`[Hype] threshold ${lastThreshold} -> ${currentThreshold}`)
  }
}

/**
 * On hype threshold change: updates `HypeMeter` active layer and mutes/unmutes
 * `AudioSource` volumes (`audioSlots[0]` is bootstrap, never audible).
 */
export function createSongChangeHypeThresholdListener(
  hypeMeterEntity: Entity,
  audioSlots: readonly AudioSlot[]
): HypeThresholdChangeListener {
  return ({ currentThreshold }) => {
    const hypeMeter = HypeMeter.getMutable(hypeMeterEntity)

    hypeMeter.audioPlaying = true

    if (currentThreshold === 0) {
      hypeMeter.audioPlaying = false
    } else {
      hypeMeter.activeAudioEntity =
        audioSlots[clampSlotIndex(currentThreshold, audioSlots.length)].entity
    }

    if (hypeMeter.audioPlaying) {
      const active = hypeMeter.activeAudioEntity
      for (const { entity } of audioSlots) {
        AudioSource.getMutable(entity).volume = entity === active ? 1 : 0
      }
    } else {
      for (const { entity } of audioSlots) {
        AudioSource.getMutable(entity).volume = 0
      }
    }
  }
}
