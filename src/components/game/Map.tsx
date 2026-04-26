import { useContext, useRef } from "react";
import { AppContext } from "../../context/appContext";
import { useEventListener } from "usehooks-ts";
import Cursor from "./Cursor";
import GameObject from "./Object";
import {
    getInitialPlayableMap,
    getPlayableMapById,
    getPlayableMapBackgroundStyle,
} from "./playableMapRuntime";
//import { point_direction } from "./gameMath";

const Map = ({children}:{children:any}) => {
    const { setMouse, players, myplayer, playableMapsState } = useContext(AppContext);

    const mapRef = useRef<HTMLDivElement | null>(null);
    const currentPlayer: any =
        Object.values(players ?? {}).find((player: any) => player?.playerId === myplayer) ?? null;
    const activeMap =
        getPlayableMapById(currentPlayer?.currentMapId, playableMapsState) ??
        getInitialPlayableMap(playableMapsState);
    const activeMapConfig = activeMap?.config ?? null;
    const activeMapEditorData = activeMap?.editorData ?? null;
    const mapPixelWidth = activeMapConfig ? activeMapConfig.width * activeMapConfig.cellSize : 3200;
    const mapPixelHeight = activeMapConfig ? activeMapConfig.height * activeMapConfig.cellSize : 3200;
    const backgroundStyle = activeMapConfig
        ? getPlayableMapBackgroundStyle(activeMapConfig)
        : { background: "repeat center/1% url('/map0/Tile_Grass.png')" };

    // MOVE THE MOUSE OVER THE GAME
    const mapPointerMoveEvent = (event: MouseEvent) => {
        const mapElement = mapRef.current;
        const target = event.target as Node | null;
        if (mapElement == null || target == null || !mapElement.contains(target)) return;
        const rect = mapElement.getBoundingClientRect();
        let x = Math.round(event.clientX - rect.left); //x position within the element.
        let y = Math.round(event.clientY - rect.top);  //y position within the element.
        setMouse({x:x,y:y})
    }

    useEventListener('pointermove',mapPointerMoveEvent, mapRef) 
    
    return(<>
        <div
            id="map"
            ref ={mapRef}
            style={{
                position: "relative",
                display: "block",
                flex: "0 0 auto",
                height:`${mapPixelHeight}px`,
                width:`${mapPixelWidth}px`,
                minHeight: `${mapPixelHeight}px`,
                maxHeight: `${mapPixelHeight}px`,
                minWidth: `${mapPixelWidth}px`,
                maxWidth: `${mapPixelWidth}px`,
                ...backgroundStyle,
            }}
        >
            {activeMapConfig && activeMapEditorData
                ? activeMapEditorData.objects.map((object) => (
                    <GameObject
                        key={object.id}
                        x={object.x * activeMapConfig.cellSize}
                        y={object.y * activeMapConfig.cellSize}
                        imageSrc={object.imageSrc}
                        width={object.width}
                        height={object.height}
                        alt={object.name}
                    />
                ))
                : null}
            {(children) ? children : null}
        </div>
        <Cursor
            gridSize={36}
            squareSize={36}
            color="#00ff88"
            mode="cell"
        />
    </>)
}

export default Map;
