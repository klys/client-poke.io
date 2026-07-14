import { useContext, useEffect } from "react";
import { AppContext } from "../../context/appContext";
import { getInitialPlayableMap, getPlayableMapById } from "./playableMapRuntime";
import { gameAudio } from "../ux/game/gameAudio";

/**
 * Plays each map's background music (the RMXP map BGM imported from Venova).
 * Switches tracks on map change and retries on the first user gesture, since
 * browsers block autoplay before any interaction.
 */
const MapMusic = () => {
  const { players, myplayer, playableMapsState, battle } = useContext(AppContext);

  const currentPlayer: any =
    Object.values(players ?? {}).find((player: any) => player?.playerId === myplayer) ?? null;
  const activeMap =
    getPlayableMapById(currentPlayer?.currentMapId, playableMapsState) ??
    getInitialPlayableMap(playableMapsState);
  const bgmName =
    ((activeMap?.item as { playableMapConfig?: { bgm?: string } } | undefined)?.playableMapConfig
      ?.bgm ?? "").trim();
  const inBattle = Boolean(battle && battle.status === "active");

  useEffect(() => {
    if (inBattle) {
      return; // the battle scene owns the speakers; map music resumes after
    }
    if (bgmName) {
      gameAudio.playBgm(bgmName);
    } else {
      gameAudio.stopBgm();
    }
  }, [bgmName, inBattle]);

  // Autoplay unlock: browsers reject play() before a user gesture, so retry
  // the current track on the first click/keypress.
  useEffect(() => {
    const unlock = () => {
      if (bgmName && !inBattle && !gameAudio.isSuspended) {
        gameAudio.playBgm(bgmName);
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [bgmName, inBattle]);

  useEffect(
    () => () => {
      gameAudio.stopBgm();
    },
    []
  );

  return <></>;
};

export default MapMusic;
