import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  designerSectionsByKey,
  type DesignerItemSeed,
  type DesignerMapSizePreset,
  type DesignerPlayableMapBackgroundImageMode,
  type DesignerPlayableMapConfig,
  type DesignerPlayableMapType,
} from "./designerSections";

type DesignerSectionState = {
  categories: string[];
  items: DesignerItemSeed[];
};

const STORAGE_KEY = "designer-demo:mapsEditor";
const REGION_STORAGE_KEY = "designer-demo:regions";
const MAP_CELL_SIZE_OPTIONS = [8, 16, 32, 64, 128] as const;
const MAP_BACKGROUND_IMAGE_MODES: DesignerPlayableMapBackgroundImageMode[] = [
  "repeat",
  "centered",
  "stretched",
];
const DEFAULT_MAP_BACKGROUND_COLOR = "#8bc17f";
const DEFAULT_MAP_BACKGROUND_IMAGE_MODE: DesignerPlayableMapBackgroundImageMode = "repeat";
const MAP_SIZE_OPTIONS: Array<{
  value: DesignerMapSizePreset;
  label: string;
  width: number | null;
  height: number | null;
}> = [
  { value: "small", label: "Small (30 x 30)", width: 30, height: 30 },
  { value: "medium", label: "Medium (500 x 500)", width: 500, height: 500 },
  { value: "large", label: "Large (2000 x 2000)", width: 2000, height: 2000 },
  { value: "custom", label: "Custom Size", width: null, height: null },
];
const MAP_TYPES: DesignerPlayableMapType[] = [
  "grassland",
  "sea",
  "undersea",
  "cave",
  "interior",
  "desert",
  "forest",
  "snow",
  "island",
  "mountain",
  "swamp",
  "volcanic",
  "ruins",
  "city",
];

function normalizeMapDimension(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? String(Math.max(1, Math.round(parsedValue)))
    : "";
}

function parseMapDimension(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.max(1, Math.round(parsedValue))
    : null;
}

function parseMapCoordinate(value: string) {
  const parsedValue = Number.parseInt(value, 10);

  return Number.isFinite(parsedValue) ? Math.round(parsedValue) : 0;
}

function formatMapTypeLabel(value: DesignerPlayableMapType) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMapFrameSrc() {
  if (typeof window === "undefined") {
    return "/#/map";
  }

  return `${window.location.pathname}${window.location.search}#/map`;
}

function normalizeBackgroundColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_MAP_BACKGROUND_COLOR;
}

function normalizePlayableMapConfig(
  config: Partial<DesignerPlayableMapConfig> | undefined,
  regionNames: string[]
): DesignerPlayableMapConfig {
  return {
    cellSize:
      typeof config?.cellSize === "number" &&
      MAP_CELL_SIZE_OPTIONS.includes(config.cellSize as 8 | 16 | 32 | 64 | 128)
        ? config.cellSize
        : 32,
    sizePreset: config?.sizePreset ?? "medium",
    width:
      typeof config?.width === "number" && Number.isFinite(config.width) && config.width > 0
        ? Math.max(1, Math.round(config.width))
        : 500,
    height:
      typeof config?.height === "number" && Number.isFinite(config.height) && config.height > 0
        ? Math.max(1, Math.round(config.height))
        : 500,
    regionName:
      typeof config?.regionName === "string" && config.regionName.trim()
        ? config.regionName.trim()
        : regionNames[0] ?? "",
    regionX:
      typeof config?.regionX === "number" && Number.isFinite(config.regionX)
        ? Math.round(config.regionX)
        : 0,
    regionY:
      typeof config?.regionY === "number" && Number.isFinite(config.regionY)
        ? Math.round(config.regionY)
        : 0,
    mapType: config?.mapType ?? "grassland",
    backgroundColor: normalizeBackgroundColor(config?.backgroundColor ?? ""),
    backgroundImageSrc:
      typeof config?.backgroundImageSrc === "string" ? config.backgroundImageSrc : "",
    backgroundImageMode: MAP_BACKGROUND_IMAGE_MODES.includes(
      config?.backgroundImageMode as DesignerPlayableMapBackgroundImageMode
    )
      ? (config?.backgroundImageMode as DesignerPlayableMapBackgroundImageMode)
      : DEFAULT_MAP_BACKGROUND_IMAGE_MODE,
  };
}

function getMapSurfaceBackgroundStyle(config: DesignerPlayableMapConfig): React.CSSProperties {
  const backgroundColor = normalizeBackgroundColor(config.backgroundColor);

  if (!config.backgroundImageSrc) {
    return {
      backgroundColor,
    };
  }

  if (config.backgroundImageMode === "centered") {
    return {
      backgroundColor,
      backgroundImage: `url("${config.backgroundImageSrc}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "auto",
    };
  }

  if (config.backgroundImageMode === "stretched") {
    return {
      backgroundColor,
      backgroundImage: `url("${config.backgroundImageSrc}")`,
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      backgroundSize: "100% 100%",
    };
  }

  return {
    backgroundColor,
    backgroundImage: `url("${config.backgroundImageSrc}")`,
    backgroundPosition: "top left",
    backgroundRepeat: "repeat",
    backgroundSize: "auto",
  };
}

function readBackgroundImage(
  event: React.ChangeEvent<HTMLInputElement>,
  onImageChange: (value: string) => void
) {
  const file = event.target.files?.[0];

  if (!file) {
    onImageChange("");
    return;
  }

  if (!file.type.startsWith("image/")) {
    window.alert("Please upload an image file for the map background.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    if (typeof reader.result === "string") {
      onImageChange(reader.result);
    }
  };

  reader.readAsDataURL(file);
}

type MapEditorCursorOverlayProps = {
  cellSize: number;
  width: number;
  height: number;
};

function MapEditorCursorOverlay({
  cellSize,
  width,
  height,
}: MapEditorCursorOverlayProps) {
  const [cursorPosition, setCursorPosition] = useState<{
    left: number;
    top: number;
    visible: boolean;
  }>({
    left: 0,
    top: 0,
    visible: false,
  });

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = Math.max(0, Math.min(event.clientX - bounds.left, width - 1));
    const localY = Math.max(0, Math.min(event.clientY - bounds.top, height - 1));
    const snappedX = Math.floor(localX / cellSize) * cellSize;
    const snappedY = Math.floor(localY / cellSize) * cellSize;

    setCursorPosition({
      left: snappedX,
      top: snappedY,
      visible: true,
    });
  };

  return (
    <Box
      position="absolute"
      inset={0}
      onPointerMove={handlePointerMove}
      onPointerLeave={() =>
        setCursorPosition((currentPosition) => ({
          ...currentPosition,
          visible: false,
        }))
      }
      cursor="crosshair"
      zIndex={1}
    >
      {cursorPosition.visible ? (
        <>
          <style>
            {`
              @keyframes map-editor-cursor-blink {
                0%, 100% {
                  border-color: #ffffff;
                  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.85);
                }
                50% {
                  border-color: #000000;
                  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.9);
                }
              }
            `}
          </style>
          <Box
            position="absolute"
            left={`${cursorPosition.left}px`}
            top={`${cursorPosition.top}px`}
            width={`${cellSize}px`}
            height={`${cellSize}px`}
            border="2px solid #ffffff"
            boxSizing="border-box"
            bg="rgba(255, 255, 255, 0.08)"
            pointerEvents="none"
            animation="map-editor-cursor-blink 0.8s steps(1, end) infinite"
          />
          <Box
            position="absolute"
            left={`${Math.min(cursorPosition.left + 8, Math.max(8, width - 184))}px`}
            top={`${Math.max(8, cursorPosition.top - 38)}px`}
            px={2.5}
            py={1}
            borderRadius="full"
            bg="rgba(15, 23, 12, 0.86)"
            color="white"
            fontSize="xs"
            fontWeight="700"
            lineHeight="shorter"
            pointerEvents="none"
            whiteSpace="nowrap"
          >
            X {cursorPosition.left / cellSize}, Y {cursorPosition.top / cellSize}
          </Box>
        </>
      ) : null}
    </Box>
  );
}

function loadRegionNames() {
  const fallback = designerSectionsByKey.regions.demoItems.map((item) => item.name);

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(REGION_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;
    const regionNames = Array.isArray(parsed.items)
      ? parsed.items
          .map((item) => (typeof item?.name === "string" ? item.name.trim() : ""))
          .filter(Boolean)
      : [];

    return regionNames.length > 0 ? regionNames : fallback;
  } catch {
    return fallback;
  }
}

function loadMapsState() {
  const fallback: DesignerSectionState = {
    categories: designerSectionsByKey.mapsEditor.defaultCategories,
    items: designerSectionsByKey.mapsEditor.demoItems,
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<DesignerSectionState>;

    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.items)) {
      return fallback;
    }

    return {
      categories: parsed.categories.filter(
        (category): category is string => typeof category === "string"
      ),
      items: parsed.items.filter(
        (item): item is DesignerItemSeed =>
          typeof item?.id === "string" &&
          typeof item?.name === "string" &&
          typeof item?.category === "string" &&
          Array.isArray(item?.details)
      ),
    };
  } catch {
    return fallback;
  }
}

function saveMapsState(nextState: DesignerSectionState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

export default function MapEditorPage() {
  const { mapId = "" } = useParams();
  const toast = useToast();
  const regionNames = useMemo(() => loadRegionNames(), []);
  const [mapsState, setMapsState] = useState<DesignerSectionState>(() => loadMapsState());
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);

  const mapItem = useMemo(
    () =>
      mapsState.items.find((item) => item.id === mapId) ??
      designerSectionsByKey.mapsEditor.demoItems.find((item) => item.id === mapId) ??
      null,
    [mapId, mapsState.items]
  );

  const initialConfig = useMemo(
    () =>
      normalizePlayableMapConfig(mapItem?.playableMapConfig, regionNames),
    [mapItem, regionNames]
  );

  const editorFrameSrc = useMemo(() => buildMapFrameSrc(), []);

  const [cellSize, setCellSize] = useState(String(initialConfig.cellSize));
  const [mapName, setMapName] = useState(mapItem?.name ?? "");
  const [sizePreset, setSizePreset] = useState<DesignerMapSizePreset>(initialConfig.sizePreset);
  const [customWidth, setCustomWidth] = useState(String(initialConfig.width));
  const [customHeight, setCustomHeight] = useState(String(initialConfig.height));
  const [regionName, setRegionName] = useState(initialConfig.regionName);
  const [regionX, setRegionX] = useState(String(initialConfig.regionX));
  const [regionY, setRegionY] = useState(String(initialConfig.regionY));
  const [mapType, setMapType] = useState<DesignerPlayableMapType>(initialConfig.mapType);
  const [backgroundColor, setBackgroundColor] = useState(initialConfig.backgroundColor);
  const [backgroundImageSrc, setBackgroundImageSrc] = useState(
    initialConfig.backgroundImageSrc
  );
  const [backgroundImageMode, setBackgroundImageMode] =
    useState<DesignerPlayableMapBackgroundImageMode>(initialConfig.backgroundImageMode);

  useEffect(() => {
    const nextConfig = normalizePlayableMapConfig(mapItem?.playableMapConfig, regionNames);

    setMapName(mapItem?.name ?? "");
    setCellSize(String(nextConfig.cellSize));
    setSizePreset(nextConfig.sizePreset);
    setCustomWidth(String(nextConfig.width));
    setCustomHeight(String(nextConfig.height));
    setRegionName(nextConfig.regionName);
    setRegionX(String(nextConfig.regionX));
    setRegionY(String(nextConfig.regionY));
    setMapType(nextConfig.mapType);
    setBackgroundColor(nextConfig.backgroundColor);
    setBackgroundImageSrc(nextConfig.backgroundImageSrc);
    setBackgroundImageMode(nextConfig.backgroundImageMode);
  }, [initialConfig, mapItem, regionNames]);

  const resolvedDimensions = useMemo(() => {
    const selectedPreset = MAP_SIZE_OPTIONS.find((option) => option.value === sizePreset);

    if (sizePreset !== "custom") {
      return {
        width: selectedPreset?.width ?? 500,
        height: selectedPreset?.height ?? 500,
      };
    }

    return {
      width: parseMapDimension(customWidth),
      height: parseMapDimension(customHeight),
    };
  }, [customHeight, customWidth, sizePreset]);

  const previewConfig = normalizePlayableMapConfig(mapItem?.playableMapConfig, regionNames);
  const mapPixelWidth = previewConfig.width * previewConfig.cellSize;
  const mapPixelHeight = previewConfig.height * previewConfig.cellSize;
  const mapSurfaceBackgroundStyle = getMapSurfaceBackgroundStyle(previewConfig);

  const isValidProperties =
    MAP_CELL_SIZE_OPTIONS.includes(Number.parseInt(cellSize, 10) as 8 | 16 | 32 | 64 | 128) &&
    !!regionName &&
    resolvedDimensions.width !== null &&
    resolvedDimensions.height !== null;

  const handleToolbarSave = () => {
    toast({
      title: "Map tile save will be added with the editor canvas.",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
  };

  const handleSaveProperties = () => {
    if (
      !mapItem ||
      !mapName.trim() ||
      !isValidProperties ||
      resolvedDimensions.width === null ||
      resolvedDimensions.height === null
    ) {
      return;
    }

    const nextConfig: DesignerPlayableMapConfig = {
      cellSize: Number.parseInt(cellSize, 10),
      sizePreset,
      width: resolvedDimensions.width,
      height: resolvedDimensions.height,
      regionName,
      regionX: parseMapCoordinate(regionX),
      regionY: parseMapCoordinate(regionY),
      mapType,
      backgroundColor: normalizeBackgroundColor(backgroundColor),
      backgroundImageSrc,
      backgroundImageMode,
    };

    const nextState: DesignerSectionState = {
      ...mapsState,
      items: mapsState.items.map((item) =>
        item.id === mapItem.id
          ? {
              ...item,
              name: mapName.trim(),
              details: designerSectionsByKey.mapsEditor.createDetails(
                mapName.trim(),
                item.category,
                1,
                { playableMapConfig: nextConfig }
              ),
              playableMapConfig: nextConfig,
            }
          : item
      ),
    };

    setMapsState(nextState);
    saveMapsState(nextState);
    setIsPropertiesOpen(false);
    toast({
      title: "Map properties saved.",
      status: "success",
      duration: 3000,
      isClosable: true,
      position: "top",
    });
  };

  if (!mapItem) {
    return (
      <Box minH="100vh" bg="#f7f7f7" px={6} py={8}>
        <Heading size="md" color="#233127" mb={4}>
          Map not found
        </Heading>
        <Button as={RouterLink} to="/designer/maps-editor" colorScheme="green" variant="outline">
          Back
        </Button>
      </Box>
    );
  }

  return (
    <Box minH="100vh" bg="#ffffff">
      <Flex
        position="sticky"
        top={0}
        zIndex={2}
        justify="space-between"
        align="center"
        gap={4}
        px={{ base: 4, md: 6 }}
        py={4}
        bg="rgba(255,255,255,0.96)"
        borderBottom="1px solid rgba(35, 49, 39, 0.12)"
        backdropFilter="blur(10px)"
      >
        <Box>
          <Text
            fontSize="xs"
            fontWeight="700"
            textTransform="uppercase"
            letterSpacing="0.16em"
            color="#5e7a61"
            mb={1}
          >
            Map Editor
          </Text>
          <Heading size="md" color="#233127">
            {mapName || mapItem.name}
          </Heading>
        </Box>
        <Flex wrap="wrap" gap={3}>
          <Button onClick={handleToolbarSave} colorScheme="green">
            Save
          </Button>
          <Button
            variant="outline"
            borderColor="rgba(43, 66, 47, 0.24)"
            color="#2e5b37"
            onClick={() => setIsPropertiesOpen(true)}
          >
            Edit Map Properties
          </Button>
          <Button
            as={RouterLink}
            to="/designer/maps-editor"
            variant="outline"
            borderColor="rgba(43, 66, 47, 0.24)"
            color="#2e5b37"
          >
            Back
          </Button>
        </Flex>
      </Flex>

      <Box px={{ base: 4, md: 6 }} py={6}>
        <Box
          minH="calc(100vh - 120px)"
          borderRadius="24px"
          border="1px solid rgba(35, 49, 39, 0.08)"
          bg="#f8faf7"
          overflow="hidden"
        >
          <Flex
            justify="space-between"
            align={{ base: "flex-start", lg: "center" }}
            direction={{ base: "column", lg: "row" }}
            gap={3}
            px={{ base: 4, md: 5 }}
            py={4}
            borderBottom="1px solid rgba(35, 49, 39, 0.08)"
            bg="#ffffff"
          >
            <Box>
              <Text
                fontSize="xs"
                fontWeight="700"
                textTransform="uppercase"
                letterSpacing="0.14em"
                color="#5e7a61"
                mb={1}
              >
                Map Surface
              </Text>
              <Text fontSize="sm" color="#314636">
                {previewConfig.width} x {previewConfig.height} cells at {previewConfig.cellSize}px
                each, rendered as {mapPixelWidth} x {mapPixelHeight}px.
              </Text>
            </Box>
            <Text fontSize="sm" color="#4d6652">
              Tile tool preview snaps to the active cell size. Background uses saved map properties.
            </Text>
          </Flex>

          <Box p={{ base: 4, md: 5 }}>
            <Box
              borderRadius="20px"
              border="1px solid rgba(35, 49, 39, 0.12)"
              bg="#eef3ec"
              p={3}
              overflow="auto"
              maxH="calc(100vh - 240px)"
            >
              <Box
                position="relative"
                width={`${mapPixelWidth}px`}
                height={`${mapPixelHeight}px`}
                minWidth="100%"
                sx={mapSurfaceBackgroundStyle}
                boxShadow="0 18px 50px rgba(24, 34, 20, 0.18)"
                overflow="hidden"
              >
                <Box
                  as="iframe"
                  title={`${mapName || mapItem.name} map preview`}
                  src={editorFrameSrc}
                  width={`${mapPixelWidth}px`}
                  height={`${mapPixelHeight}px`}
                  border="0"
                  display="block"
                  loading="lazy"
                  bg="transparent"
                />
                <MapEditorCursorOverlay
                  cellSize={previewConfig.cellSize}
                  width={mapPixelWidth}
                  height={mapPixelHeight}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      <Modal
        isOpen={isPropertiesOpen}
        onClose={() => setIsPropertiesOpen(false)}
        size="3xl"
        scrollBehavior="inside"
      >
        <ModalOverlay bg="blackAlpha.400" />
        <ModalContent
          borderRadius="24px"
          bg="#fffdf8"
          overflow="hidden"
          maxH="calc(100vh - 2rem)"
          boxShadow="0 28px 70px rgba(24, 34, 20, 0.24)"
        >
          <ModalHeader bg="#fffdf8" borderBottom="1px solid rgba(43, 66, 47, 0.08)">
            Edit Map Properties
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody bg="#fffdf8" overflowY="auto">
            <Stack spacing={4}>
              <FormControl isRequired>
                <FormLabel>Name</FormLabel>
                <Input value={mapName} onChange={(event) => setMapName(event.target.value)} />
              </FormControl>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Cell Size</FormLabel>
                  <Select value={cellSize} onChange={(event) => setCellSize(event.target.value)}>
                    {MAP_CELL_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Map Size</FormLabel>
                  <Select
                    value={sizePreset}
                    onChange={(event) =>
                      setSizePreset(event.target.value as DesignerMapSizePreset)
                    }
                  >
                    {MAP_SIZE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>
              {sizePreset === "custom" ? (
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl isRequired isInvalid={customWidth !== "" && parseMapDimension(customWidth) === null}>
                    <FormLabel>Custom Width</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={customWidth}
                      onChange={(event) =>
                        setCustomWidth(normalizeMapDimension(event.target.value))
                      }
                    />
                  </FormControl>
                  <FormControl isRequired isInvalid={customHeight !== "" && parseMapDimension(customHeight) === null}>
                    <FormLabel>Custom Height</FormLabel>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={customHeight}
                      onChange={(event) =>
                        setCustomHeight(normalizeMapDimension(event.target.value))
                      }
                    />
                  </FormControl>
                </SimpleGrid>
              ) : null}
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Region</FormLabel>
                  <Select
                    value={regionName}
                    onChange={(event) => setRegionName(event.target.value)}
                  >
                    {regionNames.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </Select>
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Map Type</FormLabel>
                  <Select
                    value={mapType}
                    onChange={(event) =>
                      setMapType(event.target.value as DesignerPlayableMapType)
                    }
                  >
                    {MAP_TYPES.map((option) => (
                      <option key={option} value={option}>
                        {formatMapTypeLabel(option)}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl>
                  <FormLabel>Region X Position</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={regionX}
                    onChange={(event) => setRegionX(event.target.value)}
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Region Y Position</FormLabel>
                  <Input
                    type="number"
                    step={1}
                    value={regionY}
                    onChange={(event) => setRegionY(event.target.value)}
                  />
                </FormControl>
              </SimpleGrid>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <FormControl isRequired>
                  <FormLabel>Background Color</FormLabel>
                  <Input
                    type="color"
                    value={normalizeBackgroundColor(backgroundColor)}
                    onChange={(event) => setBackgroundColor(event.target.value)}
                    p={1}
                    h="44px"
                  />
                </FormControl>
                <FormControl>
                  <FormLabel>Background Image</FormLabel>
                  <Input
                    type="file"
                    accept="image/*"
                    p={1}
                    onChange={(event) => readBackgroundImage(event, setBackgroundImageSrc)}
                  />
                </FormControl>
              </SimpleGrid>
              {backgroundImageSrc ? (
                <FormControl>
                  <FormLabel>Background Image Mode</FormLabel>
                  <Select
                    value={backgroundImageMode}
                    onChange={(event) =>
                      setBackgroundImageMode(
                        event.target.value as DesignerPlayableMapBackgroundImageMode
                      )
                    }
                  >
                    {MAP_BACKGROUND_IMAGE_MODES.map((option) => (
                      <option key={option} value={option}>
                        {option === "centered"
                          ? "Centered"
                          : option === "stretched"
                            ? "Stretched"
                            : "Repeat"}
                      </option>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              <Flex justify="space-between" align={{ base: "flex-start", md: "center" }} gap={3} wrap="wrap">
                <Text fontSize="sm" color="#55645a">
                  The saved background fills the map editor surface automatically.
                </Text>
                {backgroundImageSrc ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBackgroundImageSrc("")}
                  >
                    Remove Background Image
                  </Button>
                ) : null}
              </Flex>
              <Box
                minH="140px"
                borderRadius="18px"
                border="1px solid rgba(43, 66, 47, 0.12)"
                sx={getMapSurfaceBackgroundStyle({
                  ...initialConfig,
                  backgroundColor,
                  backgroundImageSrc,
                  backgroundImageMode,
                })}
              />
            </Stack>
          </ModalBody>
          <ModalFooter
            gap={3}
            bg="#fffdf8"
            borderTop="1px solid rgba(43, 66, 47, 0.08)"
          >
            <Button variant="ghost" onClick={() => setIsPropertiesOpen(false)}>
              Cancel
            </Button>
            <Button
              colorScheme="green"
              onClick={handleSaveProperties}
              isDisabled={!mapName.trim() || !isValidProperties}
            >
              Save Properties
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
