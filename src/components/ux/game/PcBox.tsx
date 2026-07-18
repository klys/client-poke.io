import { Box, Button, Flex, HStack, SimpleGrid, Text, VStack } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail,
} from "../../designer/designerCache";
import type { MapEditorNpcPlacement } from "../../designer/PlayableMapEditorCanvas";
import { useAuth, type PokemonSummary, type PokemonStorageBox } from "../../../context/authContext";
import { resolveServerAssetUrl } from "../../tilemap/serverAssets";
import { getPokemonDisplayName } from "./pokemonName";
import { useCompactUx } from "../useCompactUx";
import { useGameSettings } from "../../../settings/gameSettings";
import { MenuChoiceButton, RetroPanel } from "./NpcInteractions";

const MAX_PARTY_SIZE = 6;
const FALLBACK_BOX: PokemonStorageBox = { id: "box-1", name: "Box 1", capacity: 30, pokemon: [] };

type StorageSelection =
  | { source: "party"; pokemonId: string }
  | { source: "box"; pokemonId: string };

function readPokemonIconIndex() {
  const index = new Map<string, string>();

  readStoredDesignerSectionPayload("pokemons").state.items.forEach((item) => {
    const profile = (item as { pokemonProfile?: { iconImageSrc?: string } }).pokemonProfile;
    if (item.id && profile?.iconImageSrc) {
      index.set(item.id, profile.iconImageSrc);
    }
  });

  return index;
}

function PokemonSlotIcon({
  pokemon,
  iconIndex,
  size,
}: {
  pokemon: PokemonSummary;
  iconIndex: Map<string, string>;
  size: string;
}) {
  const iconSrc = resolveServerAssetUrl(
    iconIndex.get(pokemon.sourcePokemonId ?? "") ?? iconIndex.get(pokemon.id) ?? ""
  );

  if (!iconSrc) {
    return (
      <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#4a4964">
        {(pokemon.nickname || pokemon.name).slice(0, 2).toUpperCase()}
      </Text>
    );
  }

  return (
    <img
      src={iconSrc}
      alt={getPokemonDisplayName(pokemon)}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * The PC box storage overlay (pbPokeCenterPC / pbTrainerPC computers): party on
 * the left, the current storage box on the right. Click a Venomon on either
 * side, then Deposit/Withdraw. The server owns all rules (box capacity, party
 * limits, auto-creating new boxes) and re-emits the fresh user after each move.
 */
export default function PcBoxOverlay({
  npcPlacement,
  onClose,
}: {
  npcPlacement: MapEditorNpcPlacement;
  onClose: () => void;
}) {
  const {
    user,
    errorMessage,
    infoMessage,
    depositPokemonToBox,
    withdrawPokemonFromBox,
  } = useAuth();
  const compact = useCompactUx();
  const [gameSettings] = useGameSettings();
  const [boxIndex, setBoxIndex] = useState(0);
  const [selection, setSelection] = useState<StorageSelection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [iconIndex, setIconIndex] = useState<Map<string, string>>(() => readPokemonIconIndex());

  useEffect(() => {
    const handleDesignerCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;

      if (detail?.sectionKey === "pokemons") {
        setIconIndex(readPokemonIconIndex());
      }
    };

    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);

    return () => {
      window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);
    };
  }, []);

  const party = useMemo(() => user?.pokemonParty ?? [], [user?.pokemonParty]);
  const boxes = useMemo<PokemonStorageBox[]>(
    () => (user?.pokemonStorage?.length ? user.pokemonStorage : [FALLBACK_BOX]),
    [user?.pokemonStorage]
  );
  const activeBox = boxes[Math.min(boxIndex, boxes.length - 1)];

  useEffect(() => {
    if (boxIndex > boxes.length - 1) {
      setBoxIndex(boxes.length - 1);
    }
  }, [boxIndex, boxes.length]);

  // A server response (fresh user or an error toast) ends the pending move.
  useEffect(() => {
    setIsSubmitting(false);
  }, [user, errorMessage, infoMessage]);

  // Drop selections that no longer point at a real Venomon (it just moved).
  useEffect(() => {
    if (!selection) {
      return;
    }

    const stillExists =
      selection.source === "party"
        ? party.some((pokemon) => pokemon.id === selection.pokemonId)
        : boxes.some((box) => box.pokemon.some((pokemon) => pokemon.id === selection.pokemonId));

    if (!stillExists) {
      setSelection(null);
    }
  }, [boxes, party, selection]);

  const selectedPartyPokemon =
    selection?.source === "party"
      ? party.find((pokemon) => pokemon.id === selection.pokemonId) ?? null
      : null;
  const selectedBoxPokemon =
    selection?.source === "box"
      ? activeBox.pokemon.find((pokemon) => pokemon.id === selection.pokemonId) ??
        boxes.flatMap((box) => box.pokemon).find((pokemon) => pokemon.id === selection.pokemonId) ??
        null
      : null;

  const partyFull = party.length >= MAX_PARTY_SIZE;
  const boxFull = activeBox.pokemon.length >= activeBox.capacity;

  const handleDeposit = () => {
    if (!selectedPartyPokemon || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    depositPokemonToBox({ pokemonId: selectedPartyPokemon.id, boxId: activeBox.id });
  };

  const handleWithdraw = () => {
    if (!selectedBoxPokemon || isSubmitting) {
      return;
    }

    const owningBox =
      boxes.find((box) => box.pokemon.some((pokemon) => pokemon.id === selectedBoxPokemon.id)) ??
      activeBox;

    setIsSubmitting(true);
    withdrawPokemonFromBox({ pokemonId: selectedBoxPokemon.id, boxId: owningBox.id });
  };

  let dialogueText = "Select a Venomon to deposit or withdraw.";
  if (isSubmitting) {
    dialogueText = "Working...";
  } else if (selectedPartyPokemon) {
    dialogueText =
      party.length <= 1
        ? "You must keep at least one Venomon with you."
        : boxFull
          ? `${activeBox.name} is full. A new box will open once every box is full.`
          : `Deposit ${getPokemonDisplayName(selectedPartyPokemon)} into ${activeBox.name}?`;
  } else if (selectedBoxPokemon) {
    dialogueText = partyFull
      ? "Your party is full. Deposit someone first."
      : `Withdraw ${getPokemonDisplayName(selectedBoxPokemon)} into your party?`;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const slotSize = compact ? "40px" : "52px";
  const boxColumns = compact ? 5 : 6;
  const boxSlots = Array.from({ length: activeBox.capacity }, (_, index) =>
    activeBox.pokemon[index] ?? null
  );

  // Portal to <body> for the same reason as NpcInteractionOverlay: escape the
  // camera-world CSS transform so position:fixed anchors to the viewport.
  return createPortal(
    <Flex
      position="fixed"
      inset={0}
      zIndex={4200}
      pointerEvents="none"
      align={compact ? "flex-end" : "center"}
      justify="center"
      px={compact ? 2 : 4}
      py={compact ? 2 : 4}
      maxH="100dvh"
      overflowY="auto"
      style={{ zoom: gameSettings.uiScale.dialogs } as CSSProperties}
    >
      <Box pointerEvents="auto" width={compact ? "100%" : "min(96vw, 920px)"}>
        <RetroPanel maxWidth="100%">
          <VStack align="stretch" spacing={compact ? 2 : 3}>
            <HStack justify="space-between" align="center" spacing={3} flexWrap="wrap">
              <Text
                display="inline-block"
                px={2}
                py={1}
                bg="#1f1f1f"
                color="#ffef69"
                fontFamily="mono"
                fontWeight="800"
                fontSize={compact ? "xs" : { base: "sm", md: "md" }}
                textTransform="uppercase"
              >
                Venomon Storage
              </Text>
              <HStack spacing={2}>
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="#5d5a7b"
                  color="#4a4964"
                  isDisabled={boxIndex <= 0}
                  onClick={() => {
                    setBoxIndex((index) => Math.max(0, index - 1));
                    setSelection((current) => (current?.source === "box" ? null : current));
                  }}
                >
                  ◀
                </Button>
                <Text
                  fontFamily="mono"
                  fontWeight="800"
                  fontSize={compact ? "xs" : "sm"}
                  color="#4a4964"
                  textTransform="uppercase"
                  whiteSpace="nowrap"
                >
                  {activeBox.name} ({activeBox.pokemon.length}/{activeBox.capacity})
                </Text>
                <Button
                  size="sm"
                  variant="outline"
                  borderColor="#5d5a7b"
                  color="#4a4964"
                  isDisabled={boxIndex >= boxes.length - 1}
                  onClick={() => {
                    setBoxIndex((index) => Math.min(boxes.length - 1, index + 1));
                    setSelection((current) => (current?.source === "box" ? null : current));
                  }}
                >
                  ▶
                </Button>
              </HStack>
              <Button size="sm" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={onClose}>
                Close
              </Button>
            </HStack>

            <Flex gap={compact ? 2 : 4} direction={compact ? "column" : "row"} align="stretch">
              <Box minW={compact ? undefined : "240px"} maxW={compact ? undefined : "280px"} flexShrink={0}>
                <Text
                  fontFamily="mono"
                  fontWeight="800"
                  fontSize={compact ? "xs" : "sm"}
                  textTransform="uppercase"
                  color="#4a4964"
                  mb={2}
                >
                  Party ({party.length}/{MAX_PARTY_SIZE})
                </Text>
                <VStack align="stretch" spacing={2} maxH={compact ? "160px" : "340px"} overflowY="auto">
                  {party.map((pokemon) => (
                    <MenuChoiceButton
                      key={pokemon.id}
                      active={selection?.source === "party" && selection.pokemonId === pokemon.id}
                      onClick={() => setSelection({ source: "party", pokemonId: pokemon.id })}
                    >
                      <Flex width="100%" align="center" gap={2}>
                        <Box
                          width="28px"
                          height="28px"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          flexShrink={0}
                        >
                          <PokemonSlotIcon pokemon={pokemon} iconIndex={iconIndex} size="28px" />
                        </Box>
                        <Text noOfLines={1} flex="1" textAlign="left">
                          {getPokemonDisplayName(pokemon)}
                        </Text>
                        <Text color="#7a4b20" whiteSpace="nowrap" fontSize={compact ? "xs" : "sm"}>
                          Lv {pokemon.level}
                        </Text>
                      </Flex>
                    </MenuChoiceButton>
                  ))}
                  {party.length === 0 ? (
                    <Text fontFamily="mono" fontSize="sm" color="#8a89a8">
                      Your party is empty.
                    </Text>
                  ) : null}
                </VStack>
              </Box>

              <Box flex="1" minW={0}>
                <SimpleGrid columns={boxColumns} spacing={compact ? 1 : 2}>
                  {boxSlots.map((pokemon, index) => {
                    const isSelected =
                      Boolean(pokemon) &&
                      selection?.source === "box" &&
                      selection.pokemonId === pokemon!.id;

                    return (
                      <Box
                        key={pokemon ? pokemon.id : `empty-${index}`}
                        as="button"
                        height={slotSize}
                        border="3px solid"
                        borderColor={isSelected ? "#ff7b73" : "#8a89a8"}
                        bg={pokemon ? (isSelected ? "#fff3cf" : "#ffffff") : "#e8e5da"}
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        cursor={pokemon ? "pointer" : "default"}
                        title={
                          pokemon
                            ? `${getPokemonDisplayName(pokemon)} Lv ${pokemon.level}`
                            : "Empty slot"
                        }
                        onClick={() =>
                          pokemon
                            ? setSelection({ source: "box", pokemonId: pokemon.id })
                            : setSelection(null)
                        }
                      >
                        {pokemon ? (
                          <PokemonSlotIcon
                            pokemon={pokemon}
                            iconIndex={iconIndex}
                            size={compact ? "30px" : "40px"}
                          />
                        ) : null}
                      </Box>
                    );
                  })}
                </SimpleGrid>
              </Box>
            </Flex>

            <Flex
              gap={3}
              align="center"
              justify="space-between"
              flexWrap="wrap"
              borderTop="3px solid #8a89a8"
              pt={compact ? 2 : 3}
            >
              <Text
                fontFamily="mono"
                fontWeight="800"
                fontSize={compact ? "sm" : { base: "md", md: "lg" }}
                color="#5a5a5a"
                lineHeight="1.35"
                flex="1"
                minW="200px"
              >
                {dialogueText}
              </Text>
              <HStack spacing={3}>
                <Button
                  colorScheme="green"
                  isDisabled={
                    !selectedPartyPokemon || isSubmitting || party.length <= 1 || boxFull
                  }
                  onClick={handleDeposit}
                >
                  Deposit
                </Button>
                <Button
                  colorScheme="orange"
                  isDisabled={!selectedBoxPokemon || isSubmitting || partyFull}
                  onClick={handleWithdraw}
                >
                  Withdraw
                </Button>
              </HStack>
            </Flex>
          </VStack>
        </RetroPanel>
      </Box>
    </Flex>,
    document.body
  );
}
