
import { useContext, useEffect, useCallback, useRef } from "react";
import { AppContext } from "../../context/appContext"


const Network = () => {

    const loadOnce = useRef(false)

    const { socket, addPlayer, removePlayer, addProjectil, removeProjectil, addObject } = useContext(AppContext);
    
    const socketAddPlayer = useCallback((data:any) => {
        console.log("addPlayer",data)
        addPlayer(data)
    }, [])

    const socketRemovePlayer = useCallback((data:any) => {
        console.log("removePlayer",data)
        removePlayer(data)
    },[])

    const socketShotProjectil = useCallback((data:any) => {
        console.log("shotProjectil",data)
        addProjectil(data)
    },[])

    const socketExplodeProjectil = useCallback((data:any) => {
        console.log("explodeProjectil",data)
        removeProjectil(data)
    },[])

    const socketAddObject = useCallback((data:any) => {
        console.log("addObject", data)
        addObject(data)
    },[])

    socket.emit("addPlayer")


    useEffect(() => {
        //console.log("Network mounted!")
        

        if (!loadOnce.current) {

            loadOnce.current = true;
        socket.on("addPlayer", socketAddPlayer)

        socket.on("removePlayer", socketRemovePlayer)

        socket.on("shotProjectil", socketShotProjectil)

        // socket.on("moveProjectil", (data:any) => {
        //     //console.log("moveProjectil", data)
        //     moveProjectil(data)
        // })

        socket.on("explodeProjectil", socketExplodeProjectil)

        socket.on("addObject", socketAddObject)

        //  socket.on("playerDeath", (data:any) => {
        //      //console.log(`player:${data.playerId} has die!`)
        //      if (data.playerId == socket.id) startWait()

        //  })

        //  socket.on("playerReborn", (data:any) => {
        //      //console.log("playerReborn")
        //      if (data.playerId == socket.id) stopWait()
        //  })
        
          
    }
        

        
    }, [])


    return (<></>)
}

export default Network;
