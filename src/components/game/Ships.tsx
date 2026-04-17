import { useContext } from "react";
import { AppContext } from "../../context/appContext";

const Ships = () => {
    const { players, myplayer } = useContext(AppContext);
    const currentPlayer: any =
        Object.values(players ?? {}).find((player:any) => player?.playerId === myplayer) ?? null;
    const activeMapId = currentPlayer?.currentMapId ?? null;
    const visiblePlayers = Object.values(players ?? {}).filter((player:any) =>
        activeMapId ? player?.currentMapId === activeMapId : true
    );

    return (<>
            <h1>{visiblePlayers.length}</h1>
        {visiblePlayers.map((player:any) => player.jsx)}
    </>)
}

export default Ships;
