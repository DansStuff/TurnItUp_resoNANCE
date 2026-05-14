import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { AudioAnalysisView, engine, Transform, Entity, AudioAnalysis, inputSystem, InputAction, PointerEventType, AudioSource } from '@dcl/sdk/ecs'
import { VisualBar, Emoting, DancerCounter, HypeMeter, Woofer, Tweeter } from './components'
import { Constants } from './data'
import type { HypeThresholdChangeContext, HypeThresholdChangeListener } from './listeners'

export type AudioSlot = { entity: Entity }

// Bands animation
export function animateVisualizer(currentAnalysis: AudioAnalysisView, dancerCounterEntity : Entity, hypeMeterEntity : Entity) {
  return () => {
    
    const entities = engine.getEntitiesWith(VisualBar, Transform)
    
    const readonlyHypeMeter = HypeMeter.get(hypeMeterEntity)
    for (const [entity] of entities) {
        const mutableTransform = Transform.getMutable(entity)

        const index = VisualBar.get(entity).index

        const rawHype = readonlyHypeMeter.hype
        const vizHype =
          readonlyHypeMeter.currentThreshold > 0
            ? Math.max(rawHype, 1.0 / Constants.NumTracks)
            : rawHype

        const current = Vector3.One()
        current.y = 0.1
        if(!isNaN(currentAnalysis.bands[index])){
            current.y = currentAnalysis.bands[index] * Constants.BarsHeight * vizHype + 0.1
        }
        mutableTransform.scale = current
    }
  }
}

export function animateWoofers(currentAnalysis: AudioAnalysisView){
    return () => {
        const entities = engine.getEntitiesWith(Woofer, Transform)
        for(const [entity] of entities){
            const mutableTransform = Transform.getMutable(entity)
            let current = Vector3.One()
            if (!isNaN(currentAnalysis.bands[2])) {
                current.z *= 1.0 + (currentAnalysis.bands[0] * 2)
            }
       
            mutableTransform.scale = current
        }
    }
}

export function animateTweeters(currentAnalysis: AudioAnalysisView){
    return () => {
        const entities = engine.getEntitiesWith(Tweeter, Transform)
        for(const [entity] of entities){
            const mutableTransform = Transform.getMutable(entity)
            let current = Vector3.One()
            if (!isNaN(currentAnalysis.bands[6])) {
                current.z *= 1.0 + (currentAnalysis.bands[6] * 5)
            }
            mutableTransform.scale = current
        }
    }
}


export function animateNeedle(hypeMeterEntity : Entity, needleEntity : Entity) {
    return () => {
        const mutableTransform = Transform.getMutable(needleEntity)
        const hypeMeter = HypeMeter.get(hypeMeterEntity)
        mutableTransform.rotation = Quaternion.fromAngleAxis(hypeMeter.hype * 175, Vector3.Backward())
    }
}

function clampSlotIndex(idx: number, slotsLength: number) {
    if (slotsLength <= 0) return 0
    if (idx < 0) return 0
    if (idx >= slotsLength) return slotsLength - 1
    return idx
}

export function trackHype(
    hypeMeterEntity: Entity,
    dancerCounterEntity: Entity,
    audioSlots: AudioSlot[],
    currentAnalysis: AudioAnalysisView,
    thresholdChangeListeners: readonly HypeThresholdChangeListener[]
) {
    //max hype between 0 and 1, used to multiply other systems
    return (dt: number) => {
        const hypeMeter = HypeMeter.getMutable(hypeMeterEntity)
        const dancerCounter = DancerCounter.get(dancerCounterEntity) 
        
        hypeMeter.lastThreshold = hypeMeter.currentThreshold

        //modify current hype level based on current number of dancers
        var hypeAccel = dancerCounter.count * Constants.HypeAccelPerDancer
        var maxHype = dancerCounter.count * 1
        if(maxHype > 1){
            maxHype = 1
        }
        if(hypeMeter.hype > maxHype){
            hypeMeter.hype -= Constants.HypeDecay * dt
        }else{
            hypeMeter.hype += hypeAccel * dt
        }
        if(hypeMeter.hype > 1){hypeMeter.hype = 1}
        if(hypeMeter.hype < 0){hypeMeter.hype = 0}   
        hypeMeter.currentThreshold = Math.floor(hypeMeter.hype / (1.0 / Constants.NumTracks))
        if(hypeMeter.hype > 0){
            hypeMeter.currentThreshold += 1
        }

        //react to changes in current hype level
        if(hypeMeter.currentThreshold != hypeMeter.lastThreshold){
            const thresholdCtx: HypeThresholdChangeContext = {
                lastThreshold: hypeMeter.lastThreshold,
                currentThreshold: hypeMeter.currentThreshold,
            }
            for (const listener of thresholdChangeListeners) {
                listener(thresholdCtx)
            }

            hypeMeter.audioPlaying = true

            //if everything should jsut be silent
            if(hypeMeter.currentThreshold == 0){

                hypeMeter.audioPlaying = false

            //otherwise a hype layer is playing (`audioSlots[0]` is a bootstrap slot, never audible)
            }else{

                hypeMeter.activeAudioEntity = audioSlots[clampSlotIndex(hypeMeter.currentThreshold, audioSlots.length)].entity

            }
            if(hypeMeter.audioPlaying){
                const active = hypeMeter.activeAudioEntity
                audioSlots.forEach(element => {
                    if(element.entity === active){
                        AudioSource.getMutable(element.entity).volume = 1 //todo: modulate by hype level a bit?
                    }else{
                        AudioSource.getMutable(element.entity).volume = 0
                    }
                })
            }else{
                audioSlots.forEach(element => {
                    AudioSource.getMutable(element.entity).volume = 0
                })
            }
        }
        
        if(hypeMeter.audioPlaying){
            AudioAnalysis.readIntoView(hypeMeter.activeAudioEntity, currentAnalysis)
        }
    }
}

export function cancelEmotes(dancerCounterEntity : Entity){
    return () => {
        if (Emoting.has(engine.PlayerEntity)) {
            const jumped  = inputSystem.isPressed(InputAction.IA_JUMP)
            const moved =
                
                inputSystem.isPressed(InputAction.IA_FORWARD) ||
                inputSystem.isPressed(InputAction.IA_BACKWARD) ||
                inputSystem.isPressed(InputAction.IA_LEFT) ||
                inputSystem.isPressed(InputAction.IA_RIGHT)

            if (moved || jumped) {
                const dancerCounter = DancerCounter.getMutable(dancerCounterEntity)
                console.log('Local player moved/jumped, removing Emoting component')
                Emoting.deleteFrom(engine.PlayerEntity)
                dancerCounter.count -= 1
                /*
                if (Spotlight.has(engine.PlayerEntity)) {
                    LightSource.getMutable(Spotlight.get(engine.PlayerEntity).lightEntity).active = false
                }
                */
            }
        }
    }
}