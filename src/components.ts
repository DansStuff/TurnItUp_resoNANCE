import { engine, Schemas } from '@dcl/sdk/ecs'

export const Initialized = engine.defineComponent('Initialized', {})

export const Emoting = engine.defineComponent('Emoting', {
    emoteUrn: Schemas.String,
    timestamp: Schemas.Number
})

export const Spotlight = engine.defineComponent('Spotlight', {
    lightEntity: Schemas.Entity
})

export const VisualAmplitude = engine.defineComponent('amplitude', {})

export const VisualBar = engine.defineComponent('bar', { index: Schemas.Number })
