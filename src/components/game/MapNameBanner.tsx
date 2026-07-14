import { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../../context/appContext";
import { getInitialPlayableMap, getPlayableMapById } from "./playableMapRuntime";

const BANNER_VISIBLE_MS = 15000;

/**
 * Shows the current map's name for fifteen seconds whenever the player enters
 * a map (including the first spawn), like the location banner in the classic
 * Pokemon games. Rendered top-center so the account menu can't cover it.
 */
const MapNameBanner = () => {
  const { players, myplayer, playableMapsState } = useContext(AppContext);
  const [visibleName, setVisibleName] = useState<string | null>(null);
  const lastMapIdRef = useRef<string | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const currentPlayer: any =
    Object.values(players ?? {}).find((player: any) => player?.playerId === myplayer) ?? null;
  const activeMap =
    getPlayableMapById(currentPlayer?.currentMapId, playableMapsState) ??
    getInitialPlayableMap(playableMapsState);
  const activeMapId = activeMap?.item.id ?? null;
  const activeMapName = activeMap?.item.name ?? null;

  useEffect(() => {
    if (!activeMapId || !activeMapName || activeMapId === lastMapIdRef.current) {
      return;
    }

    lastMapIdRef.current = activeMapId;
    setVisibleName(activeMapName);

    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    hideTimerRef.current = window.setTimeout(() => {
      setVisibleName(null);
      hideTimerRef.current = null;
    }, BANNER_VISIBLE_MS);
  }, [activeMapId, activeMapName]);

  useEffect(
    () => () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  if (!visibleName) {
    return null;
  }

  return (
    <div
      data-game-ux="true"
      style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 3500,
        padding: "10px 18px",
        background: "rgba(20, 28, 22, 0.92)",
        border: "2px solid #e8f0e6",
        borderRadius: "6px",
        boxShadow: "0 2px 0 rgba(0, 0, 0, 0.45)",
        color: "#f4f8f2",
        fontFamily: "'Courier New', monospace",
        fontWeight: 700,
        fontSize: "16px",
        letterSpacing: "0.06em",
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      {visibleName}
    </div>
  );
};

export default MapNameBanner;
