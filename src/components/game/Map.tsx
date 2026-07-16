import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppContext } from "../../context/appContext";
import { useEventListener } from "usehooks-ts";
import Cursor from "./Cursor";
import GameObject from "./Object";
import MapNeighbors from "./MapNeighbors";
import TileMapSurface, { tileMapChunkKey } from "./TileMapSurface";
import { setMapLoadWaiting, startMapLoad } from "./mapLoadProgress";
import NpcInteractionOverlay from "../ux/game/NpcInteractions";
import NpcSprite from "./NpcSprite";
import { assetUrl, resolveServerAssetUrl } from "../tilemap/serverAssets";
import {
    selectActiveEventPage,
    pageIsInteractable,
    EMPTY_EVENT_STATE,
    type EssentialsEvent,
    type EventPlayerState,
} from "./npcEventState";
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
        eventState,
    } = useContext(AppContext);
    const playerEventState: EventPlayerState = eventState ?? EMPTY_EVENT_STATE;

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
    const activeTileMap = activeMapEditorData?.tileMap?.baked ? activeMapEditorData.tileMap : null;
    const activeMapId = activeMap?.item.id ?? null;

    // Track the player position without re-triggering the load effect on
    // every step; the priority set only cares where the player spawned in.
    const playerPositionRef = useRef({ x: 0, y: 0 });
    if (currentPlayer && typeof currentPlayer.x === "number" && typeof currentPlayer.y === "number") {
        playerPositionRef.current = { x: currentPlayer.x, y: currentPlayer.y };
    }

    // The chunks the loading overlay waits for: everything intersecting one
    // screen around the spawn point. The rest of the map keeps lazy-loading
    // as the camera moves, so huge maps don't stall the bar.
    const priorityChunkKeys = useMemo(() => {
        const keys = new Set<string>();
        const baked = activeTileMap?.baked;

        if (!baked) {
            return keys;
        }

        const chunkPixels = baked.chunkCells * activeTileMap.tileSize;
        const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1280;
        const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 720;
        const pad = 64;
        const centerX = playerPositionRef.current.x + 16;
        const centerY = playerPositionRef.current.y + 16;
        const minX = centerX - viewportWidth / 2 - pad;
        const maxX = centerX + viewportWidth / 2 + pad;
        const minY = centerY - viewportHeight / 2 - pad;
        const maxY = centerY + viewportHeight / 2 + pad;

        (["background", "foreground"] as const).forEach((plane) => {
            baked[plane].forEach((chunk) => {
                const left = chunk.col * chunkPixels;
                const top = chunk.row * chunkPixels;

                if (
                    left <= maxX &&
                    left + chunk.width >= minX &&
                    top <= maxY &&
                    top + chunk.height >= minY
                ) {
                    keys.add(tileMapChunkKey(plane, chunk.col, chunk.row));
                }
            });
        });

        return keys;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeMapId, activeTileMap]);

    const hasPlayer = Boolean(currentPlayer);
    const activeMapName = activeMap?.item.name ?? "";

    // Drive the map-loading overlay: connecting → waiting for the maps
    // payload → waiting for the spawn-viewport chunks → ready.
    useEffect(() => {
        if (!hasPlayer) {
            setMapLoadWaiting("connecting");
            return;
        }

        if (!activeMapId) {
            setMapLoadWaiting("mapData");
            return;
        }

        startMapLoad(activeMapId, activeMapName, Array.from(priorityChunkKeys));
    }, [hasPlayer, activeMapId, activeMapName, priorityChunkKeys]);
    const backgroundStyle = activeTileMap
        ? { backgroundColor: activeMapConfig?.backgroundColor ?? "#000000" }
        : activeMapConfig
            ? getPlayableMapBackgroundStyle(activeMapConfig)
            : { background: `repeat center/1% url('${assetUrl("/map0/Tile_Grass.png")}')` };

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

        // Imported RPG Maker events run through the server-authoritative event
        // runtime (it picks the active page for the player's state, or no-ops if
        // none applies). Designer-authored NPCs (healer/store/trainer) keep the
        // local interaction overlay.
        const eventNpc = npc as MapEditorNpcPlacement & { essentialsEvent?: unknown };
        if (eventNpc.essentialsEvent) {
            socket.emit("event:interact", { npcPlacementId: npc.id });
            return;
        }

        setActiveNpcInteraction(npc);
    };

    // Space-to-interact: UserControl dispatches this when the player presses
    // Space; talk to the NPC/sign on the tile the player is facing (or the
    // tile under the player, for floor triggers like signposts).
    const interactFrontRef = useRef<() => void>(() => undefined);
    interactFrontRef.current = () => {
        if (!activeMapConfig || !activeMapEditorData || !currentPlayer) {
            return;
        }
        const cellSize = activeMapConfig.cellSize;
        const playerCellX = Math.round((currentPlayer.x ?? 0) / cellSize);
        const playerCellY = Math.round((currentPlayer.y ?? 0) / cellSize);
        const angle = currentPlayer.angle ?? 270;
        // Same angle→direction mapping the sprite renderer uses.
        const delta =
            angle === 90 || angle === 450 ? { x: 0, y: -1 } // up
            : angle === 180 ? { x: 1, y: 0 } // right
            : angle === 0 || angle === 360 ? { x: -1, y: 0 } // left
            : { x: 0, y: 1 }; // down
        const targetX = playerCellX + delta.x;
        const targetY = playerCellY + delta.y;

        const candidates = activeMapEditorData.npcs.filter((npc) => {
            if (npc.x === targetX && npc.y === targetY) {
                return true;
            }
            // Floor triggers (signs placed on the player's own tile).
            return npc.x === playerCellX && npc.y === playerCellY;
        });

        for (const npc of candidates) {
            const essentialsEvent = (npc as { essentialsEvent?: EssentialsEvent }).essentialsEvent;
            if (essentialsEvent) {
                const activePage = selectActiveEventPage(essentialsEvent, playerEventState);
                if (!activePage) {
                    continue;
                }
            }
            openNpcInteraction(npc);
            return;
        }
    };

    useEffect(() => {
        const handleInteractFront = () => interactFrontRef.current();
        window.addEventListener("pokecraft:interact-front", handleInteractFront);
        return () => {
            window.removeEventListener("pokecraft:interact-front", handleInteractFront);
        };
    }, []);
    
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
            {activeTileMap ? (
                <>
                    <TileMapSurface
                        tileMap={activeTileMap}
                        plane="background"
                        zIndex={0}
                        mapId={activeMapId ?? undefined}
                        priorityKeys={priorityChunkKeys}
                    />
                    <TileMapSurface
                        tileMap={activeTileMap}
                        plane="foreground"
                        zIndex={1200}
                        mapId={activeMapId ?? undefined}
                        priorityKeys={priorityChunkKeys}
                    />
                </>
            ) : null}
            {activeMap && currentPlayer ? (
                <MapNeighbors
                    activeMap={activeMap}
                    playerX={typeof currentPlayer.x === "number" ? currentPlayer.x : 0}
                    playerY={typeof currentPlayer.y === "number" ? currentPlayer.y : 0}
                    snapshot={playableMapsState}
                />
            ) : null}
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
                ? activeMapEditorData.npcs.map((npc) => {
                    const imageSrc = resolveServerAssetUrl(
                        npcPreviewById.get(npc.npcId) || npc.previewImageSrc || ""
                    );
                    const essentialsEvent = (npc as { essentialsEvent?: EssentialsEvent }).essentialsEvent;

                    // Imported Venova events: only render according to the page that
                    // is active for the player's current switch/variable state, so
                    // conditionally-hidden events (cutscene actors, later story NPCs)
                    // don't appear before their story beat.
                    if (essentialsEvent) {
                        const activePage = selectActiveEventPage(essentialsEvent, playerEventState);
                        if (!activePage) {
                            return null;
                        }
                        const hasGraphic = Boolean(activePage.graphic?.characterName);
                        const interactable = pageIsInteractable(activePage);

                        if (hasGraphic && imageSrc) {
                            return (
                                <NpcSprite
                                    key={npc.id}
                                    npc={{
                                        ...(npc as MapEditorNpcPlacement & { spriteAspect?: number }),
                                        movement: activePage.move,
                                    }}
                                    cellSize={activeMapConfig.cellSize}
                                    imageSrc={imageSrc}
                                    onClick={() => openNpcInteraction(npc)}
                                />
                            );
                        }
                        if (interactable) {
                            // Invisible but clickable (signpost / hidden trigger).
                            return (
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
                                        cursor: "pointer",
                                        zIndex: 997,
                                    }}
                                />
                            );
                        }
                        return null;
                    }

                    // Designer-authored NPC (healer/store/trainer): render its sprite.
                    if (imageSrc) {
                        return (
                            <NpcSprite
                                key={npc.id}
                                npc={npc as MapEditorNpcPlacement & { spriteAspect?: number }}
                                cellSize={activeMapConfig.cellSize}
                                imageSrc={imageSrc}
                                onClick={() => openNpcInteraction(npc)}
                            />
                        );
                    }
                    return null;
                })
                : null}
            {activeMapConfig
                ? (groundItems ?? [])
                    .filter((item: any) => item.mapId === activeMap?.item.id)
                    .map((item: any) => (
                        <GameObject
                            key={item.id}
                            x={item.x}
                            y={item.y}
                            imageSrc={item.iconSrc || assetUrl("/objects/Rock.png")}
                            width={item.width ?? 32}
                            height={item.height ?? 32}
                            alt={item.itemName}
                            label={`${item.itemName} x${item.quantity}`}
                        />
                    ))
                : null}
            {(children) ? children : null}
            <Cursor
                gridSize={activeMapConfig?.cellSize ?? 32}
                squareSize={activeMapConfig?.cellSize ?? 32}
                color="#00ff88"
                mode="cell"
            />
        </div>
        <NpcInteractionOverlay
            npcPlacement={activeNpcInteraction}
            onClose={() => setActiveNpcInteraction(null)}
        />
    </>)
}

export default Map;
