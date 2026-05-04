import { useContext, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AppContext } from "../../context/appContext";
import { useEventListener } from "usehooks-ts";
import Cursor from "./Cursor";
import GameObject from "./Object";
import NpcInteractionOverlay from "../ux/game/NpcInteractions";
import {
    getInitialPlayableMap,
    getPlayableMapById,
    getPlayableMapBackgroundStyle,
} from "./playableMapRuntime";
import type { MapEditorNpcPlacement } from "../designer/PlayableMapEditorCanvas";
//import { point_direction } from "./gameMath";

const Map = ({children}:{children:any}) => {
    const { setMouse, players, myplayer, playableMapsState, groundItems } = useContext(AppContext);

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
    const [selectedNpc, setSelectedNpc] = useState<MapEditorNpcPlacement | null>(null);

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

    useEffect(() => {
        if (!selectedNpc) {
            return;
        }

        const activeNpcIds = new Set((activeMapEditorData?.npcs ?? []).map((npc) => npc.id));

        if (!activeNpcIds.has(selectedNpc.id)) {
            setSelectedNpc(null);
        }
    }, [activeMap?.item.id, activeMapEditorData?.npcs, selectedNpc]);
    
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
            {activeMapConfig && activeMapEditorData
                ? activeMapEditorData.npcs.map((npc) =>
                    npc.previewImageSrc ? (
                        <GameObject
                            key={npc.id}
                            x={npc.x * activeMapConfig.cellSize}
                            y={npc.y * activeMapConfig.cellSize}
                            imageSrc={npc.previewImageSrc}
                            width={activeMapConfig.cellSize}
                            height={activeMapConfig.cellSize}
                            alt={npc.name}
                            label={npc.name}
                            cursor="pointer"
                            onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
                                event.stopPropagation();
                                setSelectedNpc(npc);
                            }}
                        />
                    ) : (
                        <div
                            key={npc.id}
                            title={npc.name}
                            onClick={(event) => {
                                event.stopPropagation();
                                setSelectedNpc(npc);
                            }}
                            style={{
                                position: "absolute",
                                top: `${npc.y * activeMapConfig.cellSize}px`,
                                left: `${npc.x * activeMapConfig.cellSize}px`,
                                width: `${activeMapConfig.cellSize}px`,
                                height: `${activeMapConfig.cellSize}px`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                border: "1px solid rgba(8, 145, 178, 0.75)",
                                background: "rgba(6, 182, 212, 0.2)",
                                color: "#0f172a",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: "pointer",
                                zIndex: 999,
                            }}
                        >
                            N
                        </div>
                    )
                )
                : null}
            {activeMapConfig
                ? (groundItems ?? [])
                    .filter((item: any) => item.mapId === activeMap?.item.id)
                    .map((item: any) => (
                        <GameObject
                            key={item.id}
                            x={item.x}
                            y={item.y}
                            imageSrc={item.iconSrc || "/objects/Rock.png"}
                            width={item.width ?? 32}
                            height={item.height ?? 32}
                            alt={item.itemName}
                            label={`${item.itemName} x${item.quantity}`}
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
        <NpcInteractionOverlay
            npcPlacement={selectedNpc}
            onClose={() => setSelectedNpc(null)}
        />
    </>)
}

export default Map;
