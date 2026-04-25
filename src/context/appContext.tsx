import { createContext, useReducer, useState } from "react"
import io, { Socket } from "socket.io-client"
import Player from "../components/game/Player"
import { loadPlayableMapsSnapshot } from "../components/game/playableMapRuntime"

export type PlayerState = { // unused
    playerId: string
    x: number
    y: number
    angle: number
}

export type InitialStateType = {
    socket: Socket
    players: any[]
    objects: any[]
    //playersIds: {}
    projectiles: any[]
    mouse: {}
    map:any
    playableMapsState:any
    pointerAngle:number
    myplayer:string
}

const createInitialState = (socket: Socket) => ({
    socket,
    players: [],
    objects: [],
    //playersIds: {},
    projectiles:[],
    mouse:{x:-1,y:-1},
    map:undefined,
    playableMapsState: loadPlayableMapsSnapshot(),
    pointerAngle: 0,
    life: 0,
    waiting:false,
    myplayer:""
})

export const networkEvents = {
    
}

enum actions {
    CONNECT = "CONNECT",
    ADD_PLAYER = "ADD_PLAYER",
    REMOVE_PLAYER = "REMOVE_PLAYER",
    MOVE_PLAYER = "MOVE_PLAYER",
    ADD_PROJECTIL = "ADD_PROJECTIL",
    REMOVE_PROJECTIL = "REMOVE_PROJECTIL",
    MOVE_PROJECTIL = "MOVE_PROJECTIL",
    SET_MOUSE = 'SET_MOUSE',
    SET_MAP = 'SET_MAP',
    SET_POINTERANGLE = 'SET_POINTERANGLE',
    SET_LIFE = 'SET_LIFE',
    SET_PLAYABLE_MAPS_STATE = 'SET_PLAYABLE_MAPS_STATE',
    START_WAIT = 'START_WAIT',
    STOP_WAIT = 'STOP_WAIT',
    SET_MYPLAYER = 'SET_MYPLAYER',
    ADD_OBJECT = 'ADD_OBJECT'
}

// Actions are handle on this reducer

const reducer = (state:any, action:any) => {
    switch (action.type) {
        case actions.CONNECT:
            return {
                ...state
            }
        case actions.ADD_PLAYER:
            console.log("action.playerData:", action.playerData);
            //console.log("state.playersIds[action.playerData.playerId]: ", state.playersIds[action.playerData.playerId])

            state.players[action.playerData.id] = ({
                ...state.players[action.playerData.id],
                ...action.playerData,
                jsx:<Player playerInfo={action.playerData} key={`${action.playerData.playerId}-${action.playerData.currentMapId ?? "default"}`} />
            })
            // if (state.playersIds[action.playerData.playerId] === undefined) {
            //     state.players.push({jsx:<Player playerInfo={action.playerData} key={action.playerData.playerId} />, ...action.playerData})
            //     state.playersIds[action.playerData.playerId] = state.players.length - 1;
            // }
            //console.log("state.players: ", state.players);
            //console.log("state.playersIds: ", state.playersIds);
            return {
                ...state,
                players: state.players,
                // playersIds: state.playersIds
            }
        case actions.REMOVE_PLAYER:
            console.log("action on REMOVE_PLAYER: ", action)
            if (typeof state.players[action.playerData.id] === "undefined") return state;
            console.log("action->REMOVE_PLAYER passed verification.")
                //state.players.splice(action.playerData.id,1)
                delete state.players[action.playerData.id]
            // if (state.playersIds[action.playerId] !== undefined) {
            //     //console.log("REMOVE_PLAYER SUCCESFULL")
            //     state.players.splice(state.playersIds[action.playerId], 1)
            //     delete state.playersIds[action.playerId]
            // }
            return {
                ...state,
                players: state.players
            }
        case actions.MOVE_PLAYER:
            /*
                playerData:{
             
                    playerData:{
                        playerId:
                        angle,
                        id
                        jsx
                        x
                        y
                    }
                }
            */
           console.log("appContext->action.playerData",action.playerData)
            if (typeof state.players[action.playerData.id] !== "undefined") {
                state.players[action.playerData.id] = {
                                    ...state.players[action.playerData.id],
                                    ...action.playerData
                    }
            }
            return {
                ...state,
                players: state.players
            }
        case actions.ADD_PROJECTIL:
            console.log("ADD_PROJECTIL")
            if (state.projectiles[action.projectilData.id] !== undefined) return state; 
            console.log("beforeSplice",state.projectiles)
            state.projectiles[action.projectilData.id] = action.projectilData;
            console.log("afterSplice", state.projectiles)
            // if(state.projectiles.find((projectil: { id: any }) => projectil.id == action.projectilData.id) == undefined) {
            //     // not projectil with such id found
            //     // so we proceed to add it
            //     state.projectiles.push(action.projectilData)
            // }
            return {
                ...state,
                projectiles:state.projectiles
            }
        case actions.MOVE_PROJECTIL: // unused, moved to local component
            const projIndex = state.projectiles.findIndex((projectil: { id: any }) => projectil.id == action.projectilData.id); 
            if(projIndex != -1) {
                state.projectiles[projIndex] = action.projectilData;
            }
            return {
                ...state,
                projectiles:state.projectiles
            }
        case actions.REMOVE_PROJECTIL:
            if (state.projectiles[action.projectilData.id] === undefined) return state;
            console.log("beforeSplice",state.projectiles)
            //state.projectiles.splice(action.projectilData.id,1);
            delete state.projectiles[action.projectilData.id]
            console.log("afterSplice",state.projectiles)
            // const delIndex = state.projectiles.findIndex((projectil: { id: any }) => projectil.id == action.projectilData.id);
            // if(delIndex != -1) {
            //     state.projectiles.splice(delIndex,1);
            // }
            return {
                ...state,
                projectiles:state.projectiles
            }
        case actions.SET_MOUSE:
            return{
                ...state,
                mouse:action.mouseData
            }
        case actions.SET_MAP: // unused
            return{
                ...state,
                map:action.mapRef
            }
        case actions.SET_POINTERANGLE:
            return {
                ...state,
                pointerAngle:action.pointerAngle
            }
        case actions.SET_LIFE: // not working
            //console.log("action.SET_LIFE on execution! ", action.life)
            return {
                ...state,
                life:action.life
            }
        case actions.SET_PLAYABLE_MAPS_STATE:
            return {
                ...state,
                playableMapsState: action.playableMapsState
            }
        case actions.START_WAIT:
            return{
                ...state,
                waiting:true
            }
        case actions.STOP_WAIT:
            return {
                ...state,
                waiting:false
            }
        case actions.SET_MYPLAYER:
            return {
                ...state,
                myplayer:action.playerId
            }
        case actions.ADD_OBJECT:
            state.objects.push(action.objectData)
            return{
                ...state,
                objects:state.objects
            }
            
    }
}

// Context and Provider
export const AppContext = createContext<any>(null);

export const Provider = ({ children, socketUrl }:{children:any, socketUrl:string}) => {
    const [socket] = useState(() => io(socketUrl))
    const [state, dispatch] = useReducer(reducer, createInitialState(socket));

    /*useEffect(() => {
        return () => {
            socket.disconnect()
        }
    }, [socket])*/

    const api = {
        socket: state.socket,
        players: state.players ?? [],
        //playersIds: state.playersIds,
        projectiles: state.projectiles ?? [],
        mouse:state.mouse,
        //map:state.map,
        playableMapsState: state.playableMapsState,
        pointerAngle:state.pointerAngle,
        life:state.life ?? 100,
        waiting:state.waiting ?? false,
        myplayer:state.myplayer ?? "",
        objects:state.objects ?? [],
        connect: () => {
            dispatch({ type: actions.CONNECT })
        },
        addPlayer: (playerData:any) => {
            dispatch({ type: actions.ADD_PLAYER, playerData })
            //console.log("players map: ", state.players)
        },
        removePlayer: (playerData:any) => {
            dispatch({ type: actions.REMOVE_PLAYER, playerData })
        },
        movePlayer: (playerData:any) => {
            dispatch({ type: actions.MOVE_PLAYER, playerData })
        },
        addProjectil: (projectilData:any) => {
            //console.log("projectil add")
            dispatch({type: actions.ADD_PROJECTIL, projectilData})
        },
        moveProjectil: (projectilData:any) => {
            dispatch({type: actions.MOVE_PROJECTIL, projectilData})
        },
        removeProjectil: (projectilData:any) => {
            dispatch({type: actions.REMOVE_PROJECTIL, projectilData})
        },
        setMouse: (mouseData:{}) => {
            dispatch({type: actions.SET_MOUSE, mouseData})
        },
        setMap: (mapRef:any) => { // unused
            dispatch({type: actions.SET_MAP, mapRef})
        },
        setPointerAngle: (pointerAngle:number) => {
            dispatch({type: actions.SET_POINTERANGLE, pointerAngle})
        },
        setLife: (life:number) => {
            //console.log("Dispatching setLife")
            dispatch({type: actions.SET_LIFE, life})
        },
        setPlayableMapsState: (playableMapsState:any) => {
            dispatch({type: actions.SET_PLAYABLE_MAPS_STATE, playableMapsState})
        },
        startWait: () => {
            dispatch({type: actions.START_WAIT})
        },
        stopWait: () => {
            dispatch({type: actions.STOP_WAIT})
        },
        setMyPlayer: (playerId:string) => {
            dispatch({type:actions.SET_MYPLAYER, playerId})
        },
        addObject: (objectData:any) => {
            dispatch({type: actions.ADD_OBJECT, objectData})
        }
    }

    return (
        <AppContext.Provider value={api}>
            {children}
        </AppContext.Provider>
    )
}
