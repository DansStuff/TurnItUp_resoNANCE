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

import { Emoting, VisualBar, DancerCounter, HypeMeter } from './components'
import { animateVisualizer, positionAudio, processAudioStream, cancelEmotes, animateNeedle, trackHype } from './systems'

const BANDS: number = 8

/** If true, `Bar1.glb` maps to the last band and `Bar8.glb` to the first. */
const REVERSE_VISUAL_BAR_ORDER = true

const BARS_HEIGHT: number = 10;


const AMPLITUDE_VISUAL_BASE : number = 1;
const AMPLITUDE_VISUAL_SCALE : number = 10;

export function main() {
  console.log("Init")
  const currentAnalysis: AudioAnalysisView = { amplitude: 0, bands: new Array<number>(BANDS) }

  const counterEntity = engine.addEntity()
  DancerCounter.create(counterEntity, {
    count: 0
  })
  syncEntity(counterEntity, [DancerCounter.componentId], 0) //using a sync id of 0 because no other entities in this scene need to be synced
  
  const hypeMeterEntity = engine.addEntity()
  HypeMeter.create(hypeMeterEntity, {
    hype: 0,
    lastThreshold: 0,
    currentThreshold: 0
  })

  const audioEntity = engine.addEntity()
  AudioSource.create(audioEntity, {
    audioClipUrl: 'assets/scene/Audio/Vexento.mp3',
    playing: true,
    loop: true
  })
  AudioAnalysis.createAudioAnalysis(audioEntity)
  Transform.create(audioEntity, { position: Vector3.create(16, 0, 16) })

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
    }

    
  })

  // Bands animation
  engine.addSystem(animateVisualizer(currentAnalysis, counterEntity, hypeMeterEntity))
  // Keep audio source on top of the local player
  engine.addSystem(positionAudio(audioEntity))
  
  engine.addSystem(processAudioStream(audioEntity, currentAnalysis))

  //there is no way to listen for emote stopping or cancelation so need to poll for it, this likely misses a bunch of corner cases
  engine.addSystem(cancelEmotes(counterEntity))

  if(needleEntity){
    engine.addSystem(animateNeedle(hypeMeterEntity, needleEntity))
  }
  
  engine.addSystem(trackHype(hypeMeterEntity, counterEntity))

}