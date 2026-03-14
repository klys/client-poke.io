import { useContext } from "react";
import { AppContext } from "../../context/appContext";
import Object from "./Object";

const Objects = () => {
    const { objects } = useContext(AppContext);

    return (<>
        {objects?.map((object:any) => <Object x={object.x} y={object.y}/>)}
    </>)
}

export default Objects;