import { useContext } from "react";
import { AppContext } from "../../context/appContext";

const Ships = () => {
    const { players } = useContext(AppContext);

    return (<>
            <h1>{players.length}</h1>
        {players.map((player:any) => player.jsx)}
    </>)
}

export default Ships;