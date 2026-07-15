import { useContext, useEffect, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { AppContext } from "../../context/appContext"
import { AUTH_SESSION_SYNC_EVENT } from "../../context/authContext";
import {
    ensureBundledPlayableMapsSeeded,
    getPlayableMapsCacheVersion,
    persistPlayableMapsSyncPayload,
    sanitizePlayableMapsSnapshot,
    sanitizePlayableMapsSyncPayload,
} from "./playableMapRuntime";
import { getBackendBaseUrl } from "./backendConfig";

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

    useEffect(() => {
        // The maps payload is far too large for the websocket (streaming it
        // there queues heartbeats behind the transfer and drops the
        // connection) and for localStorage. Fetch it over plain HTTP where
        // the browser cache + ETag make repeat loads cheap; the socket sync
        // below stays as a fallback when the endpoint is unavailable.
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

            // With a warm cache the server answers with a tiny version
            // payload; the full-state socket stream only happens as fallback.
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
                return;
            }

            // Prefer the HTTP endpoint for the bulk transfer; only fall back
            // to the socket stream when it can't provide the announced version.
            if (await fetchPlayableMapsOverHttp()) {
                if (getPlayableMapsCacheVersion() === data.version) {
                    return;
                }
            }

            socket.emit("playableMaps:sync", {
                version: getPlayableMapsCacheVersion()
            });
        };

        const handleBattleState = (data:any) => {
            if (battleClearTimerRef.current !== null) {
                window.clearTimeout(battleClearTimerRef.current);
                battleClearTimerRef.current = null;
            }

            setBattleRef.current(data);

            if (data?.status === "ended") {
                battleClearTimerRef.current = window.setTimeout(() => {
                    clearBattleRef.current();
                    battleClearTimerRef.current = null;
                }, 12000);
            }
        };

        const handleBattleEvents = (data:any) => {
            if (Array.isArray(data?.events)) {
                appendBattleEventsRef.current(data.events);
            }
        };

        const handleBattleEnded = () => {
            window.setTimeout(() => {
                clearBattleRef.current();
            }, 12000);
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
        }
    }, [socket, toast])


    return (<></>)
}

export default Network;
