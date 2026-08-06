import {
  Box,
  Button,
  Flex,
  HStack,
  Input,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import {
  DESIGNER_CACHE_UPDATED_EVENT,
  readStoredDesignerSectionPayload,
  type DesignerCacheUpdateDetail,
} from "../../designer/designerCache";
import type { MapEditorNpcPlacement } from "../../designer/PlayableMapEditorCanvas";
import {
  useAuth,
  type InventoryItem,
  type ItemStorageBox,
  type PokemonStorageBox,
  type PokemonSummary,
} from "../../../context/authContext";
import { assetUrl, resolveServerAssetUrl } from "../../tilemap/serverAssets";
import { useT } from "../../../i18n";
import { getPokemonDisplayName } from "./pokemonName";
import { useCompactUx } from "../useCompactUx";
import { useGameSettings } from "../../../settings/gameSettings";
import { MenuChoiceButton } from "./NpcInteractions";

const MAX_PARTY_SIZE = 6;
const MAX_BOXES = 15;

type PcMode = "menu" | "venomon" | "item" | "money";

// Preset swatches for the box color pickers (plus a "clear" option).
const COLOR_SWATCHES = [
  "#f7f4eb", "#ffd76e", "#ff7b73", "#7ad7ff", "#9ae6b4",
  "#d6bcfa", "#f6ad55", "#fc8181", "#63b3ed", "#a0aec0", "#2d3748", "#1a202c",
];

// ---- asset catalogs --------------------------------------------------------

function readPokemonIconIndex() {
  const index = new Map<string, string>();
  readStoredDesignerSectionPayload("pokemons").state.items.forEach((item) => {
    const profile = (item as { pokemonProfile?: { iconImageSrc?: string } }).pokemonProfile;
    if (item.id && profile?.iconImageSrc) index.set(item.id, profile.iconImageSrc);
  });
  return index;
}

type PokemonCatalogEntry = {
  iconImageSrc?: string;
  frontImageSrc?: string;
  attack?: number;
  defense?: number;
  specialAttack?: number;
  specialDefense?: number;
  speed?: number;
};

function readPokemonCatalog() {
  const index = new Map<string, PokemonCatalogEntry>();
  readStoredDesignerSectionPayload("pokemons").state.items.forEach((item) => {
    const profile = (item as { pokemonProfile?: PokemonCatalogEntry }).pokemonProfile;
    if (item.id && profile) index.set(item.id, profile);
  });
  return index;
}

function readItemIconIndex() {
  const index = new Map<string, string>();
  readStoredDesignerSectionPayload("items").state.items.forEach((item) => {
    const profile = (item as { itemProfile?: { iconSrc?: string } }).itemProfile;
    if (item.id && profile?.iconSrc) index.set(item.id, profile.iconSrc);
  });
  return index;
}

// Wallpaper choices are drawn from the game's imported picture assets. Loaded
// once and cached (mirrors EventDialog's picture manifest handling).
let wallpaperCache: Array<{ key: string; path: string }> | null = null;
let wallpaperRequested = false;

function useWallpapers() {
  const [wallpapers, setWallpapers] = useState<Array<{ key: string; path: string }>>(
    () => wallpaperCache ?? []
  );
  useEffect(() => {
    if (wallpaperCache) {
      setWallpapers(wallpaperCache);
      return;
    }
    if (wallpaperRequested || typeof fetch === "undefined") return;
    wallpaperRequested = true;
    fetch(assetUrl("/migration_exports/pictures/manifest.json"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          const entries = Object.entries(data as Record<string, string>)
            .map(([key, file]) => ({ key, path: `/migration_exports/pictures/${file}` }))
            .slice(0, 60);
          wallpaperCache = entries;
          setWallpapers(entries);
        }
      })
      .catch(() => undefined);
  }, []);
  return wallpapers;
}

function boxSurfaceStyle(box: { bgColor?: string; bgImage?: string; borderColor?: string }): CSSProperties {
  const style: CSSProperties = {};
  if (box.bgColor) style.backgroundColor = box.bgColor;
  if (box.bgImage) {
    const url = assetUrl(box.bgImage);
    style.backgroundImage = `linear-gradient(rgba(247,244,235,0.35), rgba(247,244,235,0.35)), url("${url}")`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  if (box.borderColor) style.borderColor = box.borderColor;
  return style;
}

// ---- small building blocks -------------------------------------------------

function stopUxEvent(event: React.SyntheticEvent) {
  event.stopPropagation();
}

/** Resolves a character name from the account's character list (badge for
 * boxed assets another character owns; fallback keeps the raw id visible). */
function characterNameById(
  characters: Array<{ characterId: number; characterName: string }> | undefined,
  characterId: number
) {
  return (
    characters?.find((entry) => entry.characterId === characterId)?.characterName ??
    `#${characterId}`
  );
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
      <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964">
        {(pokemon.nickname || pokemon.name).slice(0, 2).toUpperCase()}
      </Text>
    );
  }
  return (
    <img
      src={iconSrc}
      alt={getPokemonDisplayName(pokemon)}
      style={{ width: size, height: size, objectFit: "contain", imageRendering: "pixelated", pointerEvents: "none" }}
    />
  );
}

function ItemSlotIcon({
  item,
  iconIndex,
  size,
}: {
  item: InventoryItem;
  iconIndex: Map<string, string>;
  size: string;
}) {
  const iconSrc = resolveServerAssetUrl(iconIndex.get(item.id) ?? "");
  if (!iconSrc) {
    return (
      <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964">
        {item.name.slice(0, 2).toUpperCase()}
      </Text>
    );
  }
  return (
    <img
      src={iconSrc}
      alt={item.name}
      style={{ width: size, height: size, objectFit: "contain", imageRendering: "pixelated", pointerEvents: "none" }}
    />
  );
}

/**
 * Responsive overlay shell. A fixed, viewport-sized layer centers a panel that
 * is capped to the viewport (dividing the caps by the interface zoom so the
 * zoomed result still fits). The panel is a flex column: the header (with the
 * always-reachable Close button) and the footer never scroll; only the middle
 * body scrolls. This is what keeps every control usable on small screens.
 */
function StorageShell({
  title,
  scale,
  compact,
  onClose,
  onBack,
  headerExtra,
  footer,
  children,
}: {
  title: string;
  scale: number;
  compact: boolean;
  onClose: () => void;
  onBack?: () => void;
  headerExtra?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <Flex
      position="fixed"
      inset={0}
      zIndex={4200}
      align="center"
      justify="center"
      p={compact ? 1 : 3}
      pointerEvents="none"
    >
      <Box
        pointerEvents="auto"
        data-game-ux="true"
        onClick={stopUxEvent}
        onMouseDown={stopUxEvent}
        onPointerDown={stopUxEvent}
        style={{ zoom: scale } as CSSProperties}
        display="flex"
        flexDirection="column"
        width="100%"
        maxW={`calc(min(96vw, 1000px) / ${scale})`}
        maxH={`calc(94dvh / ${scale})`}
        bg="#f7f4eb"
        border={compact ? "3px solid #5d5a7b" : "4px solid #5d5a7b"}
        boxShadow="0 8px 0 rgba(122, 215, 255, 0.75)"
      >
        <Flex
          flexShrink={0}
          align="center"
          justify="space-between"
          gap={2}
          px={compact ? 2 : 3}
          py={2}
          borderBottom="3px solid #8a89a8"
          flexWrap="wrap"
        >
          <HStack spacing={2} minW={0}>
            {onBack ? (
              <Button size="sm" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={onBack}>
                ◀
              </Button>
            ) : null}
            <Text
              px={2}
              py={1}
              bg="#1f1f1f"
              color="#ffef69"
              fontFamily="mono"
              fontWeight="800"
              fontSize={compact ? "xs" : { base: "sm", md: "md" }}
              textTransform="uppercase"
              noOfLines={1}
            >
              {title}
            </Text>
          </HStack>
          <HStack spacing={2} flexWrap="wrap" justify="flex-end">
            {headerExtra}
            <Button size="sm" bg="#ffd76e" color="#4a4964" border="2px solid #5d5a7b" borderRadius={0} _hover={{ bg: "#ffe79b" }} onClick={onClose}>
              Close
            </Button>
          </HStack>
        </Flex>

        <Box flex="1" minH={0} overflowY="auto" px={compact ? 2 : 3} py={compact ? 2 : 3}>
          {children}
        </Box>

        {footer ? (
          <Box flexShrink={0} px={compact ? 2 : 3} py={2} borderTop="3px solid #8a89a8">
            {footer}
          </Box>
        ) : null}
      </Box>
    </Flex>,
    document.body
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (color: string | undefined) => void;
}) {
  return (
    <Box>
      <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" mb={1}>
        {label}
      </Text>
      <HStack spacing={1} flexWrap="wrap">
        <Box
          as="button"
          width="26px"
          height="26px"
          border="2px solid #8a89a8"
          bg="#ffffff"
          fontSize="14px"
          lineHeight="22px"
          onClick={() => onChange(undefined)}
          title="None"
        >
          ✕
        </Box>
        {COLOR_SWATCHES.map((color) => (
          <Box
            key={color}
            as="button"
            width="26px"
            height="26px"
            bg={color}
            border={value === color ? "3px solid #ff7b73" : "2px solid #8a89a8"}
            onClick={() => onChange(color)}
            title={color}
          />
        ))}
      </HStack>
    </Box>
  );
}

// ---- style editor ----------------------------------------------------------

function BoxStyleEditor({
  box,
  compact,
  onSave,
  onCancel,
}: {
  box: { id: string; name: string; bgColor?: string; bgImage?: string; borderColor?: string };
  compact: boolean;
  onSave: (patch: { boxId: string; name: string; bgColor?: string; bgImage?: string; borderColor?: string }) => void;
  onCancel: () => void;
}) {
  const wallpapers = useWallpapers();
  const [name, setName] = useState(box.name);
  const [bgColor, setBgColor] = useState<string | undefined>(box.bgColor);
  const [bgImage, setBgImage] = useState<string | undefined>(box.bgImage);
  const [borderColor, setBorderColor] = useState<string | undefined>(box.borderColor);

  return (
    <VStack align="stretch" spacing={3}>
      <Box>
        <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" mb={1}>
          Box name
        </Text>
        <Input
          value={name}
          maxLength={20}
          bg="white"
          color="#1f2937"
          borderColor="#5d5a7b"
          fontFamily="mono"
          fontWeight="800"
          size="sm"
          onChange={(event) => setName(event.target.value)}
        />
      </Box>
      <ColorRow label="Background color" value={bgColor} onChange={setBgColor} />
      <ColorRow label="Border color" value={borderColor} onChange={setBorderColor} />
      <Box>
        <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" mb={1}>
          Background image
        </Text>
        <SimpleGrid columns={compact ? 4 : 6} spacing={1} maxH="180px" overflowY="auto">
          <Box
            as="button"
            height={compact ? "42px" : "52px"}
            border={!bgImage ? "3px solid #ff7b73" : "2px solid #8a89a8"}
            bg="#ffffff"
            fontFamily="mono"
            fontWeight="800"
            fontSize="xs"
            onClick={() => setBgImage(undefined)}
          >
            None
          </Box>
          {wallpapers.map((wallpaper) => (
            <Box
              key={wallpaper.key}
              as="button"
              height={compact ? "42px" : "52px"}
              border={bgImage === wallpaper.path ? "3px solid #ff7b73" : "2px solid #8a89a8"}
              backgroundImage={`url("${assetUrl(wallpaper.path)}")`}
              backgroundSize="cover"
              backgroundPosition="center"
              onClick={() => setBgImage(wallpaper.path)}
              title={wallpaper.key}
            />
          ))}
        </SimpleGrid>
      </Box>
      <HStack justify="flex-end" spacing={2}>
        <Button size="sm" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          colorScheme="teal"
          onClick={() => onSave({ boxId: box.id, name: name.trim() || box.name, bgColor, bgImage, borderColor })}
        >
          Save
        </Button>
      </HStack>
    </VStack>
  );
}

// ---- venomon stats panel ---------------------------------------------------

function StatsPanel({
  pokemon,
  catalog,
  onClose,
}: {
  pokemon: PokemonSummary;
  catalog: Map<string, PokemonCatalogEntry>;
  onClose: () => void;
}) {
  const entry = catalog.get(pokemon.sourcePokemonId ?? "") ?? catalog.get(pokemon.id) ?? null;
  const front = resolveServerAssetUrl(entry?.frontImageSrc ?? entry?.iconImageSrc ?? "");
  const stat = (value?: number) => (typeof value === "number" ? String(value) : "—");
  return (
    <VStack align="stretch" spacing={3}>
      <HStack spacing={3} align="center">
        {front ? (
          <img src={front} alt={pokemon.name} style={{ width: "72px", height: "72px", objectFit: "contain", imageRendering: "pixelated" }} />
        ) : null}
        <Box minW={0}>
          <Text fontFamily="mono" fontWeight="800" fontSize="lg" color="#4a4964" noOfLines={1}>
            {getPokemonDisplayName(pokemon)}
          </Text>
          <Text fontFamily="mono" fontSize="sm" color="#7a4b20">
            Lv {pokemon.level} · {pokemon.types.join(" / ")}
          </Text>
          {pokemon.nickname ? (
            <Text fontFamily="mono" fontSize="xs" color="#8a89a8">Species: {pokemon.name}</Text>
          ) : null}
        </Box>
      </HStack>
      <SimpleGrid columns={3} spacing={2}>
        <StatTile label="HP" value={`${pokemon.hp}/${pokemon.maxHp}`} />
        <StatTile label="Attack" value={stat(entry?.attack)} />
        <StatTile label="Defense" value={stat(entry?.defense)} />
        <StatTile label="Sp. Atk" value={stat(entry?.specialAttack)} />
        <StatTile label="Sp. Def" value={stat(entry?.specialDefense)} />
        <StatTile label="Speed" value={stat(entry?.speed)} />
        <StatTile label="EXP" value={`${pokemon.experience}/${pokemon.nextLevelExperience}`} />
        <StatTile label="Held" value={pokemon.heldItemName ?? "None"} />
        <StatTile label="Curve" value={pokemon.experienceCurve} />
      </SimpleGrid>
      <Box bg="whiteAlpha.500" border="2px solid #8a89a8" p={2}>
        <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964">Moves</Text>
        <Text fontFamily="mono" fontSize="sm" color="#5a5a5a">
          {pokemon.moves
            .map((move) => (typeof pokemon.movePp?.[move] === "number" ? `${move} (${pokemon.movePp[move]} PP)` : move))
            .join(", ") || "No moves."}
        </Text>
      </Box>
      <HStack justify="flex-end">
        <Button size="sm" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={onClose}>
          Back
        </Button>
      </HStack>
    </VStack>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Box bg="whiteAlpha.500" border="2px solid #8a89a8" px={2} py={1}>
      <Text fontFamily="mono" fontSize="10px" color="#8a89a8" textTransform="uppercase">{label}</Text>
      <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#4a4964" noOfLines={1}>{value}</Text>
    </Box>
  );
}

// ---- box selector strip ----------------------------------------------------

function BoxSelectorStrip({
  boxes,
  activeIndex,
  onSelect,
  onAdd,
  canAdd,
  compact,
}: {
  boxes: Array<{ id: string; name: string }>;
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  canAdd: boolean;
  compact: boolean;
}) {
  return (
    <HStack spacing={1} overflowX="auto" pb={1}>
      {boxes.map((box, index) => (
        <Button
          key={box.id}
          size="sm"
          flexShrink={0}
          variant="unstyled"
          px={2}
          minW="auto"
          height="30px"
          border="2px solid"
          borderColor={index === activeIndex ? "#ff7b73" : "#8a89a8"}
          bg={index === activeIndex ? "#fff3cf" : "#ffffff"}
          color="#404040"
          fontFamily="mono"
          fontWeight="800"
          fontSize={compact ? "xs" : "sm"}
          onClick={() => onSelect(index)}
        >
          {box.name}
        </Button>
      ))}
      <Button
        size="sm"
        flexShrink={0}
        height="30px"
        border="2px dashed #5d5a7b"
        bg="transparent"
        color="#5d5a7b"
        fontFamily="mono"
        fontWeight="800"
        isDisabled={!canAdd}
        onClick={onAdd}
        title={canAdd ? "Add a box" : `Max ${MAX_BOXES} boxes`}
      >
        + Box
      </Button>
    </HStack>
  );
}

// ---- venomon view ----------------------------------------------------------

function VenomonView({ compact }: { compact: boolean }) {
  const {
    user,
    errorMessage,
    infoMessage,
    depositPokemonToBox,
    withdrawPokemonFromBox,
    movePokemonToBox,
    releasePokemonFromBox,
    createPokemonBox,
    stylePokemonBox,
  } = useAuth();
  const t = useT();

  const [boxIndex, setBoxIndex] = useState(0);
  const [partySel, setPartySel] = useState<Set<string>>(new Set());
  const [boxSel, setBoxSel] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<"none" | "style" | "stats" | "move">("none");
  const [statsId, setStatsId] = useState<string | null>(null);
  const [iconIndex, setIconIndex] = useState(() => readPokemonIconIndex());
  const [catalog, setCatalog] = useState(() => readPokemonCatalog());

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;
      if (detail?.sectionKey === "pokemons") {
        setIconIndex(readPokemonIconIndex());
        setCatalog(readPokemonCatalog());
      }
    };
    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handler);
  }, []);

  const party = useMemo(() => user?.pokemonParty ?? [], [user?.pokemonParty]);
  const boxes = useMemo<PokemonStorageBox[]>(
    () => (user?.pokemonStorage?.length ? user.pokemonStorage : []),
    [user?.pokemonStorage]
  );
  const activeBox = boxes[Math.min(boxIndex, Math.max(0, boxes.length - 1))];

  useEffect(() => {
    if (boxIndex > boxes.length - 1) setBoxIndex(Math.max(0, boxes.length - 1));
  }, [boxIndex, boxes.length]);

  // A fresh session or a toast means the last action resolved: clear selections
  // that no longer point at anything and drop transient panels.
  useEffect(() => {
    setPartySel((prev) => new Set([...prev].filter((id) => party.some((p) => p.id === id))));
    setBoxSel((prev) => new Set([...prev].filter((id) => boxes.some((b) => b.pokemon.some((p) => p.id === id)))));
  }, [party, boxes]);

  useEffect(() => {
    if (panel === "move") setPanel("none");
  }, [errorMessage, infoMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!activeBox) {
    return <Text fontFamily="mono" color="#5a5a5a">Loading storage…</Text>;
  }

  const toggle = (setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const partyIds = [...partySel];
  const boxIds = [...boxSel];

  const doDeposit = () => {
    if (partyIds.length === 0) return;
    depositPokemonToBox({ pokemonIds: partyIds, boxId: activeBox.id });
    setPartySel(new Set());
  };
  const doWithdraw = () => {
    if (boxIds.length === 0) return;
    withdrawPokemonFromBox({ pokemonIds: boxIds, boxId: activeBox.id });
    setBoxSel(new Set());
  };
  const doRelease = () => {
    if (boxIds.length === 0) return;
    if (!window.confirm(`Let go of ${boxIds.length} Venomon? This cannot be undone.`)) return;
    releasePokemonFromBox({ pokemonIds: boxIds });
    setBoxSel(new Set());
  };
  const doMoveTo = (toBoxId: string) => {
    if (boxIds.length === 0) return;
    movePokemonToBox({ pokemonIds: boxIds, toBoxId });
    setBoxSel(new Set());
    setPanel("none");
  };

  const openStats = (id: string) => {
    setStatsId(id);
    setPanel("stats");
  };

  const statsPokemon =
    panel === "stats" && statsId
      ? party.find((p) => p.id === statsId) ?? boxes.flatMap((b) => b.pokemon).find((p) => p.id === statsId) ?? null
      : null;

  // The extra "+1" virtual box lets players page to / target a fresh box.
  const moveTargets = [
    ...boxes.filter((b) => b.id !== activeBox.id),
    ...(boxes.length < MAX_BOXES ? [{ id: `box-${boxes.length + 1}`, name: `New Box ${boxes.length + 1}` }] : []),
  ];

  if (panel === "stats" && statsPokemon) {
    return <StatsPanel pokemon={statsPokemon} catalog={catalog} onClose={() => setPanel("none")} />;
  }
  if (panel === "style") {
    return (
      <BoxStyleEditor
        box={activeBox}
        compact={compact}
        onSave={(patch) => {
          stylePokemonBox(patch);
          setPanel("none");
        }}
        onCancel={() => setPanel("none")}
      />
    );
  }
  if (panel === "move") {
    return (
      <VStack align="stretch" spacing={2}>
        <Text fontFamily="mono" fontWeight="800" color="#4a4964">
          Move {boxIds.length} Venomon to…
        </Text>
        {moveTargets.length === 0 ? (
          <Text fontFamily="mono" color="#8a89a8">No other boxes available.</Text>
        ) : (
          moveTargets.map((target) => (
            <MenuChoiceButton key={target.id} onClick={() => doMoveTo(target.id)}>
              {target.name}
            </MenuChoiceButton>
          ))
        )}
        <HStack justify="flex-end">
          <Button size="sm" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={() => setPanel("none")}>
            Cancel
          </Button>
        </HStack>
      </VStack>
    );
  }

  const boxSlots = Array.from({ length: activeBox.capacity }, (_, i) => activeBox.pokemon[i] ?? null);
  const slotSize = compact ? "34px" : "44px";

  return (
    <VStack align="stretch" spacing={3}>
      <BoxSelectorStrip
        boxes={boxes}
        activeIndex={Math.min(boxIndex, boxes.length - 1)}
        onSelect={(index) => { setBoxIndex(index); setBoxSel(new Set()); }}
        onAdd={createPokemonBox}
        canAdd={boxes.length < MAX_BOXES}
        compact={compact}
      />

      <Flex gap={compact ? 2 : 4} direction={compact ? "column" : "row"} align="stretch">
        {/* Party */}
        <Box minW={compact ? undefined : "230px"} maxW={compact ? undefined : "260px"} flexShrink={0}>
          <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" mb={1} textTransform="uppercase">
            Party ({party.length}/{MAX_PARTY_SIZE})
          </Text>
          <VStack align="stretch" spacing={1} maxH={compact ? "150px" : "330px"} overflowY="auto">
            {party.map((pokemon) => (
              <Box
                key={pokemon.id}
                as="button"
                textAlign="left"
                px={2}
                py={1}
                border="2px solid"
                borderColor={partySel.has(pokemon.id) ? "#ff7b73" : "#8a89a8"}
                bg={partySel.has(pokemon.id) ? "#fff3cf" : "#ffffff"}
                onClick={() => toggle(setPartySel, pokemon.id)}
                onDoubleClick={() => openStats(pokemon.id)}
              >
                <HStack spacing={2}>
                  <Box width="26px" height="26px" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
                    <PokemonSlotIcon pokemon={pokemon} iconIndex={iconIndex} size="26px" />
                  </Box>
                  <Text flex="1" fontFamily="mono" fontWeight="800" fontSize="sm" color="#404040" noOfLines={1}>
                    {getPokemonDisplayName(pokemon)}
                  </Text>
                  <Text fontFamily="mono" fontSize="xs" color="#7a4b20">Lv {pokemon.level}</Text>
                </HStack>
              </Box>
            ))}
            {party.length === 0 ? <Text fontFamily="mono" fontSize="sm" color="#8a89a8">Party is empty.</Text> : null}
          </VStack>
        </Box>

        {/* Active box */}
        <Box flex="1" minW={0}>
          <HStack justify="space-between" mb={1}>
            <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" textTransform="uppercase" noOfLines={1}>
              {activeBox.name} ({activeBox.pokemon.length}/{activeBox.capacity})
            </Text>
            <Button size="xs" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={() => setPanel("style")}>
              Edit box
            </Button>
          </HStack>
          <SimpleGrid
            columns={compact ? 5 : 6}
            spacing={1}
            p={1}
            border="3px solid #8a89a8"
            style={boxSurfaceStyle(activeBox)}
          >
            {boxSlots.map((pokemon, index) => {
              const selected = Boolean(pokemon) && boxSel.has(pokemon!.id);
              // Box assets belong to whichever character stored them; mark the
              // ones another of this account's characters owns (the server
              // gates taking them behind gym medals).
              const foreignOwnerId =
                pokemon &&
                typeof pokemon.ownerCharacterId === "number" &&
                pokemon.ownerCharacterId !== user?.characterId
                  ? pokemon.ownerCharacterId
                  : null;
              const ownerLabel =
                foreignOwnerId !== null
                  ? t("pc.ownerBadge", { name: characterNameById(user?.characters, foreignOwnerId) })
                  : null;
              return (
                <Box
                  key={pokemon ? pokemon.id : `empty-${index}`}
                  as="button"
                  position="relative"
                  height={slotSize}
                  border="2px solid"
                  borderColor={selected ? "#ff7b73" : "#8a89a8"}
                  bg={pokemon ? (selected ? "#fff3cf" : "rgba(255,255,255,0.85)") : "rgba(232,229,218,0.6)"}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  cursor={pokemon ? "pointer" : "default"}
                  title={
                    pokemon
                      ? `${getPokemonDisplayName(pokemon)} Lv ${pokemon.level}${ownerLabel ? ` — ${ownerLabel}` : ""}`
                      : "Empty"
                  }
                  onClick={() => pokemon && toggle(setBoxSel, pokemon.id)}
                  onDoubleClick={() => pokemon && openStats(pokemon.id)}
                >
                  {pokemon ? <PokemonSlotIcon pokemon={pokemon} iconIndex={iconIndex} size={compact ? "26px" : "34px"} /> : null}
                  {ownerLabel ? (
                    <Box
                      position="absolute"
                      top="1px"
                      right="1px"
                      width="10px"
                      height="10px"
                      borderRadius="full"
                      bg="#7ad7ff"
                      border="1px solid #5d5a7b"
                      title={ownerLabel}
                    />
                  ) : null}
                </Box>
              );
            })}
          </SimpleGrid>
        </Box>
      </Flex>

      <Flex gap={2} flexWrap="wrap" justify="space-between" align="center">
        <Text fontFamily="mono" fontSize="xs" color="#8a89a8">
          {partyIds.length > 0
            ? `${partyIds.length} party selected`
            : boxIds.length > 0
              ? `${boxIds.length} in box selected`
              : "Tap to select · double-tap for stats"}
        </Text>
        <HStack spacing={2} flexWrap="wrap">
          <Button size="sm" colorScheme="green" isDisabled={partyIds.length === 0 || party.length - partyIds.length < 1} onClick={doDeposit}>
            Deposit
          </Button>
          <Button size="sm" colorScheme="blue" isDisabled={boxIds.length === 0 || party.length + boxIds.length > MAX_PARTY_SIZE} onClick={doWithdraw}>
            Withdraw
          </Button>
          <Button size="sm" colorScheme="purple" isDisabled={boxIds.length === 0} onClick={() => setPanel("move")}>
            Move
          </Button>
          <Button size="sm" colorScheme="red" isDisabled={boxIds.length === 0} onClick={doRelease}>
            Let Go
          </Button>
          <Button
            size="sm"
            variant="outline"
            borderColor="#5d5a7b"
            color="#4a4964"
            isDisabled={partyIds.length + boxIds.length !== 1}
            onClick={() => openStats(partyIds[0] ?? boxIds[0])}
          >
            Stats
          </Button>
        </HStack>
      </Flex>
    </VStack>
  );
}

// ---- item view -------------------------------------------------------------

function ItemView({ compact }: { compact: boolean }) {
  const {
    user,
    errorMessage,
    infoMessage,
    depositItemToBox,
    withdrawItemFromBox,
    moveItemToBox,
    releaseItemFromBox,
    createItemBox,
    styleItemBox,
  } = useAuth();
  const t = useT();

  const [boxIndex, setBoxIndex] = useState(0);
  const [selection, setSelection] = useState<{ source: "bag" | "box"; itemId: string } | null>(null);
  const [qty, setQty] = useState(1);
  const [panel, setPanel] = useState<"none" | "style" | "move">("none");
  const [iconIndex, setIconIndex] = useState(() => readItemIconIndex());

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<DesignerCacheUpdateDetail>).detail;
      if (detail?.sectionKey === "items") setIconIndex(readItemIconIndex());
    };
    window.addEventListener(DESIGNER_CACHE_UPDATED_EVENT, handler);
    return () => window.removeEventListener(DESIGNER_CACHE_UPDATED_EVENT, handler);
  }, []);

  const bag = useMemo(() => (user?.inventory ?? []).filter((item) => item.quantity > 0), [user?.inventory]);
  const boxes = useMemo<ItemStorageBox[]>(
    () => (user?.itemStorage?.length ? user.itemStorage : []),
    [user?.itemStorage]
  );
  const activeBox = boxes[Math.min(boxIndex, Math.max(0, boxes.length - 1))];

  useEffect(() => {
    if (boxIndex > boxes.length - 1) setBoxIndex(Math.max(0, boxes.length - 1));
  }, [boxIndex, boxes.length]);

  useEffect(() => {
    if (panel === "move") setPanel("none");
  }, [errorMessage, infoMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedStack: InventoryItem | null = useMemo(() => {
    if (!selection) return null;
    if (selection.source === "bag") return bag.find((item) => item.id === selection.itemId) ?? null;
    return activeBox?.items.find((item) => item.id === selection.itemId) ?? null;
  }, [selection, bag, activeBox]);

  // Keep the quantity within the selected stack.
  useEffect(() => {
    if (!selectedStack) { setQty(1); return; }
    setQty((current) => Math.min(Math.max(1, current), selectedStack.quantity));
  }, [selectedStack]);

  useEffect(() => {
    if (selection && !selectedStack) setSelection(null);
  }, [selection, selectedStack]);

  if (!activeBox) {
    return <Text fontFamily="mono" color="#5a5a5a">Loading item storage…</Text>;
  }

  const maxQty = selectedStack?.quantity ?? 1;

  const doDeposit = () => {
    if (!selectedStack || selection?.source !== "bag") return;
    depositItemToBox({ itemId: selectedStack.id, quantity: qty, boxId: activeBox.id });
    setSelection(null);
  };
  const doWithdraw = () => {
    if (!selectedStack || selection?.source !== "box") return;
    withdrawItemFromBox({ itemId: selectedStack.id, quantity: qty, boxId: activeBox.id });
    setSelection(null);
  };
  const doRelease = () => {
    if (!selectedStack || selection?.source !== "box") return;
    if (!window.confirm(`Throw away ${qty}x ${selectedStack.name}?`)) return;
    releaseItemFromBox({ itemId: selectedStack.id, quantity: qty, boxId: activeBox.id });
    setSelection(null);
  };
  const doMoveTo = (toBoxId: string) => {
    if (!selectedStack || selection?.source !== "box") return;
    moveItemToBox({ itemId: selectedStack.id, quantity: qty, fromBoxId: activeBox.id, toBoxId });
    setSelection(null);
    setPanel("none");
  };

  const moveTargets = [
    ...boxes.filter((b) => b.id !== activeBox.id),
    ...(boxes.length < MAX_BOXES ? [{ id: `box-${boxes.length + 1}`, name: `New Box ${boxes.length + 1}` }] : []),
  ];

  if (panel === "style") {
    return (
      <BoxStyleEditor
        box={activeBox}
        compact={compact}
        onSave={(patch) => { styleItemBox(patch); setPanel("none"); }}
        onCancel={() => setPanel("none")}
      />
    );
  }
  if (panel === "move") {
    return (
      <VStack align="stretch" spacing={2}>
        <Text fontFamily="mono" fontWeight="800" color="#4a4964">
          Move {qty}x {selectedStack?.name} to…
        </Text>
        {moveTargets.length === 0 ? (
          <Text fontFamily="mono" color="#8a89a8">No other boxes available.</Text>
        ) : (
          moveTargets.map((target) => (
            <MenuChoiceButton key={target.id} onClick={() => doMoveTo(target.id)}>
              {target.name}
            </MenuChoiceButton>
          ))
        )}
        <HStack justify="flex-end">
          <Button size="sm" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={() => setPanel("none")}>
            Cancel
          </Button>
        </HStack>
      </VStack>
    );
  }

  const renderRow = (item: InventoryItem, source: "bag" | "box") => {
    const active = selection?.source === source && selection.itemId === item.id;
    // Stored stacks carry their owning character; badge the ones another of
    // this account's characters owns (server gates taking them via medals).
    const foreignOwnerId =
      source === "box" &&
      typeof item.ownerCharacterId === "number" &&
      item.ownerCharacterId !== user?.characterId
        ? item.ownerCharacterId
        : null;
    const ownerLabel =
      foreignOwnerId !== null
        ? t("pc.ownerBadge", { name: characterNameById(user?.characters, foreignOwnerId) })
        : null;
    return (
      <Box
        key={`${source}-${item.id}`}
        as="button"
        textAlign="left"
        px={2}
        py={1}
        border="2px solid"
        borderColor={active ? "#ff7b73" : "#8a89a8"}
        bg={active ? "#fff3cf" : "rgba(255,255,255,0.9)"}
        title={ownerLabel ?? undefined}
        onClick={() => setSelection({ source, itemId: item.id })}
      >
        <HStack spacing={2}>
          <Box width="24px" height="24px" display="flex" alignItems="center" justifyContent="center" flexShrink={0}>
            <ItemSlotIcon item={item} iconIndex={iconIndex} size="24px" />
          </Box>
          <Box flex="1" minW={0}>
            <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#404040" noOfLines={1}>
              {item.name}
            </Text>
            {ownerLabel ? (
              <Text fontFamily="mono" fontSize="10px" color="#2b6cb0" noOfLines={1}>
                {ownerLabel}
              </Text>
            ) : null}
          </Box>
          <Text fontFamily="mono" fontSize="xs" color="#7a4b20">x{item.quantity}</Text>
        </HStack>
      </Box>
    );
  };

  return (
    <VStack align="stretch" spacing={3}>
      <BoxSelectorStrip
        boxes={boxes}
        activeIndex={Math.min(boxIndex, boxes.length - 1)}
        onSelect={(index) => { setBoxIndex(index); setSelection(null); }}
        onAdd={createItemBox}
        canAdd={boxes.length < MAX_BOXES}
        compact={compact}
      />

      <Flex gap={compact ? 2 : 4} direction={compact ? "column" : "row"} align="stretch">
        <Box flex="1" minW={0}>
          <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" mb={1} textTransform="uppercase">
            Bag ({bag.length})
          </Text>
          <VStack align="stretch" spacing={1} maxH={compact ? "150px" : "320px"} overflowY="auto">
            {bag.map((item) => renderRow(item, "bag"))}
            {bag.length === 0 ? <Text fontFamily="mono" fontSize="sm" color="#8a89a8">Your bag is empty.</Text> : null}
          </VStack>
        </Box>

        <Box flex="1" minW={0}>
          <HStack justify="space-between" mb={1}>
            <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" textTransform="uppercase" noOfLines={1}>
              {activeBox.name} ({activeBox.items.length}/{activeBox.capacity})
            </Text>
            <Button size="xs" variant="outline" borderColor="#5d5a7b" color="#4a4964" onClick={() => setPanel("style")}>
              Edit box
            </Button>
          </HStack>
          <VStack align="stretch" spacing={1} maxH={compact ? "150px" : "320px"} overflowY="auto" p={1} border="3px solid #8a89a8" style={boxSurfaceStyle(activeBox)}>
            {activeBox.items.map((item) => renderRow(item, "box"))}
            {activeBox.items.length === 0 ? <Text fontFamily="mono" fontSize="sm" color="#8a89a8">This box is empty.</Text> : null}
          </VStack>
        </Box>
      </Flex>

      <Flex gap={2} flexWrap="wrap" justify="space-between" align="center">
        <HStack spacing={1}>
          <Text fontFamily="mono" fontSize="xs" color="#8a89a8" mr={1}>Qty</Text>
          <Button size="xs" isDisabled={!selectedStack || qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>−</Button>
          <Input
            width="52px"
            size="xs"
            textAlign="center"
            fontFamily="mono"
            bg="white"
            value={selectedStack ? qty : 0}
            onChange={(event) => {
              const next = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(next)) setQty(Math.min(Math.max(1, next), maxQty));
            }}
            isDisabled={!selectedStack}
          />
          <Button size="xs" isDisabled={!selectedStack || qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))}>+</Button>
          <Button size="xs" variant="outline" isDisabled={!selectedStack} onClick={() => setQty(maxQty)}>Max</Button>
        </HStack>
        <HStack spacing={2} flexWrap="wrap">
          <Button size="sm" colorScheme="green" isDisabled={selection?.source !== "bag"} onClick={doDeposit}>Store</Button>
          <Button size="sm" colorScheme="blue" isDisabled={selection?.source !== "box"} onClick={doWithdraw}>Withdraw</Button>
          <Button size="sm" colorScheme="purple" isDisabled={selection?.source !== "box"} onClick={() => setPanel("move")}>Move</Button>
          <Button size="sm" colorScheme="red" isDisabled={selection?.source !== "box"} onClick={doRelease}>Throw Away</Button>
        </HStack>
      </Flex>
    </VStack>
  );
}

// ---- money view ------------------------------------------------------------

/**
 * PC bank: the money box is shared by the whole account, but each character
 * keeps its own deposit in it. `user.pcMoney` is the ACTIVE character's own
 * deposits total; `user.sharedMoneyDeposits` lists every character's deposit.
 * Withdrawing another character's deposit is medal-gated — the server
 * enforces it and its error message arrives via the usual auth toasts.
 */
function MoneyView() {
  const { user, depositPcMoney, withdrawPcMoney } = useAuth();
  const t = useT();
  const wallet = user?.money ?? 0;
  const bank = user?.pcMoney ?? 0;
  const deposits = user?.sharedMoneyDeposits ?? [];
  const [amount, setAmount] = useState(100);

  const clampInput = (raw: string) => {
    const next = Number.parseInt(raw, 10);
    setAmount(Number.isFinite(next) ? Math.max(0, next) : 0);
  };

  return (
    <VStack align="stretch" spacing={4} maxW="420px" mx="auto">
      <SimpleGrid columns={2} spacing={3}>
        <Box bg="whiteAlpha.600" border="2px solid #8a89a8" p={3}>
          <Text fontFamily="mono" fontSize="xs" color="#8a89a8" textTransform="uppercase">Wallet</Text>
          <Text fontFamily="mono" fontWeight="800" fontSize="xl" color="#4a4964">${wallet}</Text>
        </Box>
        <Box bg="whiteAlpha.600" border="2px solid #8a89a8" p={3}>
          <Text fontFamily="mono" fontSize="xs" color="#8a89a8" textTransform="uppercase">PC Bank</Text>
          <Text fontFamily="mono" fontWeight="800" fontSize="xl" color="#4a4964">${bank}</Text>
        </Box>
      </SimpleGrid>

      {deposits.length > 0 ? (
        <Box>
          <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" mb={1} textTransform="uppercase">
            {t('pc.deposits')}
          </Text>
          <VStack align="stretch" spacing={1}>
            {deposits.map((deposit) => {
              const isOwn = deposit.ownerCharacterId === user?.characterId;
              return (
                <HStack
                  key={deposit.ownerCharacterId}
                  justify="space-between"
                  bg="whiteAlpha.600"
                  border="2px solid #8a89a8"
                  px={2}
                  py={1}
                >
                  <Box minW={0}>
                    <Text fontFamily="mono" fontWeight="800" fontSize="sm" color="#4a4964" noOfLines={1}>
                      {deposit.ownerCharacterName}
                      {isOwn ? ` ${t('pc.you')}` : ''}
                    </Text>
                    <Text fontFamily="mono" fontSize="xs" color="#7a4b20">${deposit.amount}</Text>
                  </Box>
                  <Button
                    size="xs"
                    colorScheme="blue"
                    flexShrink={0}
                    isDisabled={amount <= 0 || amount > deposit.amount}
                    onClick={() =>
                      withdrawPcMoney(
                        isOwn
                          ? { amount }
                          : { amount, ownerCharacterId: deposit.ownerCharacterId }
                      )
                    }
                  >
                    {t('pc.withdraw')}
                  </Button>
                </HStack>
              );
            })}
          </VStack>
          <Text fontFamily="mono" fontSize="xs" color="#8a89a8" mt={2}>
            {t('pc.medalHint')}
          </Text>
        </Box>
      ) : null}

      <Box>
        <Text fontFamily="mono" fontWeight="800" fontSize="xs" color="#4a4964" mb={1}>Amount</Text>
        <HStack>
          <Input
            type="number"
            value={amount}
            min={0}
            bg="white"
            borderColor="#5d5a7b"
            fontFamily="mono"
            fontWeight="800"
            onChange={(event) => clampInput(event.target.value)}
          />
          <Button size="sm" variant="outline" onClick={() => setAmount(wallet)}>All (wallet)</Button>
          <Button size="sm" variant="outline" onClick={() => setAmount(bank)}>All (bank)</Button>
        </HStack>
      </Box>

      <HStack spacing={3} justify="center">
        <Button colorScheme="green" isDisabled={amount <= 0 || amount > wallet} onClick={() => depositPcMoney({ amount })}>
          Deposit ▸ PC
        </Button>
        <Button colorScheme="blue" isDisabled={amount <= 0 || amount > bank} onClick={() => withdrawPcMoney({ amount })}>
          Withdraw ◂ PC
        </Button>
      </HStack>
      <Text fontFamily="mono" fontSize="xs" color="#8a89a8" textAlign="center">
        Money stored in the PC is kept separate from your wallet and is safe if you black out.
      </Text>
    </VStack>
  );
}

// ---- root overlay ----------------------------------------------------------

/**
 * The PC storage overlay (pbPokeCenterPC / pbTrainerPC). Opens on a menu that
 * asks whether to manage Venomon, Items, or PC money, then shows the matching
 * screen. The responsive StorageShell keeps Close and the action bar reachable
 * on every screen size and scales with the "Interface windows size" setting.
 */
export default function PcBoxOverlay({
  npcPlacement,
  onClose,
}: {
  npcPlacement: MapEditorNpcPlacement;
  onClose: () => void;
}) {
  const compact = useCompactUx();
  const [gameSettings] = useGameSettings();
  const scale = gameSettings.uiScale.interface;
  const [mode, setMode] = useState<PcMode>("menu");

  // Escape closes the overlay from anywhere.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onClose]);

  if (!npcPlacement) return null;

  const titleByMode: Record<PcMode, string> = {
    menu: "PC — Main Menu",
    venomon: "Venomon Storage",
    item: "Item Storage",
    money: "PC Bank",
  };

  return (
    <StorageShell
      title={titleByMode[mode]}
      scale={scale}
      compact={compact}
      onClose={onClose}
      onBack={mode === "menu" ? undefined : () => setMode("menu")}
    >
      {mode === "menu" ? (
        <VStack align="stretch" spacing={3} maxW="420px" mx="auto" py={2}>
          <Text fontFamily="mono" fontWeight="800" color="#5a5a5a" textAlign="center">
            What would you like to access?
          </Text>
          <MenuChoiceButton onClick={() => setMode("venomon")}>🐾 Venomon Boxes</MenuChoiceButton>
          <MenuChoiceButton onClick={() => setMode("item")}>🎒 Item Boxes</MenuChoiceButton>
          <MenuChoiceButton onClick={() => setMode("money")}>💰 PC Bank (Money)</MenuChoiceButton>
        </VStack>
      ) : mode === "venomon" ? (
        <VenomonView compact={compact} />
      ) : mode === "item" ? (
        <ItemView compact={compact} />
      ) : (
        <MoneyView />
      )}
    </StorageShell>
  );
}
