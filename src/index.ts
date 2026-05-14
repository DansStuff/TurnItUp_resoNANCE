import {
  PBAudioAnalysisMode,
  AudioAnalysis,
  AudioSource,
  engine,
  Entity,
  Transform,
  AudioAnalysisView,
  AvatarEmoteCommand,
} from '@dcl/sdk/ecs'

import { 
  syncEntity 
} from '@dcl/sdk/network'

import { 
  Color4,
  Vector3
} from '@dcl/sdk/math'

import { Emoting, VisualBar, DancerCounter, HypeMeter, Woofer, Tweeter } from './components'
import { Constants } from './data'
import { createLogHypeThresholdChange, createSongChangeHypeThresholdListener } from './listeners'
import {
  animateVisualizer,
  cancelEmotes,
  animateNeedle,
  trackHype,
  AudioSlot,
  animateWoofers,
  animateTweeters,
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
  const currentAnalysis: AudioAnalysisView = { amplitude: 0, bands: new Array<number>(BANDS) }

  const counterEntity = engine.addEntity()
  DancerCounter.create(counterEntity, {
    count: 0
  })
  syncEntity(counterEntity, [DancerCounter.componentId], 0) //using a sync id of 0 because no other entities in this scene need to be synced
  
  const hypeMeterEntity = engine.addEntity()

  // One layer per `Constants.HypeTrackClipUrls` entry; all play muted until hype picks the audible layer.
  const audioSlots: AudioSlot[] = []

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

  // Listen for local-player emote commands and log looped ones.
  AvatarEmoteCommand.onChange(engine.PlayerEntity, (emoteCommand) => {
    if (!emoteCommand) {
      return
    }

    if (!emoteCommand.loop) return
    
    if (Emoting.has(engine.PlayerEntity)) {
      console.log(`[Emote] Local player updated looped emote: ${emoteCommand.emoteUrn}`)
      const mutable = Emoting.getMutable(engine.PlayerEntity)
      mutable.emoteUrn = emoteCommand.emoteUrn
      mutable.timestamp = emoteCommand.timestamp
    } else {
      console.log(`[Emote] Local player started looped emote: ${emoteCommand.emoteUrn}`)
      Emoting.create(engine.PlayerEntity, {
        emoteUrn: emoteCommand.emoteUrn,
        timestamp: emoteCommand.timestamp
      })
      const dancerCounter = DancerCounter.getMutable(counterEntity)
      dancerCounter.count += 1
      console.log("DancerCounter: ", dancerCounter.count)
    }

    
  })

  //there is no way to listen for emote stopping or cancelation so need to poll for it, this likely misses a bunch of corner cases
  engine.addSystem(cancelEmotes(counterEntity))

  // `readIntoView` before bars: same default priority has undefined order in @dcl/ecs.
  engine.addSystem(
    trackHype(hypeMeterEntity, counterEntity, currentAnalysis, [
      createLogHypeThresholdChange(),
      createSongChangeHypeThresholdListener(hypeMeterEntity, audioSlots),
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

  engine.addSystem(
    animateTweeters(currentAnalysis),
    SYSTEM_PRIORITY_DEFAULT,
    'animateTweeters'
  )

  if (needleEntity) {
    engine.addSystem(animateNeedle(hypeMeterEntity, needleEntity), SYSTEM_PRIORITY_DEFAULT, 'animateNeedle')
  }
}