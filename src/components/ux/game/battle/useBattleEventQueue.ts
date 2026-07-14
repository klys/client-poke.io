import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattlePublicState } from "../battleTypes";
import type {
  BattleSequencedEvent,
  BattleStatGain,
  BattleStatKey,
  BattleStatusId
} from "./battleEvents";
import { battleAudio, type BattleSoundCue } from "./battleAudio";
import { gameAudio, resolveGameAudioSrc } from "../gameAudio";
import type { BattleInterfaceConfig } from "./battleInterfaceConfig";
import { resolveSkillGfx, type ResolvedSkillGfx } from "./skillGfx";

export type BattleSpriteFx = "attack" | "hit" | "faint" | "enter" | "";

export type BattleHpOverride = { hp: number; maxHp: number };
export type BattleExpOverride = { experience: number; nextLevelExperience: number };

export type ActiveMoveAnimation = {
  key: number;
  gfx: ResolvedSkillGfx;
  /** the battler slot the animation is rendered over */
  targetSideId: "a" | "b";
};

export type ActiveLevelUp = {
  pokemonId: string;
  pokemonName: string;
  level: number;
  statGains: Record<BattleStatKey, BattleStatGain>;
};

export type ActiveEvolution = {
  pokemonId: string;
  sideId: "a" | "b";
  fromName: string;
  toName: string;
  frontImageSrc: string;
  backImageSrc: string;
};

export type PendingLearnPrompt = {
  pokemonId: string;
  pokemonName: string;
  moveName: string;
  currentMoves: string[];
};

export type CatchPlayback = { shakes: number; caught: boolean; stage: number };

export type BattlePlayback = {
  message: string | null;
  displayHp: Record<string, BattleHpOverride>;
  displayExp: Record<string, BattleExpOverride>;
  displayLevel: Record<string, number>;
  displayStatus: Record<string, BattleStatusId | null>;
  spriteFx: Record<"a" | "b", BattleSpriteFx>;
  /** Set only after the faint drop animation has fully played: from then on
   * the battler stays hidden (cleared when a replacement switches in). */
  fainted: Record<"a" | "b", boolean>;
  activeAnimation: ActiveMoveAnimation | null;
  activeLevelUp: ActiveLevelUp | null;
  activeEvolution: ActiveEvolution | null;
  learnPrompts: PendingLearnPrompt[];
  catchPlayback: CatchPlayback | null;
  /** The wild mon was caught: keep its sprite hidden (it is in the ball). */
  enemyCaught: boolean;
  introPlaying: boolean;
  queueBusy: boolean;
};

const INITIAL_PLAYBACK: BattlePlayback = {
  message: null,
  displayHp: {},
  displayExp: {},
  displayLevel: {},
  displayStatus: {},
  spriteFx: { a: "", b: "" },
  fainted: { a: false, b: false },
  activeAnimation: null,
  activeLevelUp: null,
  activeEvolution: null,
  learnPrompts: [],
  catchPlayback: null,
  enemyCaught: false,
  introPlaying: false,
  queueBusy: false
};

const LEVEL_UP_AUTO_DISMISS_MS = 5000;

export function useBattleEventQueue({
  battle,
  events,
  config,
  selfSideId
}: {
  battle: BattlePublicState | null;
  events: BattleSequencedEvent[];
  config: BattleInterfaceConfig;
  selfSideId: "a" | "b" | null;
}) {
  const [playback, setPlayback] = useState<BattlePlayback>(INITIAL_PLAYBACK);
  const queueRef = useRef<BattleSequencedEvent[]>([]);
  const processingRef = useRef(false);
  const lastSeqRef = useRef(0);
  const cancelledRef = useRef(false);
  const battleIdRef = useRef<string | null>(null);
  const levelUpResolveRef = useRef<(() => void) | null>(null);
  const animationKeyRef = useRef(0);
  const configRef = useRef(config);
  const selfSideRef = useRef(selfSideId);

  configRef.current = config;
  selfSideRef.current = selfSideId;

  const speed = Math.max(0.25, config.animationSpeed);

  const update = useCallback((updater: (previous: BattlePlayback) => BattlePlayback) => {
    if (!cancelledRef.current) {
      setPlayback(updater);
    }
  }, []);

  const wait = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms / Math.max(0.25, configRef.current.animationSpeed));
      }),
    []
  );

  const playCue = useCallback((cue: BattleSoundCue) => {
    battleAudio.playCue(cue, configRef.current);
  }, []);

  const showText = useCallback(
    async (text: string | undefined, holdMs = 650) => {
      if (!text) {
        return;
      }
      update((previous) => ({ ...previous, message: text }));
      const typeMs = text.length * configRef.current.textSpeedMsPerChar;
      await wait(Math.min(2600, typeMs + holdMs));
    },
    [update, wait]
  );

  const setSpriteFx = useCallback(
    (sideId: "a" | "b", fx: BattleSpriteFx) => {
      update((previous) => ({
        ...previous,
        spriteFx: { ...previous.spriteFx, [sideId]: fx }
      }));
    },
    [update]
  );

  const dismissLevelUp = useCallback(() => {
    levelUpResolveRef.current?.();
  }, []);

  const dismissLearnPrompt = useCallback(
    (pokemonId: string, moveName: string) => {
      update((previous) => ({
        ...previous,
        learnPrompts: previous.learnPrompts.filter(
          (prompt) => !(prompt.pokemonId === pokemonId && prompt.moveName === moveName)
        )
      }));
    },
    [update]
  );

  const handleEvent = useCallback(
    async (event: BattleSequencedEvent) => {
      switch (event.kind) {
        case "battle-start": {
          // Kill any fanfare still ringing from the previous battle.
          battleAudio.stopAllCues();
          battleAudio.stopBgm();
          update((previous) => ({ ...previous, introPlaying: true }));
          playCue(event.battleKind === "wild" ? "battle-intro-wild" : "battle-intro-trainer");
          // Map music pauses for the battle; the Venova PBS defaults cover
          // battles unless the designer set an explicit battle BGM.
          gameAudio.suspendBgm();
          const battleBgmSrc =
            configRef.current.battleBgmSrc ||
            resolveGameAudioSrc(event.battleKind === "wild" ? "002-Battle02" : "005-Boss01", "BGM");
          if (battleBgmSrc) {
            battleAudio.playBgm(battleBgmSrc, configRef.current);
          }
          if (configRef.current.introTransition !== "none") {
            await wait(1700);
          }
          update((previous) => ({ ...previous, introPlaying: false }));
          break;
        }
        case "message": {
          await showText(event.text ?? event.kind);
          break;
        }
        case "move-used": {
          const messagePromise = showText(event.text, 250);
          setSpriteFx(event.sideId, "attack");
          await messagePromise;

          const gfx = resolveSkillGfx(event);
          if (gfx) {
            const targetSideId =
              gfx.applyTo === "user" ? event.sideId : event.sideId === "a" ? "b" : "a";
            animationKeyRef.current += 1;
            const animation: ActiveMoveAnimation = {
              key: animationKeyRef.current,
              gfx,
              targetSideId
            };
            update((previous) => ({ ...previous, activeAnimation: animation }));
            await wait(gfx.durationMs + 120);
            update((previous) =>
              previous.activeAnimation?.key === animation.key
                ? { ...previous, activeAnimation: null }
                : previous
            );
          } else {
            await wait(420);
          }
          setSpriteFx(event.sideId, "");
          break;
        }
        case "move-missed": {
          await showText(event.text);
          break;
        }
        case "damage": {
          if (event.source === "move") {
            playCue(
              event.effectiveness > 1
                ? "hit-super-effective"
                : event.effectiveness < 1
                  ? "hit-not-very-effective"
                  : "hit-normal"
            );
            setSpriteFx(event.sideId, "hit");
          } else {
            playCue("status");
          }
          update((previous) => ({
            ...previous,
            displayHp: {
              ...previous.displayHp,
              [event.pokemonId]: { hp: event.hpAfter, maxHp: event.maxHp }
            }
          }));
          if (event.text && event.source !== "move") {
            await showText(event.text, 350);
          } else {
            await wait(620);
          }
          setSpriteFx(event.sideId, "");
          break;
        }
        case "heal": {
          playCue("heal");
          update((previous) => ({
            ...previous,
            displayHp: {
              ...previous.displayHp,
              [event.pokemonId]: { hp: event.hpAfter, maxHp: event.maxHp }
            }
          }));
          await showText(event.text, 350);
          break;
        }
        case "stat-change": {
          playCue(event.delta > 0 ? "stat-up" : "stat-down");
          await showText(event.text);
          break;
        }
        case "status-applied": {
          playCue("status");
          update((previous) => ({
            ...previous,
            displayStatus: { ...previous.displayStatus, [event.pokemonId]: event.status }
          }));
          await showText(event.text);
          break;
        }
        case "status-cured": {
          update((previous) => ({
            ...previous,
            displayStatus: { ...previous.displayStatus, [event.pokemonId]: null }
          }));
          await showText(event.text);
          break;
        }
        case "confusion-start":
        case "confusion-end":
        case "flinch":
        case "item-used": {
          await showText(event.text);
          break;
        }
        case "held-item-used": {
          playCue("heal");
          await showText(event.text);
          break;
        }
        case "faint": {
          playCue("faint");
          setSpriteFx(event.sideId, "faint");
          // The CSS drop runs a fixed 0.8s, unaffected by animationSpeed —
          // never hide the battler before it has visibly gone down.
          const dropDone = new Promise<void>((resolve) => {
            window.setTimeout(resolve, 850);
          });
          await showText(event.text, 500);
          await wait(420);
          await dropDone;
          update((previous) => ({
            ...previous,
            fainted: { ...previous.fainted, [event.sideId]: true },
            spriteFx: { ...previous.spriteFx, [event.sideId]: "" }
          }));
          break;
        }
        case "switch": {
          update((previous) => ({
            ...previous,
            fainted: { ...previous.fainted, [event.sideId]: false },
            displayHp: {
              ...previous.displayHp,
              [event.pokemon.id]: { hp: event.pokemon.hp, maxHp: event.pokemon.maxHp }
            }
          }));
          setSpriteFx(event.sideId, "enter");
          await showText(event.text, 420);
          setSpriteFx(event.sideId, "");
          break;
        }
        case "catch-attempt": {
          playCue("ball-throw");
          update((previous) => ({
            ...previous,
            catchPlayback: { shakes: event.shakes, caught: event.caught, stage: 0 }
          }));
          await wait(650);
          for (let shake = 1; shake <= event.shakes && shake <= 3; shake += 1) {
            playCue("ball-shake");
            update((previous) =>
              previous.catchPlayback
                ? { ...previous, catchPlayback: { ...previous.catchPlayback, stage: shake } }
                : previous
            );
            await wait(600);
          }
          if (event.caught) {
            playCue("ball-caught");
          }
          await showText(event.text, 700);
          // On success the mon stays in the ball; only a breakout re-shows it.
          update((previous) => ({
            ...previous,
            catchPlayback: null,
            enemyCaught: previous.enemyCaught || event.caught
          }));
          break;
        }
        case "exp-gain": {
          playCue("exp-gain");
          update((previous) => ({
            ...previous,
            displayExp: {
              ...previous.displayExp,
              [event.pokemonId]: {
                experience: event.experience,
                nextLevelExperience: event.nextLevelExperience
              }
            }
          }));
          await showText(event.text, 350);
          break;
        }
        case "level-up": {
          playCue("level-up");
          update((previous) => ({
            ...previous,
            displayLevel: { ...previous.displayLevel, [event.pokemonId]: event.level },
            displayExp: {
              ...previous.displayExp,
              [event.pokemonId]: { experience: 0, nextLevelExperience: previous.displayExp[event.pokemonId]?.nextLevelExperience ?? 0 }
            },
            displayHp: {
              ...previous.displayHp,
              [event.pokemonId]: {
                hp: Math.min(
                  (previous.displayHp[event.pokemonId]?.hp ?? event.statGains.hp.after) +
                    event.statGains.hp.gain,
                  event.statGains.hp.after
                ),
                maxHp: event.statGains.hp.after
              }
            },
            message: event.text ?? previous.message
          }));

          if (event.sideId === selfSideRef.current) {
            const levelUp: ActiveLevelUp = {
              pokemonId: event.pokemonId,
              pokemonName: event.pokemonName,
              level: event.level,
              statGains: event.statGains
            };
            update((previous) => ({ ...previous, activeLevelUp: levelUp }));
            await new Promise<void>((resolve) => {
              const timeout = window.setTimeout(() => {
                levelUpResolveRef.current = null;
                resolve();
              }, LEVEL_UP_AUTO_DISMISS_MS);
              levelUpResolveRef.current = () => {
                window.clearTimeout(timeout);
                levelUpResolveRef.current = null;
                resolve();
              };
            });
            update((previous) => ({ ...previous, activeLevelUp: null }));
          } else {
            await wait(900);
          }
          break;
        }
        case "move-learned": {
          await showText(event.text);
          break;
        }
        case "move-learn-prompt": {
          if (event.sideId === selfSideRef.current) {
            const prompt: PendingLearnPrompt = {
              pokemonId: event.pokemonId,
              pokemonName: event.pokemonName,
              moveName: event.moveName,
              currentMoves: event.currentMoves
            };
            update((previous) => ({
              ...previous,
              learnPrompts: [...previous.learnPrompts.filter(
                (existing) => !(existing.pokemonId === prompt.pokemonId && existing.moveName === prompt.moveName)
              ), prompt]
            }));
          }
          await showText(event.text);
          break;
        }
        case "evolution": {
          playCue("evolution");
          const evolution: ActiveEvolution = {
            pokemonId: event.pokemonId,
            sideId: event.sideId,
            fromName: event.fromName,
            toName: event.toName,
            frontImageSrc: event.frontImageSrc,
            backImageSrc: event.backImageSrc
          };
          update((previous) => ({ ...previous, activeEvolution: evolution }));
          await showText(event.text, 800);
          await wait(3400);
          update((previous) => ({ ...previous, activeEvolution: null }));
          break;
        }
        case "escape": {
          playCue("escape");
          await showText(event.text);
          break;
        }
        case "battle-end": {
          battleAudio.stopBgm();
          if (event.winnerSideId && event.winnerSideId === selfSideRef.current) {
            playCue("victory");
            if (configRef.current.victoryMeSrc) {
              // A jingle, not a loop — it must end on its own.
              battleAudio.playBgm(
                configRef.current.victoryMeSrc,
                {
                  bgmVolume: configRef.current.bgmVolume,
                  muteBgm: configRef.current.muteBgm
                },
                false
              );
            }
          }
          await showText(event.text ?? event.result, 500);
          break;
        }
        default:
          await showText((event as { text?: string }).text);
          break;
      }
    },
    [playCue, setSpriteFx, showText, update, wait]
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;
    update((previous) => ({ ...previous, queueBusy: true }));

    while (queueRef.current.length > 0 && !cancelledRef.current) {
      const event = queueRef.current.shift()!;
      try {
        await handleEvent(event);
      } catch {
        // Never let one bad event stall the battle playback.
      }
    }

    processingRef.current = false;
    update((previous) => ({ ...previous, queueBusy: false }));
  }, [handleEvent, update]);

  // Reset on battle change. This MUST run before the feed effect below: when
  // battle:state and the first battle:events batch land in the same React
  // commit, resetting after feeding wiped the just-started intro AND rewound
  // lastSeqRef, which made the intro transition replay on the next batch
  // (i.e. after the player's first action) instead of at battle start.
  useEffect(() => {
    const battleId = battle?.id ?? null;
    if (battleIdRef.current === battleId) {
      return;
    }

    const hadPreviousBattle = battleIdRef.current !== null;
    battleIdRef.current = battleId;
    if (hadPreviousBattle) {
      queueRef.current = [];
      lastSeqRef.current = 0;
      levelUpResolveRef.current?.();
      setPlayback(INITIAL_PLAYBACK);
    }

    if (!battleId) {
      battleAudio.stopBgm();
      gameAudio.resumeBgm();
    }
  }, [battle?.id]);

  // Feed fresh events into the queue.
  useEffect(() => {
    const fresh = events.filter((event) => event.seq > lastSeqRef.current);
    if (fresh.length === 0) {
      return;
    }

    lastSeqRef.current = fresh[fresh.length - 1].seq;
    queueRef.current.push(...fresh);
    void processQueue();
  }, [events, processQueue]);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      battleAudio.stopBgm();
      gameAudio.resumeBgm();
    };
  }, []);

  // When the queue is idle, the authoritative battle state wins again.
  useEffect(() => {
    if (!playback.queueBusy && queueRef.current.length === 0) {
      update((previous) =>
        Object.keys(previous.displayHp).length > 0 ||
        Object.keys(previous.displayExp).length > 0 ||
        Object.keys(previous.displayLevel).length > 0 ||
        Object.keys(previous.displayStatus).length > 0
          ? { ...previous, displayHp: {}, displayExp: {}, displayLevel: {}, displayStatus: {} }
          : previous
      );
    }
  }, [battle, playback.queueBusy, update]);

  return useMemo(
    () => ({ playback, dismissLevelUp, dismissLearnPrompt }),
    [playback, dismissLevelUp, dismissLearnPrompt]
  );
}
