import React from "react";
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
  const imageSrc = props.imageSrc ?? "/objects/Rock.png";
  const width = props.width ?? 32;
  const height = props.height ?? 32;
  const alt = props.alt ?? "Rock";

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
        src={imageSrc}
        alt={alt}
        width={width}
        height={height}
        style={{ 
          imageRendering: "pixelated",
          objectPosition: "center",
        }}
      />
    </div>
  </>)
}

export default Object;

