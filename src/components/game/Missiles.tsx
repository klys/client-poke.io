import { useContext } from "react";
import {AppContext} from "../../context/appContext"
import Missile from "./Missile";
const Missiles = () => {
    const { projectiles } = useContext(AppContext);
    return (<>
    {projectiles.map((projectil:any) => {
        return <Missile data = {projectil} key={projectil.id} />
    })}
    </>)
}

export default Missiles;