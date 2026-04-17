import React from "react"
import { Provider } from "../../context/appContext";
import Ships from "./Ships"
import Network from "./Network";
import PortalRuntime from "./PortalRuntime";
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
            <UserControl />
            <Map>
            </Map>
            <Ships />
                        
        </Provider>
    </>)
}

export default Game;
