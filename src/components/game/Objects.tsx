import { useContext, useRef } from "react";
import { AppContext } from "../../context/appContext";
import Object from "./Object";

const Objects = () => {
    let objects = useRef(useContext(AppContext))

    return (<>
        {objects?.current?.objects?.map((object:any) => <Object x={object.x} y={object.y}/>)}
    </>)
}

export default Objects;