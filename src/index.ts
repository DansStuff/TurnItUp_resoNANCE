import {
  PBAudioAnalysisMode,
  AudioAnalysis,
  AudioSource,
  engine,
  Entity,
  Transform,
  AudioAnalysisView,
  AvatarEmoteCommand,
  AssetLoad
} from '@dcl/sdk/ecs'

import { 
  syncEntity,
  isStateSyncronized 
} from '@dcl/sdk/network'

import { 
  Color4,
  Vector3
} from '@dcl/sdk/math'

import { Emoting, VisualBar, DancerCounter, HypeMeter, Woofer, Tweeter } from './components'
import { Constants } from './data'
import {
  createLogHypeThresholdChange,
  createSongChangeHypeThresholdListener,
  createHypeTierDirectionStingerListener,
  createSpotlightChangeHypeThresholdListener,
  createFireworksHypeThresholdListener,
} from './listeners'
import {
  animateVisualizer,
  cancelEmotes,
  debugDancerCounter,
  animateNeedle,
  trackHype,
  AudioSlot,
  animateWoofers,
  animateTweeters,
  managePlayerState,
  rotateSpotlights,
  updateSpotlightIntensity,
} from './systems'

const BANDS: number = 8

/** If true, `Bar1.glb` maps to the last band and `Bar8.glb` to the first. */
const REVERSE_VISUAL_BAR_ORDER = true

const BARS_HEIGHT: number = 10;


const AMPLITUDE_VISUAL_BASE : number = 1;
const AMPLITUDE_VISUAL_SCALE : number = 10;

/** @dcl/ecs default system priority (`SYSTEMS_REGULAR_PRIORITY` in engine). */
const SYSTEM_PRIORITY_DEFAULT = 100_000

export function main() {
  console.log("Init")
  AssetLoad.create(engine.RootEntity, {
    assets: [
      "assets/scene/Audio/dcl_loop1.mp3",
      "assets/scene/Audio/dcl_loop2.mp3",
      "assets/scene/Audio/dcl_loop3.mp3",
      "assets/scene/images/mask1.png",
      "assets/scene/images/mask2.png",
    ],
  })

  

  const currentAnalysis: AudioAnalysisView = { amplitude: 0, bands: new Array<number>(BANDS) }

  const counterEntity = engine.addEntity()
  DancerCounter.create(counterEntity, {
    count: 0
  })
  Transform.create(counterEntity, {
    position: Vector3.create(0,0,0)
  })
  syncEntity(counterEntity, [DancerCounter.componentId], 1)
  
  const hypeMeterEntity = engine.addEntity()

  // One layer per `Constants.HypeTrackClipUrls` entry; all play muted until hype picks the audible layer.
  const audioSlots: AudioSlot[] = []

  //todo: VVV this part is probably AI halluc with performance implications, re-eval if have time
  // Reserved slot 0: first scene AudioSource often never gets FFT; see docs/DCL-AudioAnalysis-first-source-zeros.md
  const audioAnalysisBootstrap = engine.addEntity()
  Transform.create(audioAnalysisBootstrap, { position: Vector3.create(0, 0, 0) })
  AudioSource.create(audioAnalysisBootstrap, {
    audioClipUrl: Constants.AudioAnalysisBootstrapClipUrl,
    playing: true,
    loop: true,
    global: true,
    volume: 0,
    currentTime: 0
  })
  AudioAnalysis.createAudioAnalysis(audioAnalysisBootstrap)
  audioSlots.push({ entity: audioAnalysisBootstrap })

  for (const clipUrl of Constants.HypeTrackClipUrls) {
    const e = engine.addEntity()
    Transform.create(e, { position: Vector3.create(0, 0, 0) })
    AudioSource.create(e, {
      audioClipUrl: clipUrl,
      playing: true,
      loop: true,
      global: true,
      volume: 0,
      currentTime: 0
    })
    AudioAnalysis.createAudioAnalysis(e)
    audioSlots.push({ entity: e })
  }

  HypeMeter.create(hypeMeterEntity, {
    hype: 0,
    lastThreshold: 0,
    currentThreshold: 0,
    activeAudioEntity: audioSlots[1].entity,
    audioPlaying: false
  })

  for (let n = 1; n <= BANDS; n++) {
    const barEntity = engine.getEntityOrNullByName(`Bar${n}.glb`)
    if (barEntity === null) {
      console.log(`[VisualBar] Scene entity not found: Bar${n}.glb`)
      continue
    }
    const bandIndex = REVERSE_VISUAL_BAR_ORDER ? BANDS - n : n - 1
    VisualBar.create(barEntity, { index: bandIndex })

    //just do it again cus lazy
    const barEntity2 = engine.getEntityOrNullByName(`Bar${n}.glb_2`)
    if (barEntity2 === null) {
      console.log(`[VisualBar] Scene entity not found: Bar${n}.glb_2`)
      continue
    }
    const bandIndex2 = REVERSE_VISUAL_BAR_ORDER ? BANDS - n : n - 1
    VisualBar.create(barEntity2, { index: bandIndex2 })
  }

  const needleEntity = engine.getEntityOrNullByName('Needle.glb')

  const woofers = engine.getEntitiesByTag('Woofer')
  for (const wooferEntity of woofers) {
    Woofer.create(wooferEntity, {})
  }

  const tweeters = engine.getEntitiesByTag('Tweeter')
  for (const tweeterEntity of tweeters) {
    Tweeter.create(tweeterEntity, {})
  }

  console.log("sync?: ", isStateSyncronized())

  //there is no way to listen for emote stopping or cancelation so need to poll for it, this likely misses a bunch of corner cases
  engine.addSystem(cancelEmotes(counterEntity))
  engine.addSystem(debugDancerCounter(counterEntity), SYSTEM_PRIORITY_DEFAULT, 'debugDancerCounter')

  // `readIntoView` before bars: @dcl/ecs runs higher numeric priority first (`b.priority - a.priority`).
  engine.addSystem(
    trackHype(hypeMeterEntity, counterEntity, currentAnalysis, [
      createLogHypeThresholdChange(),
      createSongChangeHypeThresholdListener(hypeMeterEntity, audioSlots),
      createHypeTierDirectionStingerListener(),
      createSpotlightChangeHypeThresholdListener(),
      createFireworksHypeThresholdListener(),
    ]),
    SYSTEM_PRIORITY_DEFAULT + 1,
    'trackHype'
  )
  engine.addSystem(
    animateVisualizer(currentAnalysis, counterEntity, hypeMeterEntity),
    SYSTEM_PRIORITY_DEFAULT,
    'animateVisualizer'
  )
  engine.addSystem(
    animateWoofers(currentAnalysis),
    SYSTEM_PRIORITY_DEFAULT,
    'animateWoofers'
  )
/* --this is really visible with current music
  engine.addSystem(
    animateTweeters(currentAnalysis),
    SYSTEM_PRIORITY_DEFAULT,
    'animateTweeters'
s  )
    */

  engine.addSystem(
    managePlayerState(counterEntity),
    SYSTEM_PRIORITY_DEFAULT,
    'managePlayerState'
  )
  engine.addSystem(rotateSpotlights(), SYSTEM_PRIORITY_DEFAULT, 'rotateSpotlights')
  engine.addSystem(
    updateSpotlightIntensity(hypeMeterEntity),
    SYSTEM_PRIORITY_DEFAULT,
    'updateSpotlightIntensity'
  )

  if (needleEntity) {
    engine.addSystem(animateNeedle(hypeMeterEntity, needleEntity), SYSTEM_PRIORITY_DEFAULT, 'animateNeedle')
  }
}