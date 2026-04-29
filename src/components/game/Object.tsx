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
  const label = props.label ?? "";

  return (<>
    <div
      title={label || alt}
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
      {label ? (
        <div
          style={{
            position: "absolute",
            bottom: `${height + 4}px`,
            left: "50%",
            transform: "translateX(-50%)",
            display: "none",
            padding: "3px 7px",
            borderRadius: "6px",
            background: "rgba(17, 24, 39, 0.92)",
            border: "1px solid rgba(255,255,255,0.28)",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
          className="game-object-label"
        >
          {label}
        </div>
      ) : null}
    </div>
  </>)
}

export default Object;
