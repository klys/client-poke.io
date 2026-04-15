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
      mapItem?.playableMapConfig ?? {
        cellSize: 32,
        sizePreset: "medium" as DesignerMapSizePreset,
        width: 500,
        height: 500,
        regionName: regionNames[0] ?? "",
        regionX: 0,
        regionY: 0,
        mapType: "grassland" as DesignerPlayableMapType,
      },
    [mapItem, regionNames]
  );

  const [cellSize, setCellSize] = useState(String(initialConfig.cellSize));
  const [mapName, setMapName] = useState(mapItem?.name ?? "");
  const [sizePreset, setSizePreset] = useState<DesignerMapSizePreset>(initialConfig.sizePreset);
  const [customWidth, setCustomWidth] = useState(String(initialConfig.width));
  const [customHeight, setCustomHeight] = useState(String(initialConfig.height));
  const [regionName, setRegionName] = useState(initialConfig.regionName);
  const [regionX, setRegionX] = useState(String(initialConfig.regionX));
  const [regionY, setRegionY] = useState(String(initialConfig.regionY));
  const [mapType, setMapType] = useState<DesignerPlayableMapType>(initialConfig.mapType);

  useEffect(() => {
    const nextConfig = mapItem?.playableMapConfig ?? initialConfig;

    setMapName(mapItem?.name ?? "");
    setCellSize(String(nextConfig.cellSize));
    setSizePreset(nextConfig.sizePreset);
    setCustomWidth(String(nextConfig.width));
    setCustomHeight(String(nextConfig.height));
    setRegionName(nextConfig.regionName);
    setRegionX(String(nextConfig.regionX));
    setRegionY(String(nextConfig.regionY));
    setMapType(nextConfig.mapType);
  }, [initialConfig, mapItem]);

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
          bg="#ffffff"
        />
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
