import {
  PBAudioAnalysisMode,
  AudioAnalysis,
  AudioSource,
  engine,
  Entity,
  Transform,
  AudioAnalysisView
} from '@dcl/sdk/ecs'
import { Color4, Vector3 } from '@dcl/sdk/math'

import { VisualBar } from './components'

const BANDS: number = 8

/** If true, `Bar1.glb` maps to the last band and `Bar8.glb` to the first. */
const REVERSE_VISUAL_BAR_ORDER = true

const BARS_HEIGHT: number = 12;


const AMPLITUDE_VISUAL_BASE : number = 1;
const AMPLITUDE_VISUAL_SCALE : number = 10;

export function main() {
  console.log("Init")
  const currentAnalysis: AudioAnalysisView = { amplitude: 0, bands: new Array<number>(BANDS) }

  

  const audioEntity = engine.addEntity()
  AudioSource.create(audioEntity, {
    audioClipUrl: 'assets/scene/Audio/Vexento.mp3',
    playing: true,
    loop: true
  })
  AudioAnalysis.createAudioAnalysis(audioEntity)
  Transform.create(audioEntity, { position: Vector3.create(12, 0, 12) })

  //if(1 === 1)return

  for (let n = 1; n <= BANDS; n++) {
    const barEntity = engine.getEntityOrNullByName(`Bar${n}.glb`)
    if (barEntity === null) {
      console.log(`[VisualBar] Scene entity not found: Bar${n}.glb`)
      continue
    }
    const bandIndex = REVERSE_VISUAL_BAR_ORDER ? BANDS - n : n - 1
    VisualBar.create(barEntity, { index: bandIndex })

  }

  // Read
  engine.addSystem(() => {
    AudioAnalysis.readIntoView(audioEntity, currentAnalysis)
  })

  // Bands
  engine.addSystem(() => {
    const entities = engine.getEntitiesWith(VisualBar, Transform)
    for (const [entity, _, _transform] of entities) {
      const mutableTransform = Transform.getMutable(entity)
      const index = VisualBar.get(entity).index

      const current = Vector3.One();
      current.y = currentAnalysis.bands[index] * BARS_HEIGHT;
      mutableTransform.scale = current
      
    }
  })

}