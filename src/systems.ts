import { 
    Quaternion,
    Vector3,
    Color3 } from '@dcl/sdk/math'

import {
  AudioAnalysisView,
  engine,
  Transform,
  Entity,
  AudioAnalysis,
  inputSystem,
  InputAction,
  PlayerIdentityData,
  AvatarEmoteCommand,
  LightSource,
  Material
} from '@dcl/sdk/ecs'

import {
  VisualBar,
  Emoting,
  DancerCounter,
  HypeMeter,
  Woofer,
  Tweeter,
  PlayerInitialized,
  Spotlight
} from './components'

import { Constants } from './data'
import { isStateSyncronized } from '@dcl/sdk/network'

function applyDancerCountDelta(counterEntity: Entity, delta: number) {
  if (!isStateSyncronized()) return
  const dancerCounter = DancerCounter.getMutable(counterEntity)
  if((dancerCounter.count + delta) < 0){
    return
  }
  dancerCounter.count += delta
}

import type {
  HypeThresholdChangeContext,
  HypeThresholdChangeListener,
} from './listeners'

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
        mutableTransform.rotation = Quaternion.fromAngleAxis(hypeMeter.hype * 162, Vector3.Backward())
    }
}

export function trackHype(
    hypeMeterEntity: Entity,
    dancerCounterEntity: Entity,
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
        var maxHype = dancerCounter.count * Constants.MaxHypePerDancer
        //console.log(dancerCounter.count)
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
        }
        
        if(hypeMeter.audioPlaying){
            AudioAnalysis.readIntoView(hypeMeter.activeAudioEntity, currentAnalysis)
        }
    }
}

export function managePlayerState(counterEntity : Entity) {
    return () => {
        for (const [entity] of engine.getEntitiesWith(PlayerIdentityData)) {
            if (PlayerInitialized.has(entity)) continue

            // Create spotlight
            const lightEntity = engine.addEntity()
            Transform.create(lightEntity, {
                position: Vector3.create(16, 5, 16),
                rotation: Quaternion.fromEulerDegrees(90, 0, 0)
            })
            LightSource.create(lightEntity, {
                type: LightSource.Type.Spot({
                    innerAngle: 25,
                    outerAngle: 90,
                }),
                color: Color3.White(),
                intensity: Constants.SpotlightIntensityMin,
                range: 20,
                active: false,
                //shadowMaskTexture: Material.Texture.Common({ src: 'assets/scene/images/mask1.png' })
            })
            Spotlight.create(entity, { lightEntity })

            PlayerInitialized.create(entity)


            // Listen for emotes
            AvatarEmoteCommand.onChange(entity, (emote) => {
                if (!emote) return
                //console.log('Player', entity, 'used emote:', emote.emoteUrn)



                // TODO: react to emote (e.g. change spotlight color, intensity, etc.)

                if (emote.loop && Spotlight.has(entity)) {
                    const lightEntity = Spotlight.get(entity).lightEntity
                    const lightTransform = Transform.getMutable(lightEntity)
                    const lightComponent = LightSource.getMutable(lightEntity)
                    const playerTransform = Transform.get(entity)
                    lightTransform.position = Vector3.create(playerTransform.position.x, 5, playerTransform.position.z)
                    lightComponent.active = true

                }

                if (emote.loop) {
                    if (Emoting.has(entity)) {
                        const mutable = Emoting.getMutable(entity)
                        mutable.emoteUrn = emote.emoteUrn
                        mutable.timestamp = emote.timestamp
                    } else {
                        Emoting.create(entity, {
                            emoteUrn: emote.emoteUrn,
                            timestamp: emote.timestamp
                        })
                        if (engine.PlayerEntity === entity) {
                            applyDancerCountDelta(counterEntity, 1)
                        }
                        const pos = Transform.get(entity).position
                        lastPlayerPositions.set(entity, Vector3.create(pos.x, pos.y, pos.z))
                    }
                    console.log('Player', entity, 'started looping emote:', emote.emoteUrn)
                }
            })

        }

        

/*
        // Clean up disconnected players
        for (const [entity] of engine.getEntitiesWith(PlayerInitialized)) {
            if (PlayerIdentityData.has(entity)) continue

            console.log('Cleaning up disconnected player:', entity)
            if (Spotlight.has(entity)) {
                engine.removeEntity(Spotlight.get(entity).lightEntity)
                Spotlight.deleteFrom(entity)
            }
            if (Emoting.has(entity)) Emoting.deleteFrom(entity)
            PlayerInitialized.deleteFrom(entity)
        }
            */
    }
}
function spotlightIntensityFromHype(hype: number): number {
    const { SpotlightIntensityHypeMin, SpotlightIntensityHypeMax, SpotlightIntensityMin, SpotlightIntensityMax } = Constants
    const t = Math.min(
        1,
        Math.max(0, (hype - SpotlightIntensityHypeMin) / (SpotlightIntensityHypeMax - SpotlightIntensityHypeMin))
    )
    return SpotlightIntensityMin + t * (SpotlightIntensityMax - SpotlightIntensityMin)
}

export function updateSpotlightIntensity(hypeMeterEntity: Entity) {
    return () => {
        const hype = HypeMeter.get(hypeMeterEntity).hype
        const intensity = spotlightIntensityFromHype(hype)
        
        for (const [playerEntity] of engine.getEntitiesWith(Spotlight)) {
            const { lightEntity } = Spotlight.get(playerEntity)
            if (!LightSource.has(lightEntity)) continue
            LightSource.getMutable(lightEntity).intensity = intensity
        }
    }
}

export function rotateSpotlights() {
    return (dt: number) => {
        const angleDeg = Constants.SpotlightRotationSpeed * dt
        const deltaYaw = Quaternion.fromAngleAxis(angleDeg, Vector3.Up())
        for (const [playerEntity] of engine.getEntitiesWith(Spotlight)) {
            const { lightEntity } = Spotlight.get(playerEntity)
            const mutableTransform = Transform.getMutable(lightEntity)
            mutableTransform.rotation = Quaternion.multiply(deltaYaw, mutableTransform.rotation)
        }
    }
}

const lastPlayerPositions = new Map<Entity, Vector3>()
const MOVE_THRESHOLD = 0.01

export function debugDancerCounter(dancerCounterEntity: Entity) {
    return () => {
        const dancerCounter = DancerCounter.get(dancerCounterEntity)
        console.log('DancerCounter:', dancerCounter.count)
    }
}

export function cancelEmotes(dancerCounterEntity : Entity){
    return () => {

        for (const [entity] of engine.getEntitiesWith(PlayerIdentityData)) {

            
            if (!Emoting.has(entity)) continue

            const pos = Transform.get(entity).position
            const lastPos = lastPlayerPositions.get(entity)

            if (lastPos) {
                const dist = Vector3.distanceSquared(pos, lastPos)
                if (dist > MOVE_THRESHOLD * MOVE_THRESHOLD) {
                    console.log('Remote player', entity, 'moved, removing Emoting component')
                    Emoting.deleteFrom(entity)
                    if (Spotlight.has(entity)) {
                        const { lightEntity } = Spotlight.get(entity)
                        LightSource.getMutable(lightEntity).active = false
                    }
                    if (entity === engine.PlayerEntity) {
                        applyDancerCountDelta(dancerCounterEntity, -1)
                    }
                }
                
            }

            lastPlayerPositions.set(entity, Vector3.create(pos.x, pos.y, pos.z))
        }
    }
}


