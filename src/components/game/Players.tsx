import React, { useContext } from "react";
import { AppContext } from "../../context/appContext";

const Players = () => {
    const { players, myplayer } = useContext(AppContext);
    const allPlayers = Object.values(players ?? {});
    const currentPlayer: any =
        allPlayers.find((player:any) => player?.playerId === myplayer) ?? null;
    const activeMapId = currentPlayer?.currentMapId ?? null;

    return (<>
        {allPlayers.map((player:any) =>
            React.isValidElement(player.jsx)
                ? React.cloneElement(player.jsx, { activeMapId })
                : null
        )}
    </>)
}

export default Players;
