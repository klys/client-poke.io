import {useState, useContext, useEffect, useCallback} from "react"

import { AppContext } from "../../context/appContext"
import { assetUrl } from "../tilemap/serverAssets"

const Missile = (props:any) => {
  const {socket} = useContext(AppContext)
  const [pos, setPos] = useState({x:0,y:0})

  const socketMoveProjectil = useCallback((data:any) => {
    //console.log("moveProjectil", data)
    setPos({x:data.x, y:data.y})
    // projectils[data.id] = data;
    // setProjectils(projectils)
},[])

useEffect(() => {
  socket.on("moveProjectil"+props.data.id, socketMoveProjectil)
  return(()=>{
    socket.off("moveProjectil"+props.data.id)
  })
},[])
  return (<>
    <div
      style={{
        position: "absolute",
        top: pos.y+"px",
        left: pos.x+"px",
        zIndex: 999,
      }}
    >
      <img
        style={{ transform: "rotate("+props.data.angle+"deg)" }}
        src={assetUrl("/missile0.gif")}
        alt="Picture of a missile shot"
        width={32}
        height={32}
      />
    </div>
  </>)
}

export default Missile;


