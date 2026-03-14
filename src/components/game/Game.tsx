import React from "react"
import { Provider } from "../../context/appContext";
import Ships from "./Ships"
import Network from "./Network";
import UserControl from "./UserControl"
import Map from "./Map"
import Camera from "./Camera"
import Missiles from "./Missiles";
// import Debug from "../Debug"
// import Mouse from "./Mouse";
import LifeBar from "../ux/game/lifeBar";
import DeathMessage from "../ux/game/DeathMessage"
import Objects from "./Objects";
import AccountMenu from "../ux/auth/AccountMenu";


const Game = ({ socketUrl }:{ socketUrl:string }) => {
    return (<>
        <Provider socketUrl={socketUrl}>
            <AccountMenu />
  
            <Network />
            <UserControl />
            <Map>
                <Objects/>
            </Map>
            <Missiles />
            <Ships />
          
            <LifeBar/>
            <DeathMessage/>
                        
        </Provider>
    </>)
}

export default Game;
