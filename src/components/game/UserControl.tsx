import { useContext, useEffect, useRef } from "react";
import { AppContext } from "../../context/appContext"
import { useEventListener } from 'usehooks-ts'
import { useGameSettings } from "../../settings/gameSettings";
import { getPlayableMapById } from "./playableMapRuntime";

const MOVEMENT_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

// Held-key drive loop: while a movement key is down we keep feeding the
// server a target a few tiles ahead so it walks at its own constant speed
// (4px / 28ms). Movement used to depend on OS key auto-repeat — one 16px
// target per repeat event — which produced the step...pause...step feel and
// varied per machine. The lookahead must outrun what the server covers in
// one drive interval (~21px) or the walk stutters between emits.
const DRIVE_INTERVAL_MS = 150;
const DRIVE_LOOKAHEAD_PX = 64;

const DIRECTION_BY_KEY: Record<string, { dx: number; dy: number }> = {
    ArrowUp: { dx: 0, dy: -1 },
    ArrowDown: { dx: 0, dy: 1 },
    ArrowLeft: { dx: -1, dy: 0 },
    ArrowRight: { dx: 1, dy: 0 },
};

const isMovementKey = (key:string) => MOVEMENT_KEYS.includes(key);

const isEventDialogActive = () =>
    typeof document !== "undefined" && document.body.dataset.eventActive === "1";

const isUxEventTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();

    return Boolean(
        target.closest('[data-game-ux="true"]') ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable
    );
};

const UserControl = () => {
    const { socket, players, mouse, waiting, myplayer, activeNpcInteraction, playableMapsState } = useContext(AppContext);
    const [gameSettings] = useGameSettings();

    // Movement keys currently held, in press order (latest wins). Kept in a
    // ref so the drive interval always sees the live state.
    const heldKeysRef = useRef<string[]>([]);
    const driveTimerRef = useRef<number | null>(null);
    const stateRef = useRef({ players, myplayer, waiting, activeNpcInteraction });
    stateRef.current = { players, myplayer, waiting, activeNpcInteraction };

    const findMyId = () => {
        const { players, myplayer } = stateRef.current;
        const keys = Object.keys(players)
        for (let i = 0; i < keys.length; i++) {
            if (players[keys[i]].playerId === myplayer) {
                return keys[i];
            }
        }
        return undefined;
    };

    const stopDriveLoop = () => {
        if (driveTimerRef.current !== null) {
            window.clearInterval(driveTimerRef.current);
            driveTimerRef.current = null;
        }
    };

    const releaseAllKeys = (emitStop: boolean) => {
        heldKeysRef.current = [];
        stopDriveLoop();
        if (emitStop) {
            socket.emit("stopMove");
        }
    };

    const emitHeldMove = () => {
        const { waiting, activeNpcInteraction } = stateRef.current;
        // A dialog or battle opening mid-hold ends the walk; the player
        // re-presses once it closes (keyups are swallowed by the dialog).
        if (waiting || activeNpcInteraction || isEventDialogActive()) {
            releaseAllKeys(true);
            return;
        }
        const key = heldKeysRef.current[heldKeysRef.current.length - 1];
        if (!key) {
            releaseAllKeys(false);
            return;
        }
        const myId = findMyId();
        if (typeof myId === 'undefined') return;
        const direction = DIRECTION_BY_KEY[key];
        const me = stateRef.current.players[myId];
        socket.emit("move", {
            x: me.x + direction.dx * DRIVE_LOOKAHEAD_PX,
            y: me.y + direction.dy * DRIVE_LOOKAHEAD_PX,
        });
    };

    const startDriveLoop = () => {
        if (driveTimerRef.current === null) {
            driveTimerRef.current = window.setInterval(emitHeldMove, DRIVE_INTERVAL_MS);
        }
    };

    // Never leave a dangling interval (map unmount, account switch).
    useEffect(() => () => stopDriveLoop(), []);

    // Tap / click to move (optional, see Settings → Controls).
    const clickOverMap = (event:MouseEvent) => {
        if (waiting) return;
        if (!gameSettings.controls.touchMoveEnabled) return;
        if (activeNpcInteraction || isEventDialogActive()) return;
        if (isUxEventTarget(event.target)) return;
        const map = document.getElementById("map");
        const target = event.target as Node | null;
        if (map == null || target == null || !map.contains(target)) return;

        // Compute map coordinates AT CLICK TIME from the map's current rect.
        // The old pointermove-cached position went stale whenever the camera
        // moved under a still cursor, walking the player to an offset spot.
        const rect = map.getBoundingClientRect();
        const clickX = Math.round(event.clientX - rect.left);
        const clickY = Math.round(event.clientY - rect.top);
        // Snap to the clicked cell so the player lands tile-aligned (portals,
        // doors and NPC facing all work in whole tiles). Use the map's real
        // cell size — maps aren't always 32px.
        const myId = findMyId();
        const currentMapId = typeof myId === 'undefined' ? undefined : players[myId]?.currentMapId;
        const cellSize = getPlayableMapById(currentMapId, playableMapsState)?.config.cellSize ?? 32;
        const x = Math.floor(clickX / cellSize) * cellSize;
        const y = Math.floor(clickY / cellSize) * cellSize;

        socket.emit("move", { x, y })
    }
    useEventListener('click', clickOverMap)

    const keyUpEvent = (event:KeyboardEvent) => {
        if (isMovementKey(event.key)) {
            heldKeysRef.current = heldKeysRef.current.filter((key) => key !== event.key);
        }
        if (waiting) return;
        if (activeNpcInteraction || isEventDialogActive()) {
            if (event.key === "q" || isMovementKey(event.key)) {
                event.preventDefault()
            }
            return;
        }
        if (isUxEventTarget(event.target)) return;
        if (event.key === "q" || isMovementKey(event.key)) {
            event.preventDefault()
        }

        if ((event.key === "q")) {
            const shotProjectileData = {
                mouse_x:mouse.x,
                mouse_y:mouse.y,
                who:socket.id
            }

            socket.emit("shotProjectil", shotProjectileData)
        }

        if (isMovementKey(event.key)) {
            if (heldKeysRef.current.length === 0) {
                releaseAllKeys(true);
            } else {
                // Another movement key is still held: switch direction now
                // instead of waiting for the next drive tick.
                emitHeldMove();
            }
        }
    }

    const keyDownEvent = (event:KeyboardEvent) => {
        if (waiting) return;
        if (activeNpcInteraction || isEventDialogActive()) {
            if (isMovementKey(event.key)) {
                event.preventDefault()
            }
            return;
        }
        if (isUxEventTarget(event.target)) return;

        // Space talks to / interacts with whatever the player is facing
        // (Map.tsx resolves the facing tile and routes the interaction).
        if (event.key === " " || event.key === "Spacebar") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent("pokecraft:interact-front"));
            return;
        }

        if (!isMovementKey(event.key)) return;
        event.preventDefault()
        // OS auto-repeat and the virtual d-pad both re-fire keydown while
        // held; the drive loop already covers held keys.
        if (heldKeysRef.current.includes(event.key)) return;

        heldKeysRef.current = [...heldKeysRef.current, event.key];
        emitHeldMove();
        startDriveLoop();
    }

    useEventListener('keyup', keyUpEvent)

    useEventListener('keydown', keyDownEvent)

    useEventListener('blur', () => {
        if (waiting) return;
        releaseAllKeys(true);
    })

    useEventListener("contextmenu", (event:Event) => {
        event.preventDefault();
    })

    return (<>
    </>)
}

export default UserControl;
