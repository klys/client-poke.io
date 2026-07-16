import { Box, Button, Flex, Input, Text, VStack } from "@chakra-ui/react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AppContext } from "../../../context/appContext";
import { useAuth } from "../../../context/authContext";
import { readStoredDesignerSectionPayload } from "../../designer/designerCache";
import { assetUrl, resolveServerAssetUrl } from "../../tilemap/serverAssets";
import { cleanRmxpText } from "./NpcInteractions";
import { gameAudio } from "./gameAudio";
import { useCompactUx } from "../useCompactUx";

type EventStep =
  | { type: "text"; npcName: string; text: string; portraitSrc?: string; portraitPokemonId?: string }
  | { type: "choices"; npcName: string; text: string; choices: string[]; portraitSrc?: string; portraitPokemonId?: string }
  | { type: "info"; npcName: string; text: string; portraitSrc?: string; portraitPokemonId?: string }
  | { type: "nameInput"; npcName: string; text: string; defaultName: string }
  | { type: "picture"; op: "show" | "move" | "erase"; slot: number; name?: string; origin?: number; x?: number; y?: number; opacity?: number; durationMs?: number }
  | { type: "sound"; kind: "SE" | "ME" | "BGM" | "BGS" | "BGMStop" | "BGSStop"; name?: string; volume?: number }
  | { type: "screen"; effect: "fadeout" | "fadein" | "tone"; durationMs?: number; darken?: number }
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
  const { socket } = useContext(AppContext);
  const { user } = useAuth();
  const [step, setStep] = useState<BlockingStep | null>(null);
  const [choiceIndex, setChoiceIndex] = useState(0);
  const [nameValue, setNameValue] = useState("");
  const [pictures, setPictures] = useState<Record<number, PictureState>>({});
  const [screenFx, setScreenFx] = useState<{ darken: number; durationMs: number }>({ darken: 0, durationMs: 400 });
  const [stageScale, setStageScale] = useState(1);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  // Touch screens (and short landscape viewports) get a smaller message box:
  // width-based breakpoints alone would pick the desktop sizes on a landscape
  // phone, where the full-size dialog covers most of the playfield.
  const compact = useCompactUx();

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
      switch (payload.type) {
        case "end":
          setStep(null);
          setPictures({});
          setScreenFx({ darken: 0, durationMs: 400 });
          return;
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
          setScreenFx({
            darken: payload.effect === "fadeout" ? 1 : payload.effect === "fadein" ? 0 : payload.darken ?? 0,
            durationMs: payload.durationMs ?? 400
          });
          return;
        case "nameInput":
          setNameValue(payload.defaultName ?? "");
          setStep(payload);
          return;
        default:
          setChoiceIndex(0);
          setStep(payload);
      }
    };

    socket.on("event:step", handleStep);
    return () => {
      socket.off("event:step", handleStep);
    };
  }, [socket]);

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
  const eventActive = Boolean(step) || hasPictures || screenFx.darken > 0;

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
