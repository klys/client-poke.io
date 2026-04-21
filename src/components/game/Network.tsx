import { useContext, useEffect, useRef } from "react";
import { AppContext } from "../../context/appContext"
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
    } = useContext(AppContext);
    const addPlayerRef = useRef(addPlayer);
    const removePlayerRef = useRef(removePlayer);
    const addProjectilRef = useRef(addProjectil);
    const removeProjectilRef = useRef(removeProjectil);
    const addObjectRef = useRef(addObject);
    const setMyPlayerRef = useRef(setMyPlayer);
    const playableMapsStateRef = useRef(playableMapsState);
    const setPlayableMapsStateRef = useRef(setPlayableMapsState);

    useEffect(() => {
        addPlayerRef.current = addPlayer;
        removePlayerRef.current = removePlayer;
        addProjectilRef.current = addProjectil;
        removeProjectilRef.current = removeProjectil;
        addObjectRef.current = addObject;
        setMyPlayerRef.current = setMyPlayer;
        playableMapsStateRef.current = playableMapsState;
        setPlayableMapsStateRef.current = setPlayableMapsState;
    }, [
        addPlayer,
        removePlayer,
        addProjectil,
        removeProjectil,
        addObject,
        setMyPlayer,
        playableMapsState,
        setPlayableMapsState,
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
        }
    }, [socket])


    return (<></>)
}

export default Network;
