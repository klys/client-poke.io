import { useContext, useEffect, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { AppContext } from "../../context/appContext"
import { AUTH_SESSION_SYNC_EVENT } from "../../context/authContext";
import {
    getPlayableMapsCacheVersion,
    persistPlayableMapsSyncPayload,
    sanitizePlayableMapsSnapshot,
    sanitizePlayableMapsSyncPayload,
} from "./playableMapRuntime";

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
        setMyPlayer,
        playableMapsState,
        setPlayableMapsState,
        setBattle,
        clearBattle,
        addBattlePrompt,
        removeBattlePrompt,
    } = useContext(AppContext);
    const addPlayerRef = useRef(addPlayer);
    const removePlayerRef = useRef(removePlayer);
    const addProjectilRef = useRef(addProjectil);
    const removeProjectilRef = useRef(removeProjectil);
    const addObjectRef = useRef(addObject);
    const setMyPlayerRef = useRef(setMyPlayer);
    const playableMapsStateRef = useRef(playableMapsState);
    const setPlayableMapsStateRef = useRef(setPlayableMapsState);
    const setBattleRef = useRef(setBattle);
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
        setMyPlayerRef.current = setMyPlayer;
        playableMapsStateRef.current = playableMapsState;
        setPlayableMapsStateRef.current = setPlayableMapsState;
        setBattleRef.current = setBattle;
        clearBattleRef.current = clearBattle;
        addBattlePromptRef.current = addBattlePrompt;
        removeBattlePromptRef.current = removeBattlePrompt;
    }, [
        addPlayer,
        removePlayer,
        addProjectil,
        removeProjectil,
        addObject,
        setMyPlayer,
        playableMapsState,
        setPlayableMapsState,
        setBattle,
        clearBattle,
        addBattlePrompt,
        removeBattlePrompt,
    ]);

    useEffect(() => {
        const joinGame = () => {
            const token = getStoredAuthToken();

            socket.emit("playableMaps:sync", {
                version: getPlayableMapsCacheVersion()
            });
            socket.emit("addPlayer", token ? { token } : undefined);
        };

        const handleAddPlayer = (data:any) => {
            console.log("addPlayer",data)
            addPlayerRef.current(data)
        };

        const handleRemovePlayer = (data:any) => {
            console.log("removePlayer",data)
            removePlayerRef.current(data)
        };

        const handleShotProjectil = (data:any) => {
            console.log("shotProjectil",data)
            addProjectilRef.current(data)
        };

        const handleExplodeProjectil = (data:any) => {
            console.log("explodeProjectil",data)
            removeProjectilRef.current(data)
        };

        const handleAddObject = (data:any) => {
            console.log("addObject", data)
            addObjectRef.current(data)
        };

        const handleMyPlayer = (data:any) => {
            if (typeof data?.playerId === "string" && data.playerId.length > 0) {
                setMyPlayerRef.current(data.playerId)
            }
        };

        const handlePlayableMapsState = (data:any) => {
            const payload = sanitizePlayableMapsSyncPayload(data);

            if (payload) {
                persistPlayableMapsSyncPayload(payload);
                setPlayableMapsStateRef.current(payload.state);
                return;
            }

            setPlayableMapsStateRef.current(sanitizePlayableMapsSnapshot(data))
        };

        const handlePlayableMapsVersion = (data:any) => {
            if (data?.hasState !== true || typeof data.version !== "number") {
                return;
            }

            if (data.version === getPlayableMapsCacheVersion()) {
                return;
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
                }, 2400);
            }
        };

        const handleBattleEnded = () => {
            window.setTimeout(() => {
                clearBattleRef.current();
            }, 2400);
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
        socket.on("playableMaps:state", handlePlayableMapsState)
        socket.on("playableMaps:version", handlePlayableMapsVersion)
        socket.on("battle:state", handleBattleState)
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
            socket.off("playableMaps:state", handlePlayableMapsState)
            socket.off("playableMaps:version", handlePlayableMapsVersion)
            socket.off("battle:state", handleBattleState)
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
