import {
  Box,
  Button,
  Flex,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail,
} from "../../designer/designerCache";
import type { MapEditorNpcPlacement } from "../../designer/PlayableMapEditorCanvas";
import type { DesignerItemSeed, DesignerNpcType } from "../../designer/designerSections";
import { useAuth, type InventoryItem } from "../../../context/authContext";

type RuntimeNpcStoreItem = {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
};

type RuntimeNpcDefinition = {
  id: string;
  name: string;
  npcType: DesignerNpcType;
  healPrice: number;
  storeItems: RuntimeNpcStoreItem[];
};

type StoreMode = "storeMain" | "storeBuy" | "storeSell";
type InteractionMode = "healer" | StoreMode;

type SellableStoreItem = {
  inventoryItem: InventoryItem;
  storeItem: RuntimeNpcStoreItem;
  sellPrice: number;
};

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

function normalizeMoney(value: number) {
  return `$${Math.max(0, Math.round(value))}`;
}

function sanitizeStoreItems(value: unknown): RuntimeNpcStoreItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenIds = new Set<string>();

  return value
    .filter((item): item is Partial<RuntimeNpcStoreItem> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      itemId: typeof item.itemId === "string" ? item.itemId.trim() : "",
      itemName: typeof item.itemName === "string" ? item.itemName.trim() : "",
      quantity:
        typeof item.quantity === "number" && Number.isFinite(item.quantity) && item.quantity > 0
          ? Math.max(1, Math.round(item.quantity))
          : 1,
      price:
        typeof item.price === "number" && Number.isFinite(item.price) && item.price >= 0
          ? Math.max(0, Math.round(item.price))
          : 0,
    }))
    .filter((item) => {
      if (!item.itemId || !item.itemName || seenIds.has(item.itemId)) {
        return false;
      }

      seenIds.add(item.itemId);
      return true;
    });
}

function normalizeNpcDefinition(item: DesignerItemSeed): RuntimeNpcDefinition | null {
  const profile =
    item.npcProfile && typeof item.npcProfile === "object"
      ? (item.npcProfile as {
          npcType?: unknown;
          healPrice?: unknown;
          storeItems?: unknown;
        })
      : null;

  const npcType = profile?.npcType;

  if (
    npcType !== "healer" &&
    npcType !== "trainer" &&
    npcType !== "store" &&
    npcType !== "chest"
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    npcType,
    healPrice:
      typeof profile?.healPrice === "number" &&
      Number.isFinite(profile.healPrice) &&
      profile.healPrice >= 0
        ? Math.round(profile.healPrice)
        : 0,
    storeItems: sanitizeStoreItems(profile?.storeItems),
  };
}

function loadNpcCatalogById() {
  const catalog = new Map<string, RuntimeNpcDefinition>();

  readStoredDesignerSectionPayload("npcs").state.items
    .map(normalizeNpcDefinition)
    .forEach((item) => {
      if (item) {
        catalog.set(item.id, item);
      }
    });

  return catalog;
}

function getInitialMode(npcType: DesignerNpcType): InteractionMode {
  if (npcType === "store") {
    return "storeMain";
  }

  return "healer";
}

function getStoreSellPrice(storeItem: RuntimeNpcStoreItem) {
  const perUnitBuyPrice = Math.floor(storeItem.price / Math.max(1, storeItem.quantity));
  return Math.max(0, Math.floor(perUnitBuyPrice / 2));
}

function RetroPanel({
  children,
  minWidth,
  maxWidth,
}: {
  children: ReactNode;
  minWidth?: string | number;
  maxWidth?: string | number;
}) {
  return (
    <Box
      data-game-ux="true"
      bg="#f7f4eb"
      border="4px solid #5d5a7b"
      boxShadow="0 8px 0 rgba(122, 215, 255, 0.75)"
      px={3}
      py={3}
      minW={minWidth}
      maxW={maxWidth}
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
    >
      {children}
    </Box>
  );
}

function MenuChoiceButton({
  active,
  children,
  onClick,
  isDisabled,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  isDisabled?: boolean;
}) {
  return (
    <Button
      justifyContent="flex-start"
      variant="unstyled"
      width="100%"
      minH="38px"
      px={3}
      py={2}
      border="3px solid"
      borderColor={active ? "#ff7b73" : "#8a89a8"}
      bg={active ? "#fff3cf" : "#ffffff"}
      color="#404040"
      fontFamily="mono"
      fontSize={{ base: "md", md: "lg" }}
      fontWeight="800"
      textTransform="uppercase"
      lineHeight="1.1"
      opacity={isDisabled ? 0.45 : 1}
      cursor={isDisabled ? "not-allowed" : "pointer"}
      onClick={isDisabled ? undefined : onClick}
    >
      {children}
    </Button>
  );
}

function StoreSelectionList({
  title,
  rows,
  selectedId,
  onSelect,
}: {
  title: string;
  rows: Array<{ id: string; label: string; detail: string; disabled?: boolean }>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <RetroPanel minWidth="280px" maxWidth="360px">
      <Text
        fontFamily="mono"
        fontWeight="800"
        fontSize={{ base: "sm", md: "md" }}
        textTransform="uppercase"
        color="#4a4964"
        mb={3}
      >
        {title}
      </Text>
      <VStack align="stretch" spacing={2} maxH="300px" overflowY="auto">
        {rows.map((row) => (
          <MenuChoiceButton
            key={row.id}
            active={row.id === selectedId}
            isDisabled={row.disabled}
            onClick={() => onSelect(row.id)}
          >
            <Flex width="100%" justify="space-between" gap={3}>
              <Text noOfLines={1}>{row.label}</Text>
              <Text color="#7a4b20" noOfLines={1}>
                {row.detail}
              </Text>
            </Flex>
          </MenuChoiceButton>
        ))}
      </VStack>
    </RetroPanel>
  );
}

export function NpcInteractionOverlay({
  npcPlacement,
  onClose,
}: {
  npcPlacement: MapEditorNpcPlacement | null;
  onClose: () => void;
}) {
  const {
    user,
    errorMessage,
    infoMessage,
    healNpcParty,
    buyFromNpcStore,
    sellToNpcStore,
  } = useAuth();
  const [npcCatalogById, setNpcCatalogById] = useState<Map<string, RuntimeNpcDefinition>>(
    () => loadNpcCatalogById()
  );
  const [mode, setMode] = useState<InteractionMode>("healer");
  const [selectedStoreItemId, setSelectedStoreItemId] = useState<string | null>(null);
  const [selectedSellItemId, setSelectedSellItemId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleDesignerCacheUpdate = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;

      if (detail?.sectionKey === "npcs") {
        setNpcCatalogById(loadNpcCatalogById());
      }
    };

    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);

    return () => {
      window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handleDesignerCacheUpdate);
    };
  }, []);

  const npcDefinition = useMemo(
    () => (npcPlacement ? npcCatalogById.get(npcPlacement.npcId) ?? null : null),
    [npcCatalogById, npcPlacement]
  );
  const effectiveNpcType = npcDefinition?.npcType ?? npcPlacement?.npcType ?? "healer";
  const storeItems = useMemo(() => npcDefinition?.storeItems ?? [], [npcDefinition]);

  const sellableItems = useMemo<SellableStoreItem[]>(() => {
    if (effectiveNpcType !== "store") {
      return [];
    }

    const inventory = user?.inventory ?? [];

    return inventory
      .map((inventoryItem) => {
        const matchingStoreItem = storeItems.find((storeItem) => storeItem.itemId === inventoryItem.id);

        if (!matchingStoreItem) {
          return null;
        }

        const sellPrice = getStoreSellPrice(matchingStoreItem);

        if (sellPrice <= 0 || inventoryItem.quantity <= 0) {
          return null;
        }

        return {
          inventoryItem,
          storeItem: matchingStoreItem,
          sellPrice,
        };
      })
      .filter((item): item is SellableStoreItem => Boolean(item));
  }, [effectiveNpcType, storeItems, user?.inventory]);

  const selectedStoreItem = useMemo(
    () => storeItems.find((item) => item.itemId === selectedStoreItemId) ?? null,
    [selectedStoreItemId, storeItems]
  );
  const selectedSellItem = useMemo(
    () => sellableItems.find((item) => item.inventoryItem.id === selectedSellItemId) ?? null,
    [selectedSellItemId, sellableItems]
  );

  useEffect(() => {
    if (!npcPlacement) {
      return;
    }

    setMode(getInitialMode(effectiveNpcType));
    setSelectedStoreItemId(storeItems[0]?.itemId ?? null);
    setSelectedSellItemId(sellableItems[0]?.inventoryItem.id ?? null);
    setIsSubmitting(false);
  }, [effectiveNpcType, npcPlacement, sellableItems, storeItems]);

  useEffect(() => {
    if (selectedStoreItemId && !storeItems.some((item) => item.itemId === selectedStoreItemId)) {
      setSelectedStoreItemId(storeItems[0]?.itemId ?? null);
    }
  }, [selectedStoreItemId, storeItems]);

  useEffect(() => {
    if (
      selectedSellItemId &&
      !sellableItems.some((item) => item.inventoryItem.id === selectedSellItemId)
    ) {
      setSelectedSellItemId(sellableItems[0]?.inventoryItem.id ?? null);
    }
  }, [selectedSellItemId, sellableItems]);

  useEffect(() => {
    if (errorMessage || infoMessage) {
      setIsSubmitting(false);
    }
  }, [errorMessage, infoMessage]);

  if (!npcPlacement) {
    return null;
  }

  const npcTitle = (npcDefinition?.name ?? npcPlacement.name).toUpperCase();
  const walletText = normalizeMoney(user?.money ?? 0);
  const healerPriceText = normalizeMoney(npcDefinition?.healPrice ?? 0);

  let dialogueText = "What would you like to do?";

  if (!npcDefinition) {
    dialogueText = "This NPC is still loading. Please try again in a moment.";
  } else if (effectiveNpcType === "healer") {
    dialogueText = isSubmitting
      ? "One moment while I take care of your team."
      : `Would you like me to heal your Pokemon team for ${healerPriceText}?`;
  } else if (mode === "storeMain") {
    dialogueText = "How may I serve you?";
  } else if (mode === "storeBuy") {
    dialogueText = selectedStoreItem
      ? `Buy ${selectedStoreItem.itemName} x${selectedStoreItem.quantity} for ${normalizeMoney(selectedStoreItem.price)}?`
      : "I have nothing in stock right now.";
  } else if (selectedSellItem) {
    dialogueText = `Sell ${selectedSellItem.inventoryItem.name} x1 for ${normalizeMoney(selectedSellItem.sellPrice)}?`;
  } else {
    dialogueText = "I only buy items that I keep in stock.";
  }

  return (
    <Flex
      position="fixed"
      inset={0}
      zIndex={4200}
      pointerEvents="none"
      direction="column"
      justify="flex-end"
      px={{ base: 3, md: 6 }}
      py={{ base: 3, md: 5 }}
      gap={3}
    >
      <Flex justify="space-between" align="flex-start" gap={3} wrap="wrap">
        <VStack align="stretch" spacing={3} pointerEvents="auto">
          <RetroPanel minWidth="220px" maxWidth="320px">
            <HStack justify="space-between" align="flex-start" spacing={3}>
              <Box minW={0}>
                <Text
                  display="inline-block"
                  px={2}
                  py={1}
                  bg="#1f1f1f"
                  color="#ffef69"
                  fontFamily="mono"
                  fontWeight="800"
                  fontSize={{ base: "sm", md: "md" }}
                  textTransform="uppercase"
                >
                  {npcTitle}
                </Text>
              </Box>
              <Text
                fontFamily="mono"
                fontWeight="800"
                fontSize={{ base: "lg", md: "xl" }}
                color="#4a4964"
                whiteSpace="nowrap"
              >
                {walletText}
              </Text>
            </HStack>
          </RetroPanel>

          {effectiveNpcType === "healer" ? (
            <RetroPanel minWidth="200px" maxWidth="260px">
              <VStack align="stretch" spacing={2}>
                <MenuChoiceButton
                  active
                  isDisabled={!npcDefinition || isSubmitting}
                  onClick={() => {
                    setIsSubmitting(true);
                    healNpcParty({ npcPlacementId: npcPlacement.id });
                  }}
                >
                  Yes
                </MenuChoiceButton>
                <MenuChoiceButton active={false} onClick={onClose}>
                  No
                </MenuChoiceButton>
              </VStack>
            </RetroPanel>
          ) : effectiveNpcType === "store" ? (
            <RetroPanel minWidth="220px" maxWidth="280px">
              <VStack align="stretch" spacing={2}>
                <MenuChoiceButton active={mode === "storeBuy"} onClick={() => setMode("storeBuy")}>
                  Buy
                </MenuChoiceButton>
                <MenuChoiceButton active={mode === "storeSell"} onClick={() => setMode("storeSell")}>
                  Sell
                </MenuChoiceButton>
                <MenuChoiceButton active={false} onClick={onClose}>
                  Quit
                </MenuChoiceButton>
              </VStack>
            </RetroPanel>
          ) : (
            <RetroPanel minWidth="200px" maxWidth="260px">
              <VStack align="stretch" spacing={2}>
                <MenuChoiceButton active isDisabled>
                  {effectiveNpcType}
                </MenuChoiceButton>
                <MenuChoiceButton active={false} onClick={onClose}>
                  Close
                </MenuChoiceButton>
              </VStack>
            </RetroPanel>
          )}
        </VStack>

        {effectiveNpcType === "store" && mode === "storeBuy" ? (
          <Box pointerEvents="auto">
            <StoreSelectionList
              title="Store"
              selectedId={selectedStoreItemId}
              onSelect={setSelectedStoreItemId}
              rows={
                storeItems.length > 0
                  ? storeItems.map((item) => ({
                      id: item.itemId,
                      label: item.itemName.toUpperCase(),
                      detail: `${normalizeMoney(item.price)}${item.quantity > 1 ? ` x${item.quantity}` : ""}`,
                    }))
                  : [{ id: "empty", label: "No stock", detail: "", disabled: true }]
              }
            />
          </Box>
        ) : null}

        {effectiveNpcType === "store" && mode === "storeSell" ? (
          <Box pointerEvents="auto">
            <StoreSelectionList
              title="Sell"
              selectedId={selectedSellItemId}
              onSelect={setSelectedSellItemId}
              rows={
                sellableItems.length > 0
                  ? sellableItems.map((item) => ({
                      id: item.inventoryItem.id,
                      label: `${item.inventoryItem.name.toUpperCase()} x${item.inventoryItem.quantity}`,
                      detail: normalizeMoney(item.sellPrice),
                    }))
                  : [{ id: "empty", label: "Nothing to sell", detail: "", disabled: true }]
              }
            />
          </Box>
        ) : null}
      </Flex>

      <RetroPanel maxWidth="100%">
        <VStack align="stretch" spacing={4}>
          <Text
            fontFamily="mono"
            fontWeight="800"
            fontSize={{ base: "lg", md: "2xl" }}
            color="#5a5a5a"
            lineHeight="1.35"
          >
            {dialogueText}
          </Text>

          {effectiveNpcType === "store" && mode === "storeBuy" ? (
            <HStack justify="flex-end" spacing={3} flexWrap="wrap">
              <Button
                variant="outline"
                borderColor="#5d5a7b"
                color="#4a4964"
                onClick={() => setMode("storeMain")}
              >
                Back
              </Button>
              <Button
                colorScheme="green"
                isDisabled={!selectedStoreItem || isSubmitting || !npcDefinition}
                onClick={() => {
                  if (!selectedStoreItem) {
                    return;
                  }

                  setIsSubmitting(true);
                  buyFromNpcStore({
                    npcPlacementId: npcPlacement.id,
                    itemId: selectedStoreItem.itemId,
                    quantity: 1,
                  });
                }}
              >
                Buy
              </Button>
            </HStack>
          ) : null}

          {effectiveNpcType === "store" && mode === "storeSell" ? (
            <HStack justify="flex-end" spacing={3} flexWrap="wrap">
              <Button
                variant="outline"
                borderColor="#5d5a7b"
                color="#4a4964"
                onClick={() => setMode("storeMain")}
              >
                Back
              </Button>
              <Button
                colorScheme="orange"
                isDisabled={!selectedSellItem || isSubmitting || !npcDefinition}
                onClick={() => {
                  if (!selectedSellItem) {
                    return;
                  }

                  setIsSubmitting(true);
                  sellToNpcStore({
                    npcPlacementId: npcPlacement.id,
                    itemId: selectedSellItem.inventoryItem.id,
                    quantity: 1,
                  });
                }}
              >
                Sell
              </Button>
            </HStack>
          ) : null}

          {effectiveNpcType !== "store" && effectiveNpcType !== "healer" ? (
            <HStack justify="flex-end">
              <Button variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={onClose}>
                Close
              </Button>
            </HStack>
          ) : null}
        </VStack>
      </RetroPanel>
    </Flex>
  );
}

export default NpcInteractionOverlay;
