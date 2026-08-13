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
import MapLoadingOverlay from "./MapLoadingOverlay"
import HudMetrics from "./HudMetrics"
import AccountMenu from "../ux/auth/AccountMenu";
import BattleScene from "../ux/game/battle/BattleScene";
import EventDialog from "../ux/game/EventDialog";
import MapMusic from "./MapMusic";
import { BattlePrompts, TrainerInteractionCard } from "../ux/game/TrainerInteractions";
import { SocialProvider } from "../ux/game/social/SocialContext";
import ChatBar from "../ux/game/social/ChatBar";
import { TradeProvider } from "../ux/game/trade/TradeContext";
import TradeWindow, { TradeRequestPrompts } from "../ux/game/trade/TradeWindow";


const Game = ({ socketUrl }:{ socketUrl:string }) => {
    // New adventurers go straight into the world: the server assigns the
    // default protagonist skin and Venova's intro event (Chrisanta) handles
    // onboarding — gender pick (skin), name entry and the game tutorial.
    return (
        <div
            style={{
                // absolute, NOT fixed: position:fixed creates a stacking
                // context, which would trap every inline overlay's z-index
                // (menu, HUD, battle, trade, touch pad) below the overlays
                // that portal to <body> (NPC dialogs, PC box) no matter how
                // high their UX_LAYER value is. With absolute + z-index auto
                // all of them compete in the root stacking context, so the
                // ordering in ux/layers.ts actually holds.
                position: "absolute",
                inset: 0,
                background: "#000",
                overflow: "hidden",
            }}
        >
        <Provider socketUrl={socketUrl}>
        <SocialProvider>
        <TradeProvider>
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
            <MapLoadingOverlay />
            <HudMetrics />
            <MapMusic />
            <TrainerInteractionCard />
            <BattlePrompts />
            <BattleScene />
            <EventDialog />
            <ChatBar />
            <TradeWindow />
            <TradeRequestPrompts />
            <VirtualControls />
            <GamepadControls />

        </TradeProvider>
        </SocialProvider>
        </Provider>
        </div>
    )
}

export default Game;
