import { useContext, useEffect, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { AppContext } from "../../context/appContext"
import { AUTH_SESSION_SYNC_EVENT } from "../../context/authContext";
import {
    ensureBundledPlayableMapsSeeded,
    getPlayableMapsCacheVersion,
    loadPlayableMapsCache,
    persistPlayableMapsSyncPayload,
    sanitizePlayableMapsSnapshot,
    sanitizePlayableMapsSyncPayload,
} from "./playableMapRuntime";
import { getBackendBaseUrl } from "./backendConfig";
import { isBattleUiHeld } from "../ux/game/battle/battleUiHold";

const AUTH_TOKEN_STORAGE_KEY = "client-poke.io.auth.token";

function getStoredAuthToken() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

const Network = () => {
    const toast = useToast();
    const {
        socket,
        addPlayer,
        removePlayer,
        addProjectil,
        removeProjectil,
        addObject,
        addGroundItem,
        removeGroundItem,
        setMyPlayer,
        playableMapsState,
        setPlayableMapsState,
        setBattle,
        appendBattleEvents,
        clearBattle,
        addBattlePrompt,
        removeBattlePrompt,
        setEventState,
    } = useContext(AppContext);
    const setEventStateRef = useRef(setEventState);
    setEventStateRef.current = setEventState;
    const addPlayerRef = useRef(addPlayer);
    const removePlayerRef = useRef(removePlayer);
    const addProjectilRef = useRef(addProjectil);
    const removeProjectilRef = useRef(removeProjectil);
    const addObjectRef = useRef(addObject);
    const addGroundItemRef = useRef(addGroundItem);
    const removeGroundItemRef = useRef(removeGroundItem);
    const setMyPlayerRef = useRef(setMyPlayer);
    const playableMapsStateRef = useRef(playableMapsState);
    const setPlayableMapsStateRef = useRef(setPlayableMapsState);
    const setBattleRef = useRef(setBattle);
    const appendBattleEventsRef = useRef(appendBattleEvents);
    const clearBattleRef = useRef(clearBattle);
    const addBattlePromptRef = useRef(addBattlePrompt);
    const removeBattlePromptRef = useRef(removeBattlePrompt);
    const battleClearTimerRef = useRef<number | null>(null);
    const latestBattleRef = useRef<{ id: string | null; status: string | null } | null>(null);

    useEffect(() => {
        addPlayerRef.current = addPlayer;
        removePlayerRef.current = removePlayer;
        addProjectilRef.current = addProjectil;
        removeProjectilRef.current = removeProjectil;
        addObjectRef.current = addObject;
        addGroundItemRef.current = addGroundItem;
        removeGroundItemRef.current = removeGroundItem;
        setMyPlayerRef.current = setMyPlayer;
        playableMapsStateRef.current = playableMapsState;
        setPlayableMapsStateRef.current = setPlayableMapsState;
        setBattleRef.current = setBattle;
        appendBattleEventsRef.current = appendBattleEvents;
        clearBattleRef.current = clearBattle;
        addBattlePromptRef.current = addBattlePrompt;
        removeBattlePromptRef.current = removeBattlePrompt;
    }, [
        addPlayer,
        removePlayer,
        addProjectil,
        removeProjectil,
        addObject,
        addGroundItem,
        removeGroundItem,
        setMyPlayer,
        playableMapsState,
        setPlayableMapsState,
        setBattle,
        appendBattleEvents,
        clearBattle,
        addBattlePrompt,
        removeBattlePrompt,
    ]);

    const mapsFetchTimerRef = useRef<number | null>(null);
    const mapsFetchAttemptRef = useRef(0);

    useEffect(() => {
        // The maps payload is far too large for the websocket (streaming it
        // there queues heartbeats behind the transfer and drops the
        // connection) and for localStorage. It ONLY travels over plain HTTP,
        // where the browser cache + ETag make repeat loads cheap; the server
        // answers the socket sync with a tiny version stub and we keep
        // retrying this endpoint (with backoff) until it delivers.
        const fetchPlayableMapsOverHttp = async () => {
            try {
                const response = await fetch(`${getBackendBaseUrl()}/playable-maps.json`);

                if (!response.ok) {
                    return false;
                }

                const payload = sanitizePlayableMapsSyncPayload(await response.json());

                if (!payload) {
                    return false;
                }

                setPlayableMapsStateRef.current(payload.state);
                persistPlayableMapsSyncPayload(payload);
                return true;
            } catch {
                return false;
            }
        };

        const joinGame = async () => {
            const token = getStoredAuthToken();

            // Native app builds ship the maps payload inside the app; seed it
            // before negotiating versions so nothing has to be downloaded.
            await ensureBundledPlayableMapsSeeded();

            if (getPlayableMapsCacheVersion() === null) {
                await fetchPlayableMapsOverHttp();
            }

            // Push the cached payload into the game state. The app context
            // initializes from storage BEFORE the async seeding/fetch above
            // completes, and when the server then answers the sync below with
            // a version match it sends no state — without this the map would
            // stay empty even though the payload sits in the cache.
            const cachedPayload = loadPlayableMapsCache();
            if (cachedPayload) {
                setPlayableMapsStateRef.current(cachedPayload.state);
            }

            // The server always answers with a tiny version payload; when it
            // announces a newer version the handler below refetches the HTTP
            // endpoint until it succeeds.
            socket.emit("playableMaps:sync", {
                version: getPlayableMapsCacheVersion()
            });
            socket.emit("addPlayer", token ? { token } : undefined);
        };

        const handleAddPlayer = (data:any) => {
            addPlayerRef.current(data)
        };

        const handleRemovePlayer = (data:any) => {
            removePlayerRef.current(data)
        };

        const handleShotProjectil = (data:any) => {
            addProjectilRef.current(data)
        };

        const handleExplodeProjectil = (data:any) => {
            removeProjectilRef.current(data)
        };

        const handleAddObject = (data:any) => {
            addObjectRef.current(data)
        };

        const handleGroundItemDropped = (data:any) => {
            addGroundItemRef.current(data);
        };

        const handleGroundItemPickedUp = (data:any) => {
            if (typeof data?.groundItemId === "string") {
                removeGroundItemRef.current(data.groundItemId);
            }
        };

        const handleMyPlayer = (data:any) => {
            if (typeof data?.playerId === "string" && data.playerId.length > 0) {
                setMyPlayerRef.current(data.playerId)
            }
        };

        const handlePlayableMapsState = (data:any) => {
            const payload = sanitizePlayableMapsSyncPayload(data);

            if (payload) {
                setPlayableMapsStateRef.current(payload.state);
                persistPlayableMapsSyncPayload(payload);
                return;
            }

            setPlayableMapsStateRef.current(sanitizePlayableMapsSnapshot(data))
        };

        const handlePlayableMapsVersion = async (data:any) => {
            if (data?.hasState !== true || typeof data.version !== "number") {
                return;
            }

            if (data.version === getPlayableMapsCacheVersion()) {
                mapsFetchAttemptRef.current = 0;
                return;
            }

            // The server never streams the full state over the socket
            // anymore; keep hitting the HTTP endpoint (exponential backoff,
            // capped at 30s) until it hands us a payload. Holding a stale
            // cached version in the meantime is fine — the map stays playable.
            if (await fetchPlayableMapsOverHttp()) {
                mapsFetchAttemptRef.current = 0;
                return;
            }

            if (mapsFetchTimerRef.current !== null) {
                return; // a retry is already scheduled
            }

            const delay = Math.min(1000 * 2 ** mapsFetchAttemptRef.current, 30000);
            mapsFetchAttemptRef.current += 1;
            mapsFetchTimerRef.current = window.setTimeout(() => {
                mapsFetchTimerRef.current = null;
                void handlePlayableMapsVersion(data);
            }, delay);
        };

        // All deferred battle clears go through the single tracked timer and
        // re-check the latest battle before wiping it, so a stale "ended"
        // timer from a previous battle can never erase a battle that started
        // in the meantime (which left the player stuck with no battle view).
        const scheduleBattleClear = (battleId: string | null, delayMs = 12000) => {
            if (battleClearTimerRef.current !== null) {
                window.clearTimeout(battleClearTimerRef.current);
            }

            battleClearTimerRef.current = window.setTimeout(() => {
                battleClearTimerRef.current = null;

                const latest = latestBattleRef.current;
                if (latest && latest.status === "active") {
                    return;
                }
                if (battleId && latest && latest.id && latest.id !== battleId) {
                    return;
                }

                // The battle scene still needs the player's input (a
                // move-learn prompt, or events still playing back) — never
                // close it under them; check again shortly instead.
                if (isBattleUiHeld()) {
                    scheduleBattleClear(battleId, 3000);
                    return;
                }

                clearBattleRef.current();
            }, delayMs);
        };

        const handleBattleState = (data:any) => {
            if (battleClearTimerRef.current !== null) {
                window.clearTimeout(battleClearTimerRef.current);
                battleClearTimerRef.current = null;
            }

            latestBattleRef.current = data
                ? { id: data.id ?? null, status: data.status ?? null }
                : null;
            setBattleRef.current(data);

            if (data?.status === "ended") {
                scheduleBattleClear(data.id ?? null);
            }
        };

        const handleBattleEvents = (data:any) => {
            if (Array.isArray(data?.events)) {
                appendBattleEventsRef.current(data.events);
            }
        };

        const handleBattleEnded = (data:any) => {
            const latest = latestBattleRef.current;
            const endedBattleId = typeof data?.battleId === "string" ? data.battleId : null;

            // Stale end notice for a battle we already replaced — ignore it.
            if (endedBattleId && latest && latest.id && latest.id !== endedBattleId) {
                return;
            }

            scheduleBattleClear(endedBattleId);
        };

        const handleBattleError = (data:any) => {
            toast({
                title: data?.message ?? "Battle action failed.",
                status: "warning",
                duration: 3000,
                isClosable: true,
                position: "top"
            });
        };

        const handleChallengeReceived = (data:any) => {
            addBattlePromptRef.current({
                id: data.challengeId,
                type: "battle",
                fromPlayerId: data.fromPlayerId,
                fromUsername: data.fromUsername
            });
        };

        const handleTradeReceived = (data:any) => {
            addBattlePromptRef.current({
                id: data.requestId,
                type: "trade",
                fromPlayerId: data.fromPlayerId,
                fromUsername: data.fromUsername
            });
        };

        const handleChallengeClosed = (data:any) => {
            if (data?.challengeId) {
                removeBattlePromptRef.current(data.challengeId);
            }
        };

        const handleTradeClosed = (data:any) => {
            if (data?.requestId) {
                removeBattlePromptRef.current(data.requestId);
            }
        };

        const handleTradeAccepted = () => {
            toast({
                title: "Trade accepted.",
                description: "The trading interface will be added later.",
                status: "info",
                duration: 3000,
                isClosable: true,
                position: "top"
            });
        };

        const handleAuthSession = (data:any) => {
            window.dispatchEvent(new CustomEvent(AUTH_SESSION_SYNC_EVENT, { detail: data }));
        };

        if (socket.connected) {
            joinGame();
        }

        socket.on("connect", joinGame)
        socket.on("addPlayer", handleAddPlayer)
        socket.on("myPlayer", handleMyPlayer)
        socket.on("removePlayer", handleRemovePlayer)
        socket.on("shotProjectil", handleShotProjectil)
        socket.on("explodeProjectil", handleExplodeProjectil)
        socket.on("addObject", handleAddObject)
        socket.on("world:item-dropped", handleGroundItemDropped)
        socket.on("world:item-picked-up", handleGroundItemPickedUp)
        socket.on("playableMaps:state", handlePlayableMapsState)
        socket.on("playableMaps:version", handlePlayableMapsVersion)
        socket.on("event:state", (data:any) => {
            if (data && typeof data === "object") {
                setEventStateRef.current({
                    switches: data.switches ?? {},
                    variables: data.variables ?? {},
                    selfSwitches: data.selfSwitches ?? {},
                })
            }
        })
        socket.on("battle:state", handleBattleState)
        socket.on("battle:events", handleBattleEvents)
        socket.on("battle:ended", handleBattleEnded)
        socket.on("battle:error", handleBattleError)
        socket.on("battle:challenge-received", handleChallengeReceived)
        socket.on("battle:challenge-declined", handleChallengeClosed)
        socket.on("battle:challenge-expired", handleChallengeClosed)
        socket.on("battle:trade-request-received", handleTradeReceived)
        socket.on("battle:trade-accepted", handleTradeAccepted)
        socket.on("battle:trade-declined", handleTradeClosed)
        socket.on("battle:trade-expired", handleTradeClosed)
        socket.on("auth:session", handleAuthSession)

        return () => {
            socket.off("connect", joinGame)
            socket.off("addPlayer", handleAddPlayer)
            socket.off("myPlayer", handleMyPlayer)
            socket.off("removePlayer", handleRemovePlayer)
            socket.off("shotProjectil", handleShotProjectil)
            socket.off("explodeProjectil", handleExplodeProjectil)
            socket.off("addObject", handleAddObject)
            socket.off("world:item-dropped", handleGroundItemDropped)
            socket.off("world:item-picked-up", handleGroundItemPickedUp)
            socket.off("playableMaps:state", handlePlayableMapsState)
            socket.off("playableMaps:version", handlePlayableMapsVersion)
            socket.off("battle:state", handleBattleState)
            socket.off("battle:events", handleBattleEvents)
            socket.off("battle:ended", handleBattleEnded)
            socket.off("battle:error", handleBattleError)
            socket.off("battle:challenge-received", handleChallengeReceived)
            socket.off("battle:challenge-declined", handleChallengeClosed)
            socket.off("battle:challenge-expired", handleChallengeClosed)
            socket.off("battle:trade-request-received", handleTradeReceived)
            socket.off("battle:trade-accepted", handleTradeAccepted)
            socket.off("battle:trade-declined", handleTradeClosed)
            socket.off("battle:trade-expired", handleTradeClosed)
            socket.off("auth:session", handleAuthSession)
            if (battleClearTimerRef.current !== null) {
                window.clearTimeout(battleClearTimerRef.current);
                battleClearTimerRef.current = null;
            }
            if (mapsFetchTimerRef.current !== null) {
                window.clearTimeout(mapsFetchTimerRef.current);
                mapsFetchTimerRef.current = null;
            }
        }
    }, [socket, toast])


    return (<></>)
}

export default Network;
