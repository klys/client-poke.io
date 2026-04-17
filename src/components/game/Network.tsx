import { useContext, useEffect, useRef } from "react";
import { AppContext } from "../../context/appContext"
import { getInitialGameSpawn, getPlayableMapDefinitions } from "./playableMapRuntime";

const AUTH_TOKEN_STORAGE_KEY = "client-poke.io.auth.token";

function getStoredAuthToken() {
    if (typeof window === "undefined") {
        return null;
    }

    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

const Network = () => {
    const { socket, addPlayer, removePlayer, addProjectil, removeProjectil, addObject, setMyPlayer } = useContext(AppContext);
    const addPlayerRef = useRef(addPlayer);
    const removePlayerRef = useRef(removePlayer);
    const addProjectilRef = useRef(addProjectil);
    const removeProjectilRef = useRef(removeProjectil);
    const addObjectRef = useRef(addObject);
    const setMyPlayerRef = useRef(setMyPlayer);

    useEffect(() => {
        addPlayerRef.current = addPlayer;
        removePlayerRef.current = removePlayer;
        addProjectilRef.current = addProjectil;
        removeProjectilRef.current = removeProjectil;
        addObjectRef.current = addObject;
        setMyPlayerRef.current = setMyPlayer;
    }, [addPlayer, removePlayer, addProjectil, removeProjectil, addObject, setMyPlayer]);

    useEffect(() => {
        const joinGame = () => {
            const initialSpawn = getInitialGameSpawn();
            const mapDefinitions = getPlayableMapDefinitions();
            const token = getStoredAuthToken();

            socket.emit(
                "addPlayer",
                initialSpawn || token || mapDefinitions.length > 0
                    ? {
                        initialMapId: initialSpawn?.initialMapId,
                        initialX: initialSpawn?.initialX,
                        initialY: initialSpawn?.initialY,
                        mapDefinitions,
                        token: token ?? undefined
                    }
                    : undefined
            );
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

        return () => {
            socket.off("connect", joinGame)
            socket.off("addPlayer", handleAddPlayer)
            socket.off("myPlayer", handleMyPlayer)
            socket.off("removePlayer", handleRemovePlayer)
            socket.off("shotProjectil", handleShotProjectil)
            socket.off("explodeProjectil", handleExplodeProjectil)
            socket.off("addObject", handleAddObject)
        }
    }, [socket])


    return (<></>)
}

export default Network;
