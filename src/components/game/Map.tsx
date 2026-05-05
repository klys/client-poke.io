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
import {
    DEFAULT_NPC_INTERACTION_DISTANCE_SQUARES,
    type MapEditorNpcPlacement,
} from "../designer/PlayableMapEditorCanvas";
import {
    DESIGNER_CACHE_UPDATED_EVENT,
    readStoredDesignerSectionPayload,
    type DesignerCacheUpdateDetail,
} from "../designer/designerCache";
import {
    getCharacterSkinPreview,
    loadCharacterSkinCatalog,
} from "../ux/game/characterSkinCatalog";
//import { point_direction } from "./gameMath";

function isNpcWithinInteractionRange(
    npc: MapEditorNpcPlacement,
    player: { x?: number; y?: number } | null,
    cellSize: number
) {
    if (!player || typeof player.x !== "number" || typeof player.y !== "number") {
        return false;
    }

    const interactionDistanceSquares =
        typeof npc.interactionDistanceSquares === "number" &&
        Number.isFinite(npc.interactionDistanceSquares) &&
        npc.interactionDistanceSquares >= 0
            ? npc.interactionDistanceSquares
            : DEFAULT_NPC_INTERACTION_DISTANCE_SQUARES;
    const playerCenterX = player.x + 16;
    const playerCenterY = player.y + 16;
    const npcCenterX = npc.x * cellSize + cellSize / 2;
    const npcCenterY = npc.y * cellSize + cellSize / 2;
    const distance = Math.hypot(playerCenterX - npcCenterX, playerCenterY - npcCenterY);

    return distance <= interactionDistanceSquares * cellSize;
}

function loadNpcPreviewById() {
    const previewById = new globalThis.Map<string, string>();
    const characterSkinCatalog = loadCharacterSkinCatalog();

    readStoredDesignerSectionPayload("npcs").state.items.forEach((item) => {
        const npcProfile =
            item.npcProfile && typeof item.npcProfile === "object"
                ? (item.npcProfile as {
                    npcType?: string;
                    graphicsSource?: string;
                    characterSkinId?: string;
                    graphics?: {
                        chestImageSrc?: string;
                        standingDownSrc?: string;
                        standingUpSrc?: string;
                        standingLeftSrc?: string;
                        standingRightSrc?: string;
                        trainerFrontImageSrc?: string;
                    };
                })
                : null;
        const graphics = npcProfile?.graphics;
        const selectedCharacterSkin =
            npcProfile?.graphicsSource === "characterSkin"
                ? characterSkinCatalog.find((skin) => skin.id === npcProfile.characterSkinId) ?? null
                : null;
        const previewSrc =
            npcProfile?.npcType === "chest"
                ? graphics?.chestImageSrc ?? ""
                : getCharacterSkinPreview(selectedCharacterSkin?.profile) ||
                  graphics?.standingDownSrc ||
                  graphics?.standingUpSrc ||
                  graphics?.standingLeftSrc ||
                  graphics?.standingRightSrc ||
                  graphics?.trainerFrontImageSrc ||
                  "";

        previewById.set(item.id, previewSrc);
    });

    return previewById;
}

const Map = ({children}:{children:any}) => {
    const {
        setMouse,
        players,
        myplayer,
        playableMapsState,
        groundItems,
        socket,
        activeNpcInteraction,
        setActiveNpcInteraction,
    } = useContext(AppContext);

    const mapRef = useRef<HTMLDivElement | null>(null);
    const [npcPreviewById, setNpcPreviewById] = useState(() => loadNpcPreviewById());
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

    useEffect(() => {
        if (!activeNpcInteraction || !activeMapConfig) {
            return;
        }

        const activeNpcIds = new Set((activeMapEditorData?.npcs ?? []).map((npc) => npc.id));

        if (
            !activeNpcIds.has(activeNpcInteraction.id) ||
            !isNpcWithinInteractionRange(activeNpcInteraction, currentPlayer, activeMapConfig.cellSize)
        ) {
            setActiveNpcInteraction(null);
        }
    }, [
        activeMap?.item.id,
        activeMapConfig,
        activeMapEditorData?.npcs,
        activeNpcInteraction,
        currentPlayer,
        setActiveNpcInteraction,
    ]);

    useEffect(() => {
        const handleDesignerCacheUpdate = (event: Event) => {
            const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;

            if (detail?.sectionKey === "npcs" || detail?.sectionKey === "players") {
                setNpcPreviewById(loadNpcPreviewById());
            }
        };

        window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);

        return () => {
            window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);
        };
    }, []);

    const openNpcInteraction = (npc: MapEditorNpcPlacement) => {
        if (!activeMapConfig || !isNpcWithinInteractionRange(npc, currentPlayer, activeMapConfig.cellSize)) {
            return;
        }

        socket.emit("stopMove");
        setActiveNpcInteraction(npc);
    };
    
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
                    (npcPreviewById.get(npc.npcId) || npc.previewImageSrc) ? (
                        <GameObject
                            key={npc.id}
                            x={npc.x * activeMapConfig.cellSize}
                            y={npc.y * activeMapConfig.cellSize}
                            imageSrc={npcPreviewById.get(npc.npcId) || npc.previewImageSrc}
                            width={activeMapConfig.cellSize}
                            height={activeMapConfig.cellSize}
                            alt={npc.name}
                            label={npc.name}
                            cursor="pointer"
                            onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
                                event.stopPropagation();
                                openNpcInteraction(npc);
                            }}
                        />
                    ) : (
                        <div
                            key={npc.id}
                            title={npc.name}
                            onClick={(event) => {
                                event.stopPropagation();
                                openNpcInteraction(npc);
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
            npcPlacement={activeNpcInteraction}
            onClose={() => setActiveNpcInteraction(null)}
        />
    </>)
}

export default Map;
