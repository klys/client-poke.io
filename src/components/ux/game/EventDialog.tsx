import { Box, Button, Flex, Input, Text, VStack, keyframes } from "@chakra-ui/react";
import { useContext, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { AppContext } from "../../../context/appContext";
import { useAuth } from "../../../context/authContext";
import { readStoredDesignerSectionPayload } from "../../designer/designerCache";
import { assetUrl, resolveServerAssetUrl } from "../../tilemap/serverAssets";
import { cleanRmxpText } from "./NpcInteractions";
import { gameAudio } from "./gameAudio";
import {
  cameraEffectsActive,
  clearCameraEffects,
  scrollCameraBy,
  shakeCamera
} from "../../game/camera";
import { useCompactUx } from "../useCompactUx";
import { useGameSettings } from "../../../settings/gameSettings";

type EventStep =
  | { type: "text"; npcName: string; text: string; portraitSrc?: string; portraitPokemonId?: string }
  | { type: "choices"; npcName: string; text: string; choices: string[]; portraitSrc?: string; portraitPokemonId?: string }
  | { type: "info"; npcName: string; text: string; portraitSrc?: string; portraitPokemonId?: string }
  | { type: "nameInput"; npcName: string; text: string; defaultName: string }
  | { type: "picture"; op: "show" | "move" | "erase"; slot: number; name?: string; origin?: number; x?: number; y?: number; opacity?: number; durationMs?: number }
  | { type: "sound"; kind: "SE" | "ME" | "BGM" | "BGS" | "BGMStop" | "BGSStop"; name?: string; volume?: number }
  | { type: "screen"; effect: "fadeout" | "fadein" | "tone" | "flash" | "shake"; durationMs?: number; darken?: number; power?: number }
  | { type: "camera"; op: "scroll"; direction: number; distanceTiles: number; durationMs: number }
  | { type: "animation"; animationId: number; name?: string; se?: string; targetCell?: { x: number; y: number } | null }
  | {
      type: "store";
      npcName: string;
      placementId: string;
      x: number;
      y: number;
      interactionDistanceSquares: number;
      items: Array<{ itemId: string; itemName: string; quantity: number; price: number }>;
    }
  | {
      type: "pcBox";
      npcName: string;
      placementId: string;
      x: number;
      y: number;
      interactionDistanceSquares: number;
    }
  | { type: "end" };

type BlockingStep = Extract<EventStep, { type: "text" | "choices" | "info" | "nameInput" }>;

type PictureState = {
  name: string;
  origin: number;
  x: number;
  y: number;
  opacity: number; // 0-255 like RMXP
  durationMs: number;
};

// RMXP virtual screen the Venova pictures were authored for.
const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 480;

// Screen Flash (224): a white overlay that decays over the flash duration.
const flashFade = keyframes`
  from { opacity: 0.9; }
  to { opacity: 0; }
`;

let pictureManifest: Record<string, string> | null = null;
let pictureManifestRequested = false;

function ensurePictureManifest() {
  if (pictureManifestRequested || typeof fetch === "undefined") {
    return;
  }
  pictureManifestRequested = true;
  fetch(assetUrl("/migration_exports/pictures/manifest.json"))
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      if (data && typeof data === "object") {
        pictureManifest = data as Record<string, string>;
      }
    })
    .catch(() => undefined);
}

function resolvePictureSrc(name: string): string {
  const file = pictureManifest?.[name.toLowerCase()] ?? `${name}.png`;
  return assetUrl(`/migration_exports/pictures/${encodeURIComponent(file)}`);
}

function resolvePokemonPortrait(pokemonId?: string): string | null {
  if (!pokemonId) {
    return null;
  }
  const item = readStoredDesignerSectionPayload("pokemons").state.items.find(
    (candidate) => candidate.id === pokemonId
  );
  const profile = (item as { pokemonProfile?: { frontImageSrc?: string } } | undefined)?.pokemonProfile;
  return profile?.frontImageSrc || null;
}

/**
 * Renders the server-authoritative RPG Maker event stream (imported from Venova):
 * one message box at a time with a Next affordance, Show Choices menus, name
 * entry, event pictures (the Chrisanta intro), sounds and screen fades. The
 * server owns all logic; this component displays steps and relays replies.
 */
export default function EventDialog() {
  const { socket, setActiveNpcInteraction, myplayer } = useContext(AppContext);
  const { user } = useAuth();
  const [step, setStep] = useState<BlockingStep | null>(null);
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [nameValue, setNameValue] = useState("");
  const [pictures, setPictures] = useState<Record<number, PictureState>>({});
  const [screenFx, setScreenFx] = useState<{ darken: number; durationMs: number }>({ darken: 0, durationMs: 400 });
  const [stageScale, setStageScale] = useState(1);
  // Cutscene camera (Scroll Map / Screen Shake): while the viewport is away
  // from the player the event stays "active" so movement input stays frozen.
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraPollRef = useRef<number | null>(null);
  // Screen Flash (224): keyed so consecutive flashes restart the animation.
  const [flash, setFlash] = useState<{ id: number; durationMs: number } | null>(null);
  // Show Animation (207) rendered as an emote bubble over the player (or the
  // event's cell for non-player targets).
  const [emote, setEmote] = useState<{ id: number; glyph: string; targetCell: { x: number; y: number } | null } | null>(null);
  const fxIdRef = useRef(0);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  // Touch screens (and short landscape viewports) get a smaller message box:
  // width-based breakpoints alone would pick the desktop sizes on a landscape
  // phone, where the full-size dialog covers most of the playfield.
  const compact = useCompactUx();
  const [gameSettings] = useGameSettings();
  const dialogScale = gameSettings.uiScale.dialogs;

  const playerName = user?.name || user?.username || "Player";
  const bodyFontSize = compact ? "sm" : { base: "lg", md: "2xl" };
  const nameFontSize = compact ? "xs" : { base: "sm", md: "md" };
  const choiceFontSize = compact ? "sm" : { base: "md", md: "lg" };
  const portraitSize = compact ? "72px" : { base: "108px", md: "148px" };
  const panelBorder = compact ? "3px solid #5d5a7b" : "4px solid #5d5a7b";
  const panelShadow = compact
    ? "0 5px 0 rgba(122, 215, 255, 0.75)"
    : "0 8px 0 rgba(122, 215, 255, 0.75)";

  useEffect(() => {
    ensurePictureManifest();
  }, []);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleStep = (payload: EventStep) => {
      if (!payload) {
        return;
      }
      // The camera stays "busy" (movement frozen, dialog layer mounted) until
      // pans/shakes finished AND the viewport is back on the player.
      const holdWhileCameraMoves = () => {
        setCameraBusy(true);
        if (cameraPollRef.current === null) {
          cameraPollRef.current = window.setInterval(() => {
            if (!cameraEffectsActive()) {
              if (cameraPollRef.current !== null) {
                window.clearInterval(cameraPollRef.current);
                cameraPollRef.current = null;
              }
              setCameraBusy(false);
            }
          }, 250);
        }
      };

      switch (payload.type) {
        case "end":
          setStep(null);
          setPictures({});
          setScreenFx({ darken: 0, durationMs: 400 });
          clearCameraEffects();
          if (cameraPollRef.current !== null) {
            window.clearInterval(cameraPollRef.current);
            cameraPollRef.current = null;
          }
          setCameraBusy(false);
          setEmote(null);
          setFlash(null);
          return;
        case "camera":
          if (payload.op === "scroll") {
            // RMXP numpad direction: 2 down, 4 left, 6 right, 8 up; 32px tiles.
            const distancePx = (payload.distanceTiles ?? 0) * 32;
            const dx = payload.direction === 4 ? -distancePx : payload.direction === 6 ? distancePx : 0;
            const dy = payload.direction === 8 ? -distancePx : payload.direction === 2 ? distancePx : 0;
            scrollCameraBy(dx, dy, payload.durationMs ?? 0);
            holdWhileCameraMoves();
          }
          return;
        case "animation": {
          if (payload.se) {
            gameAudio.playEffect(payload.se, "SE");
          }
          const animationName = (payload.name ?? "").toLowerCase();
          const glyph = animationName.includes("exclaim")
            ? "!"
            : animationName.includes("question")
            ? "?"
            : null;
          if (glyph) {
            fxIdRef.current += 1;
            setEmote({ id: fxIdRef.current, glyph, targetCell: payload.targetCell ?? null });
          }
          return;
        }
        case "picture":
          setPictures((current) => {
            const next = { ...current };
            if (payload.op === "erase") {
              delete next[payload.slot];
            } else if (payload.op === "show") {
              next[payload.slot] = {
                name: payload.name ?? "",
                origin: payload.origin ?? 0,
                x: payload.x ?? 0,
                y: payload.y ?? 0,
                opacity: payload.opacity ?? 255,
                durationMs: 0
              };
            } else {
              const existing = next[payload.slot];
              if (existing) {
                next[payload.slot] = {
                  ...existing,
                  origin: payload.origin ?? existing.origin,
                  x: payload.x ?? existing.x,
                  y: payload.y ?? existing.y,
                  opacity: payload.opacity ?? existing.opacity,
                  durationMs: payload.durationMs ?? 0
                };
              }
            }
            return next;
          });
          return;
        case "sound":
          if (payload.kind === "BGM" && payload.name) {
            gameAudio.playBgm(payload.name);
          } else if (payload.kind === "BGMStop") {
            gameAudio.stopBgm();
          } else if ((payload.kind === "SE" || payload.kind === "ME") && payload.name) {
            gameAudio.playEffect(payload.name, payload.kind, payload.volume);
          }
          // BGS ambience is not supported yet; ignore quietly.
          return;
        case "screen":
          if (payload.effect === "shake") {
            // RMXP power 1-9 → pixel amplitude; the classic earthquake (9) is
            // a hard ~18px rattle.
            shakeCamera((payload.power ?? 5) * 2, payload.durationMs ?? 400);
            holdWhileCameraMoves();
            return;
          }
          if (payload.effect === "flash") {
            fxIdRef.current += 1;
            setFlash({ id: fxIdRef.current, durationMs: payload.durationMs ?? 200 });
            return;
          }
          setScreenFx({
            darken: payload.effect === "fadeout" ? 1 : payload.effect === "fadein" ? 0 : payload.darken ?? 0,
            durationMs: payload.durationMs ?? 400
          });
          return;
        case "nameInput":
          setNameValue(payload.defaultName ?? "");
          setStep(payload);
          return;
        case "store":
          // pbPokemonMart: hand off to the regular store overlay (the same UI
          // designer store NPCs use). The event keeps running to its end; the
          // overlay outlives it and buys/sells through npc:store-buy/sell,
          // which the server validates against its mart session.
          setActiveNpcInteraction({
            id: payload.placementId,
            npcId: "",
            name: payload.npcName,
            category: "",
            previewImageSrc: "",
            npcType: "store",
            aiType: "standing",
            // Real clerk cell + range: Map.tsx closes the overlay when the
            // player walks out of interaction range of this spot.
            interactionDistanceSquares: payload.interactionDistanceSquares,
            x: payload.x,
            y: payload.y,
            storeItems: payload.items,
          });
          return;
        case "pcBox":
          // pbPokeCenterPC / pbTrainerPC: open the PC box storage overlay via
          // the same synthetic-placement mechanism marts use, so proximity
          // auto-close and movement suppression come for free.
          setActiveNpcInteraction({
            id: payload.placementId,
            npcId: "",
            name: payload.npcName,
            category: "",
            previewImageSrc: "",
            npcType: "pc",
            aiType: "standing",
            interactionDistanceSquares: payload.interactionDistanceSquares,
            x: payload.x,
            y: payload.y,
          });
          return;
        default:
          setChoiceIndex(0);
          setStep(payload);
      }
    };

    socket.on("event:step", handleStep);
    return () => {
      socket.off("event:step", handleStep);
      if (cameraPollRef.current !== null) {
        window.clearInterval(cameraPollRef.current);
        cameraPollRef.current = null;
      }
      clearCameraEffects();
    };
  }, [socket]);

  // Emote bubbles ("!"/"?") and flashes are one-shots that clear themselves.
  useEffect(() => {
    if (!emote) {
      return;
    }
    const timer = window.setTimeout(() => setEmote(null), 1400);
    return () => window.clearTimeout(timer);
  }, [emote]);

  useEffect(() => {
    if (!flash) {
      return;
    }
    const timer = window.setTimeout(() => setFlash(null), flash.durationMs + 100);
    return () => window.clearTimeout(timer);
  }, [flash]);

  // Keep the 640x480 picture stage fitted to the viewport.
  useEffect(() => {
    const updateScale = () => {
      setStageScale(Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  useEffect(() => {
    if (step?.type === "nameInput") {
      window.setTimeout(() => nameInputRef.current?.focus(), 50);
    }
  }, [step]);

  const choices = step?.type === "choices" ? step.choices : [];

  const advance = useMemo(
    () => () => {
      if (!socket || !step) {
        return;
      }
      if (step.type === "choices") {
        socket.emit("event:choice", { index: choiceIndex });
      } else if (step.type === "nameInput") {
        socket.emit("event:advance", { text: nameValue });
      } else {
        socket.emit("event:advance");
      }
    },
    [socket, step, choiceIndex, nameValue]
  );

  useEffect(() => {
    if (!step) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (step.type === "choices" && choices.length > 0) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          setChoiceIndex((index) => (index - 1 + choices.length) % choices.length);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          setChoiceIndex((index) => (index + 1) % choices.length);
          return;
        }
      }

      if (event.key === "Enter" || event.key === " " || event.key === "Spacebar") {
        event.preventDefault();
        advance();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [step, choices.length, advance]);

  // Freeze player movement/clicks while an event is on screen (UserControl reads
  // this flag) — including picture-only intro segments between text boxes.
  const hasPictures = Object.keys(pictures).length > 0;
  const eventActive =
    Boolean(step) || hasPictures || screenFx.darken > 0 || cameraBusy || Boolean(emote) || Boolean(flash);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    if (eventActive) {
      document.body.dataset.eventActive = "1";
    } else {
      delete document.body.dataset.eventActive;
    }
    return () => {
      delete document.body.dataset.eventActive;
    };
  }, [eventActive]);

  if (!eventActive || typeof document === "undefined") {
    return null;
  }

  const bodyText = step && step.type !== "nameInput" ? cleanRmxpText(step.text ?? "", playerName) : "";
  const pokemonPortrait = step && step.type !== "nameInput" ? resolvePokemonPortrait(step.portraitPokemonId) : null;
  const portraitSrc = resolveServerAssetUrl(
    pokemonPortrait || (step && step.type !== "nameInput" ? step.portraitSrc : null) || ""
  ) || null;
  const portraitIsPokemon = Boolean(pokemonPortrait);
  const stageLeft = (typeof window !== "undefined" ? window.innerWidth : STAGE_WIDTH) / 2;
  // Show Animation emote host: the player's own sprite element, or the map
  // surface for animations targeted at the event's cell.
  const emoteHost = emote
    ? emote.targetCell
      ? document.getElementById("map")
      : document.getElementById(myplayer)
    : null;

  return createPortal(
    <>
      {/* Screen tone / fade layer (below pictures and dialog). */}
      <Box
        position="fixed"
        inset={0}
        zIndex={4280}
        pointerEvents="none"
        bg="black"
        opacity={screenFx.darken}
        transition={`opacity ${Math.max(50, screenFx.durationMs)}ms linear`}
      />

      {/* Screen Flash (224). */}
      {flash ? (
        <Box
          key={flash.id}
          position="fixed"
          inset={0}
          zIndex={4285}
          pointerEvents="none"
          bg="white"
          animation={`${flashFade} ${Math.max(50, flash.durationMs)}ms linear forwards`}
        />
      ) : null}

      {/* Show Animation (207) emote bubble over the player / event cell. */}
      {emote && emoteHost
        ? createPortal(
            <Box
              key={emote.id}
              position="absolute"
              {...(emote.targetCell
                ? {
                    left: `${emote.targetCell.x * 32 + 16}px`,
                    top: `${emote.targetCell.y * 32 - 34}px`
                  }
                : { left: "50%", top: "-34px" })}
              transform="translateX(-50%)"
              zIndex={40}
              pointerEvents="none"
              bg="white"
              border="2px solid #2b2b3d"
              borderRadius="6px"
              px="6px"
              fontFamily="monospace"
              fontWeight="bold"
              fontSize="20px"
              lineHeight="26px"
              color="#2b2b3d"
              boxShadow="0 2px 0 rgba(0,0,0,0.35)"
            >
              {emote.glyph}
            </Box>,
            emoteHost
          )
        : null}

      {/* RMXP picture stage: 640x480 design space scaled to the viewport. */}
      {hasPictures ? (
        <Box position="fixed" inset={0} zIndex={4290} pointerEvents="none" overflow="hidden">
          <Box
            position="absolute"
            left={`${stageLeft}px`}
            top="50%"
            width={`${STAGE_WIDTH}px`}
            height={`${STAGE_HEIGHT}px`}
            transform={`translate(-50%, -50%) scale(${stageScale})`}
          >
            {Object.entries(pictures).map(([slot, picture]) =>
              picture.name ? (
                <img
                  key={slot}
                  src={resolvePictureSrc(picture.name)}
                  alt=""
                  style={{
                    position: "absolute",
                    left: `${picture.x}px`,
                    top: `${picture.y}px`,
                    transform: picture.origin === 1 ? "translate(-50%, -50%)" : undefined,
                    opacity: picture.opacity / 255,
                    transition: picture.durationMs > 0 ? `all ${picture.durationMs}ms linear` : undefined,
                    imageRendering: "pixelated",
                    maxWidth: "none"
                  }}
                />
              ) : null
            )}
          </Box>
        </Box>
      ) : null}

      {step ? (
        <Flex
          position="fixed"
          inset={0}
          zIndex={4300}
          pointerEvents="none"
          direction="column"
          justify="flex-end"
          px={compact ? 2 : { base: 3, md: 6 }}
          py={compact ? 2 : { base: 3, md: 5 }}
          gap={compact ? 2 : 3}
          maxH="100dvh"
          // Settings -> Display -> NPC dialog size. zoom keeps the overlay
          // anchored to the viewport while scaling the dialog chrome.
          style={{ zoom: dialogScale } as CSSProperties}
        >
          {/* Portrait (left) and the choice menu (top-right) float above the text box
              so a Yes/No question keeps its text on screen while you answer. */}
          <Flex justify="space-between" align="flex-end" gap={3} width="100%">
            {portraitSrc ? (
              <Box
                data-game-ux="true"
                pointerEvents="auto"
                bg="#f7f4eb"
                border={panelBorder}
                boxShadow={panelShadow}
                p={compact ? 1 : 2}
                width={portraitSize}
                height={portraitSize}
                display="flex"
                alignItems="center"
                justifyContent="center"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
              >
                <img
                  src={portraitSrc}
                  alt={step.npcName || "portrait"}
                  style={{
                    maxWidth: "100%",
                    maxHeight: "100%",
                    objectFit: "contain",
                    imageRendering: portraitIsPokemon ? "auto" : "pixelated"
                  }}
                />
              </Box>
            ) : (
              <Box />
            )}

            {step.type === "choices" && choices.length > 0 ? (
              <Box
                data-game-ux="true"
                pointerEvents="auto"
                bg="#f7f4eb"
                border={panelBorder}
                boxShadow={panelShadow}
                px={compact ? 2 : 3}
                py={compact ? 1 : 2}
                minW="120px"
                onClick={(clickEvent) => clickEvent.stopPropagation()}
              >
                <VStack align="stretch" spacing={1}>
                  {choices.map((choice, index) => (
                    <Flex
                      key={`${choice}-${index}`}
                      align="center"
                      gap={2}
                      px={2}
                      py={compact ? 2 : 1}
                      cursor="pointer"
                      bg={index === choiceIndex ? "#fff3cf" : "transparent"}
                      onMouseEnter={() => setChoiceIndex(index)}
                      onClick={() => socket?.emit("event:choice", { index })}
                    >
                      <Text
                        fontFamily="mono"
                        fontWeight="800"
                        color="#ff7b73"
                        fontSize={choiceFontSize}
                        visibility={index === choiceIndex ? "visible" : "hidden"}
                      >
                        ▶
                      </Text>
                      <Text
                        fontFamily="mono"
                        fontWeight="800"
                        color="#404040"
                        fontSize={choiceFontSize}
                      >
                        {cleanRmxpText(choice, playerName)}
                      </Text>
                    </Flex>
                  ))}
                </VStack>
              </Box>
            ) : (
              <Box />
            )}
          </Flex>

          <Box
            data-game-ux="true"
            pointerEvents="auto"
            bg="#f7f4eb"
            border={panelBorder}
            boxShadow={panelShadow}
            px={compact ? 3 : 4}
            py={compact ? 2 : 4}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              if (step.type !== "choices" && step.type !== "nameInput") {
                advance();
              }
            }}
            cursor={step.type === "choices" || step.type === "nameInput" ? "default" : "pointer"}
          >
            {step.npcName ? (
              <Text
                display="inline-block"
                px={2}
                py={1}
                mb={compact ? 1 : 2}
                bg="#1f1f1f"
                color="#ffef69"
                fontFamily="mono"
                fontWeight="800"
                fontSize={nameFontSize}
                textTransform="uppercase"
              >
                {step.npcName}
              </Text>
            ) : null}

            {step.type === "nameInput" ? (
              <>
                <Text
                  fontFamily="mono"
                  fontWeight="800"
                  fontSize={bodyFontSize}
                  color="#5a5a5a"
                  lineHeight="1.35"
                  mb={compact ? 2 : 3}
                >
                  {cleanRmxpText(step.text ?? "", playerName)}
                </Text>
                <Flex gap={2}>
                  <Input
                    ref={nameInputRef}
                    value={nameValue}
                    maxLength={30}
                    fontFamily="mono"
                    fontWeight="800"
                    bg="white"
                    color="#1f2937"
                    borderColor="#5d5a7b"
                    onChange={(changeEvent) => setNameValue(changeEvent.target.value)}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Enter") {
                        keyEvent.preventDefault();
                        advance();
                      }
                    }}
                  />
                  <Button
                    fontFamily="mono"
                    fontWeight="800"
                    bg="#ffd76e"
                    color="#4a4964"
                    border="3px solid #5d5a7b"
                    borderRadius={0}
                    _hover={{ bg: "#ffe79b" }}
                    onClick={advance}
                  >
                    OK
                  </Button>
                </Flex>
              </>
            ) : (
              <>
                {bodyText ? (
                  <Text
                    fontFamily="mono"
                    fontWeight="800"
                    fontSize={bodyFontSize}
                    color="#5a5a5a"
                    lineHeight="1.35"
                    whiteSpace="pre-wrap"
                  >
                    {bodyText}
                  </Text>
                ) : null}

                {step.type !== "choices" ? (
                  <Flex justify="flex-end" mt={compact ? 1 : 2}>
                    <Text fontFamily="mono" fontWeight="800" color="#8a89a8" fontSize={compact ? "sm" : "lg"}>
                      ▶
                    </Text>
                  </Flex>
                ) : null}
              </>
            )}
          </Box>
        </Flex>
      ) : null}
    </>,
    document.body
  );
}
