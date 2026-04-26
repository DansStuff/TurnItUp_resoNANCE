/*
import { AvatarEmoteCommand, engine, Schemas, type Entity } from '@dcl/sdk/ecs'
import { registerMessages, isServer, syncEntity } from '@dcl/sdk/network'
import { AUTH_SERVER_PEER_ID } from '@dcl/sdk/network/message-bus-sync'
import { getPlayer, onEnterScene } from '@dcl/sdk/players'

const Messages = {
    requestDance: Schemas.Map({ //player name passed as context.from
      isDancing: Schemas.Boolean
    }),
    notifyDancesChanged : Schemas.Map({
      currentDancers: Schemas.Array(Schemas.String)
    })
    
}

const DancerTracker = engine.defineComponent('DancerTracker', {
    dancers: Schemas.Array(Schemas.String)
})

const room = registerMessages(Messages)

export function main() {

    

    if (isServer()){
        console.log('[SERVER]', ' server starting...')
        const trackerEntity = engine.addEntity()
        syncEntity(trackerEntity, [DancerTracker.componentId])
        DancerTracker.create(trackerEntity, {
            dancers: []
        })

        room.onMessage('requestDance', (data, context) =>{
          console.log('[SERVER]', ' notifyIsDancing', context!.from)
          const tracker = DancerTracker.getMutable(trackerEntity)
          if(data.isDancing){
            if (!tracker.dancers.includes(context!.from)) {
              tracker.dancers.push(context!.from)
              
            }
            
            room.send('notifyDancesChanged', {//move this back into the check above
                currentDancers: tracker.dancers
            })
          } else {
            tracker.dancers = tracker.dancers.filter((player) => player !== context!.from)
            room.send('notifyDancesChanged', {
                currentDancers: tracker.dancers
            })
          }
        })
    }else{
        console.log('[CLIENT]', ' client starting...')
        onEnterScene((player) => {
          if(player.entity === engine.PlayerEntity){
            console.log('[CLIENT]', ` Player entered scene`)
            AvatarEmoteCommand.onChange(player.entity, (emoteCommand) => {

              console.log('[CLIENT]', `Emote happened: ${emoteCommand!.emoteUrn}`)
              room.send('requestDance', {
                isDancing: true
              })

            })
          }
        })

        room.onMessage('notifyDancesChanged', (data, context) => {
          console.log('New dance data: ', data)
        })
        
        
        
    }
    
}
    */