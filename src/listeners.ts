import { getActionEvents } from '@dcl/asset-packs/dist/events'
import { AudioSource, Entity, engine, LightSource, Material } from '@dcl/sdk/ecs'
import { Color3 } from '@dcl/sdk/math'

import { HypeMeter, Spotlight } from './components'
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
  return ({ lastThreshold, currentThreshold }) => {
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

/**
 * On hype threshold step: one-shots for tier up vs tier down.
 * Wire `AudioSource` (or another player) here when clips are ready.
 */
export function createHypeTierDirectionStingerListener(): HypeThresholdChangeListener {
  return ({ lastThreshold, currentThreshold }) => {
    if (currentThreshold > lastThreshold) {
      // TODO: play "tier increased" sound (one-shot)
    } else if (currentThreshold < lastThreshold) {
      // TODO: play "tier decreased" sound (one-shot, different clip)
    }
  }
}

/** HSL → RGB; hue/saturation/lightness in [0, 1]. */
//This enables us to ensure that we only select saturated colors
function colorFromHsl(h: number, s: number, l: number) {
  if (s === 0) return Color3.create(l, l, l)

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hueToChannel = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }

  return Color3.create(hueToChannel(h + 1 / 3), hueToChannel(h), hueToChannel(h - 1 / 3))
}

function randomColor() {
  const hue = Math.random()
  const lightness = 0.35 + Math.random() * 0.3
  return colorFromHsl(hue, 1, lightness)
}

/** On hype threshold reaching 3: fires every scene firecracker smart item (`Shoot` action). */
export function createFireworksHypeThresholdListener(): HypeThresholdChangeListener {
  return ({ currentThreshold }) => {
    
    if (currentThreshold == 3){ 

      for (const entity of engine.getEntitiesByTag('Firecracker')) {
        getActionEvents(entity).emit('Shoot', {})
      }
    }
  }
}

/** On hype threshold change: randomizes color for each player spotlight (`Spotlight` → `lightEntity`). */
export function createSpotlightChangeHypeThresholdListener(): HypeThresholdChangeListener {
  return ({currentThreshold}) => {
    for (const [playerEntity] of engine.getEntitiesWith(Spotlight)) {
      const { lightEntity } = Spotlight.get(playerEntity)
      if (!LightSource.has(lightEntity)) continue
      const light = LightSource.getMutable(lightEntity)
      
       
       switch(currentThreshold){
        case 1:
          light.color = randomColor()
          light.shadowMaskTexture = undefined
          break
        case 2:
          light.color = randomColor()
          light.shadowMaskTexture = Material.Texture.Common({ src: 'assets/scene/images/mask1.png' })

          break
        case 3:
          light.color = randomColor()
          light.shadowMaskTexture = Material.Texture.Common({ src: 'assets/scene/images/mask2.png' })
       }
          
    }
  }
}
