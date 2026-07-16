import React from "react"
import { Provider } from "../../context/appContext";
import Players from "./Players"
import Network from "./Network";
import PortalRuntime from "./PortalRuntime";
import PlayerBoundaryGuard from "./PlayerBoundaryGuard";
import UserControl from "./UserControl"
import VirtualControls from "./VirtualControls"
import GamepadControls from "./GamepadControls"
import Map from "./Map"
import MapNameBanner from "./MapNameBanner"
import AccountMenu from "../ux/auth/AccountMenu";
import BattleScene from "../ux/game/battle/BattleScene";
import EventDialog from "../ux/game/EventDialog";
import MapMusic from "./MapMusic";
import { BattlePrompts, TrainerInteractionCard } from "../ux/game/TrainerInteractions";


const Game = ({ socketUrl }:{ socketUrl:string }) => {
    // New adventurers go straight into the world: the server assigns the
    // default protagonist skin and Venova's intro event (Chrisanta) handles
    // onboarding — gender pick (skin), name entry and the game tutorial.
    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                background: "#000",
                overflow: "hidden",
            }}
        >
        <Provider socketUrl={socketUrl}>
            <AccountMenu />

            <Network />
            <PortalRuntime />
            <PlayerBoundaryGuard />
            <UserControl />
            <div
                id="camera-world"
                style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    willChange: "transform",
                }}
            >
                <Map>
                    <Players />
                </Map>
            </div>
            <MapNameBanner />
            <MapMusic />
            <TrainerInteractionCard />
            <BattlePrompts />
            <BattleScene />
            <EventDialog />
            <VirtualControls />
            <GamepadControls />

        </Provider>
        </div>
    )
}

export default Game;
