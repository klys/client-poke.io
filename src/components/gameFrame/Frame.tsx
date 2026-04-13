import React from "react";

export default function Frame() {
    return (<>
        <div
            style={{
                position:"relative",
                top:"50px",
                left:"50px"
            }}
        >
            <iframe 
                title="Inline Frame Example"
                width="450"
                height="450"
                src="http://localhost:3000"/>
        </div>
  </>)
}