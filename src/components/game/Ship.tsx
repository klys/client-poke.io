import React, { useState, useContext, useEffect, useCallback } from "react";
import { AppContext } from "../../context/appContext";
/**
 * 
 * @param props {
 *    playerData:{
 *        playerId:,
 *        
 *    }
 * } 
 * @returns 
 */
const Ship = (props:any) => {
  const [death, setDeath] = useState(false)
  const { socket, players, movePlayer } = useContext(AppContext)

  const [pos, setPos] = useState({x:100,y:100,angle:270})

  //console.log("props:", props.playerInfo)
  const playerId = props.playerInfo.playerId;
  // useEffect(() => {
  //   socket.on("playerHurt", (data:any) => {
  //     console.log("playerHurt received!!")
  //     if (playerId == data.playerId) setLife(data.life)
  //   })
  // }, [life])
  // socket.on("move", (data:any) => {
  //   //console.log("move", data)
  //   if (playerId == data.playerId) movePlayer(data)
    
  // })
  const socketPlayerDeath = useCallback(() => {
    console.log("playerDeath"+playerId)
    setDeath(true)
    socket.off("move"+playerId)
  
  },[])

  const socketPlayerReborn = useCallback(() => {
    setDeath(false)
    move()
},[])

  let camLoop: NodeJS.Timer;
  useEffect(()=> {

  socket.on("playerDeath"+playerId, socketPlayerDeath)

  socket.on("playerReborn"+playerId, socketPlayerReborn)
  
  if (death === false) {
    move()
  }
  

  

  return(()=> {
    //socket.off("playerDeath"+playerId)
    //socket.off("playerReborn"+playerId)
    //if(death === false) socket.off("move"+playerId)
  })
},[death])

const move = useCallback(() => {
  socket.on("move"+playerId, (data:any)=>{
    setPos({x:data.x,y:data.y,angle:data.angle})
    const keys = Object.keys(players)
    let myId = undefined
    for(let i = 0; i < keys.length; i++) {
      if (players[keys[i]].playerId == socket.id) {
        myId = keys[i]
        break;
      }
    }
    if (typeof myId == 'undefined') return;
    movePlayer({
      
        id:myId,
        angle:data.angle,
        x:data.x,
        y:data.y                 
      
    })
  })
},[])

const updateCamera = useCallback( () => {
  //if (playersIds[socket.id] !== undefined) {
    //console.log("updateCamera")
      const cam_x = pos.x - (window.visualViewport.width/2)
      const cam_y = pos.y - (window.visualViewport.height/2)
      window.scroll(cam_x,cam_y)
  //}

},[pos])

useEffect(()=>{
  if (socket.id === playerId) {
    // setup camera for our player
    //console.log("camera mounted")
        
        camLoop = setInterval(updateCamera, 1)
  }
  return () => {
    clearInterval(camLoop)
  }
},[pos])
  
const renderCharacterAngle = () => {
  switch(pos.angle) {
    case 450: // up
    return (<img
      
      src="/character0/TestChar_Up.png"
      alt="Character facing up"
      width={32}
      height={32}
    />)
    case 270: // down
    return (<img
      
      src="/character0/TestChar_Down.png"
      alt="Character facing up"
      width={32}
      height={32}
    />)
    case 360: // left
    return (<img
      
      src="/character0/TestChar_Left.png"
      alt="Character facing up"
      width={32}
      height={32}
    />)
    case 180: // right
    return (<img
      
      src="/character0/TestChar_Right.png"
      alt="Character facing up"
      width={32}
      height={32}
    />)
  }
}
  
  return (<>
    <div
      id = {playerId}
      hidden={death}
      style={{
        position: "absolute",
        top: pos.y + "px",
        left: pos.x + "px",
        zIndex: 999,
        
      }}
    >
      {renderCharacterAngle()}
      {/*<img
        style={{ 
        transform: "rotate(" + pos.angle + "deg)"
       }}
        src="/ship.png"
        alt="Picture of a spaceship"
        width={32}
        height={32}
      />*/}
    </div>
  </>)
}

export default Ship;


