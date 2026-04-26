import React from "react"
import { Provider } from "../../context/appContext";
import Players from "./Players"
import Network from "./Network";
import PortalRuntime from "./PortalRuntime";
import PlayerBoundaryGuard from "./PlayerBoundaryGuard";
import UserControl from "./UserControl"
import Map from "./Map"
import Missiles from "./Missiles";
// import Debug from "../Debug"
// import Mouse from "./Mouse";
import LifeBar from "../ux/game/lifeBar";
import DeathMessage from "../ux/game/DeathMessage"
import AccountMenu from "../ux/auth/AccountMenu";


const Game = ({ socketUrl }:{ socketUrl:string }) => {
    return (<>
        <Provider socketUrl={socketUrl}>
            <AccountMenu />
  
            <Network />
            <PortalRuntime />
            <PlayerBoundaryGuard />
            <UserControl />
            <Map>
            </Map>
            <Players />
                        
        </Provider>
    </>)
}

export default Game;
