import { Entity, engine, Transform, MeshRenderer, Material } from '@dcl/sdk/ecs'
import { VisualAmplitude } from './components'
import { Color4 } from '@dcl/sdk/math'

export function createVisualAmplitude(x: number, y: number, z: number): Entity {
  console.log("createVisualAmplitude: start")
  const entity = engine.addEntity()

  // Used to react to audio amplitude
  VisualAmplitude.create(entity)

  Transform.create(entity, { position: { x, y, z } })

  MeshRenderer.setSphere(entity)
  Material.setPbrMaterial(entity, { albedoColor: Color4.Purple() })

  console.log("createVisualAmplitude: finish")

  return entity
}