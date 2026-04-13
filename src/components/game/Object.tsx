import React, { useState, useContext } from "react";
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
const Object = (props:any) => {
  //const { socket } = useContext(AppContext)

  //const [pos, setPos] = useState({x:props.x,y:props.y,angle:0})






  return (<>
    <div
      style={{
        position: "absolute",
        top: props.y + "px",
        left: props.x + "px",
        zIndex: 999,
        
      }}
    >

      <img
        
        src="/objects/Rock.png"
        alt="Picture of a Rock"
        width={32}
        height={32}
        style={{ 
          imageRendering: "pixelated",
          objectPosition: "center",
        }}
      />
    </div>
  </>)
}

export default Object;


