import React from "react"
import { Provider } from "../../context/appContext";
import Players from "./Players"
import Network from "./Network";
import PortalRuntime from "./PortalRuntime";
import PlayerBoundaryGuard from "./PlayerBoundaryGuard";
import UserControl from "./UserControl"
import Map from "./Map"
import AccountMenu from "../ux/auth/AccountMenu";


const Game = ({ socketUrl }:{ socketUrl:string }) => {
    return (
        <div
            style={{
                position: "relative",
                minWidth: "100vw",
                minHeight: "100vh",
                background: "#000",
                overflow: "visible",
            }}
        >
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
        </div>
    )
}

export default Game;
