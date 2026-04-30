import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { AudioAnalysisView, engine, Transform, Entity, AudioAnalysis, inputSystem, InputAction, PointerEventType } from '@dcl/sdk/ecs'
import { VisualBar, Emoting, DancerCounter, HypeMeter } from './components'
import { Constants } from './data'

// Bands animation
export function animateVisualizer(currentAnalysis: AudioAnalysisView, barsHeight: number, dancerCounterEntity : Entity) {
  return () => {
    const entities = engine.getEntitiesWith(VisualBar, Transform)
    
    for (const [entity] of entities) {
        const mutableTransform = Transform.getMutable(entity)
        const readonlyCounter = DancerCounter.get(dancerCounterEntity)

        const index = VisualBar.get(entity).index

        const current = Vector3.One()
        current.y = (currentAnalysis.bands[index] * barsHeight * readonlyCounter.count) + 0.1
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

export function positionAudio(audioEntity: Entity) {
    return () => {
        const playerTransform = Transform.getOrNull(engine.PlayerEntity)
        if (!playerTransform) return

        const audioTransform = Transform.getMutable(audioEntity)
        audioTransform.position = Vector3.create(
            playerTransform.position.x,
            playerTransform.position.y,
            playerTransform.position.z
        )
    }
}

export function trackHype(hypeMeterEntity : Entity, dancerCounterEntity : Entity){
    
    //max hype between 0 and 1, used to multiply other systems
    
    return (dt: number) => {
        const hypeMeter = HypeMeter.getMutable(hypeMeterEntity)
        const dancerCounter = DancerCounter.get(dancerCounterEntity) 
        
        var hypeAccel = dancerCounter.count * Constants.HypeAccelPerDancer
        var maxHype = dancerCounter.count * Constants.MaxHypePerDancer
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
            
    }
        
}

export function processAudioStream(audioEntity : Entity, currentAnalysis : AudioAnalysisView){
    return () => {
        AudioAnalysis.readIntoView(audioEntity, currentAnalysis)
        //todo: perform secondary analysis here (bass edge detection etc.)
    }
}

export function cancelEmotes(dancerCounterEntity : Entity){
    return () => {
        if (Emoting.has(engine.PlayerEntity)) {
            const moved =
                inputSystem.isTriggered(InputAction.IA_JUMP, PointerEventType.PET_DOWN) ||
                inputSystem.isPressed(InputAction.IA_FORWARD) ||
                inputSystem.isPressed(InputAction.IA_BACKWARD) ||
                inputSystem.isPressed(InputAction.IA_LEFT) ||
                inputSystem.isPressed(InputAction.IA_RIGHT)

            if (moved) {
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