import React, { useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Button,
  Checkbox,
  Flex,
  FormControl,
  FormLabel,
  IconButton,
  Image,
  Input,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Select,
  SimpleGrid,
  Text,
  Textarea,
} from "@chakra-ui/react";
import type { DesignerSectionKey } from "../designerSections";
import { readStoredDesignerSectionPayload } from "../designerCache";
import { ensureDesignerSectionOverHttp } from "../designerSectionHttp";
import { resolveServerAssetUrl } from "../../tilemap/serverAssets";

// Schema-driven property editor for the "migration profile" sections
// (abilities, types, trainers, trainer types, encounters, berries, ribbons,
// assets, battle backgrounds, audio, fonts). It edits the same JSON string the
// section framework already stores in MigrationProfileFormState, so the
// add/edit/save plumbing is untouched: every field change merges into the
// parsed object and re-serializes, preserving keys the form does not know
// about (source provenance, importer metadata, ...).

type MigrationFormState = { profileJson: string };
type FormDispatch = React.Dispatch<React.SetStateAction<MigrationFormState>>;
type ProfileObject = Record<string, unknown>;

type FieldKind =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "stringList"
  | "typeList"
  | "speciesText"
  | "imagePath"
  | "audioPath"
  | "fontPath"
  | "badgeIcon"
  | "party"
  | "encounterTables"
  | "regionPoints";

type FieldSpec = {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
  placeholder?: string;
  help?: string;
};

const GENDER_OPTIONS = ["Male", "Female", "Mixed", "Unknown"];
const ENCOUNTER_METHOD_OPTIONS = [
  "Land",
  "LandDay",
  "LandNight",
  "Cave",
  "Water",
  "RockSmash",
  "OldRod",
  "GoodRod",
  "SuperRod",
  "HeadbuttLow",
  "HeadbuttHigh",
];

export const MIGRATION_PROFILE_FIELD_SPECS: Partial<
  Record<DesignerSectionKey, FieldSpec[]>
> = {
  regions: [
    { key: "imageSrc", label: "Region map image", kind: "imagePath", placeholder: "/townmap/mapRegion0.png" },
    { key: "gridSize", label: "Grid size (px)", kind: "number", help: "Town map grid square size; the classic town map uses 16px." },
    { key: "points", label: "Map points", kind: "regionPoints" },
  ],
  abilities: [
    { key: "essentialsId", label: "Essentials ID", kind: "text", placeholder: "STENCH" },
    { key: "name", label: "Name", kind: "text" },
    { key: "description", label: "Description", kind: "textarea" },
  ],
  types: [
    { key: "essentialsId", label: "Essentials ID", kind: "text", placeholder: "DRAGON" },
    { key: "name", label: "Name", kind: "text" },
    { key: "iconPosition", label: "Icon position", kind: "number" },
    { key: "weaknesses", label: "Weaknesses", kind: "typeList" },
    { key: "resistances", label: "Resistances", kind: "typeList" },
    { key: "immunities", label: "Immunities", kind: "typeList" },
  ],
  trainers: [
    { key: "essentialsId", label: "Essentials ID", kind: "text", placeholder: "RIVAL1/Blue" },
    { key: "name", label: "Trainer name", kind: "text" },
    { key: "trainerTypeEssentialsId", label: "Trainer type (Essentials ID)", kind: "text", placeholder: "RIVAL1" },
    { key: "trainerTypeName", label: "Trainer type display name", kind: "text" },
    { key: "version", label: "Version", kind: "number", help: "Trainer variant number; 0 when there is only one battle." },
    { key: "party", label: "Party", kind: "party" },
    { key: "items", label: "Battle items", kind: "stringList", placeholder: "SUPERPOTION, FULLHEAL" },
    { key: "loseText", label: "Lose text", kind: "textarea" },
    { key: "battleBgm", label: "Battle BGM", kind: "text" },
    { key: "victoryMe", label: "Victory ME", kind: "text" },
  ],
  trainerTypes: [
    { key: "essentialsId", label: "Essentials ID", kind: "text", placeholder: "LEADER_Pegaso" },
    { key: "name", label: "Name", kind: "text" },
    { key: "baseMoney", label: "Base money", kind: "number" },
    { key: "gender", label: "Gender", kind: "select", options: GENDER_OPTIONS },
    { key: "skillLevel", label: "Skill level", kind: "number" },
    { key: "battleBgm", label: "Battle BGM", kind: "text" },
    { key: "victoryMe", label: "Victory ME", kind: "text" },
    { key: "introMe", label: "Intro ME", kind: "text" },
    { key: "flags", label: "Flags", kind: "stringList" },
  ],
  encounters: [
    { key: "mapId", label: "Source map ID", kind: "text", placeholder: "012" },
    { key: "mapName", label: "Map name", kind: "text" },
    { key: "tables", label: "Encounter tables", kind: "encounterTables" },
  ],
  berries: [
    { key: "essentialsId", label: "Essentials ID", kind: "text", placeholder: "CHERIBERRY" },
    { key: "hoursPerStage", label: "Hours per growth stage", kind: "number" },
    { key: "dryRatePerHour", label: "Drying per hour", kind: "number" },
    { key: "minimumYield", label: "Minimum yield", kind: "number" },
    { key: "maximumYield", label: "Maximum yield", kind: "number" },
  ],
  ribbons: [
    { key: "essentialsId", label: "Badge ID", kind: "text", placeholder: "MEDALLACEFIRO" },
    { key: "name", label: "Name", kind: "text" },
    { key: "description", label: "Description", kind: "textarea" },
    { key: "iconPosition", label: "Badge icon (0-7)", kind: "badgeIcon", help: "Index into the published badge sheet (badge-N.png on the asset server)." },
  ],
  assets: [
    { key: "assetId", label: "Asset ID", kind: "text" },
    { key: "sourcePath", label: "Source path", kind: "imagePath", placeholder: "/migration_exports/..." },
    { key: "kind", label: "Kind", kind: "select", options: ["image", "gif", "sheet", "battleback", "icon"] },
    { key: "width", label: "Width (px)", kind: "number" },
    { key: "height", label: "Height (px)", kind: "number" },
    { key: "mimeType", label: "MIME type", kind: "text" },
    { key: "frameCount", label: "Frame count", kind: "number" },
    { key: "loop", label: "Loops", kind: "boolean" },
  ],
  battleBackgrounds: [
    { key: "assetId", label: "Asset ID", kind: "text" },
    { key: "sourcePath", label: "Background image", kind: "imagePath", placeholder: "/migration_exports/battlebacks/cave_bg.png" },
    { key: "playerBaseSrc", label: "Player base image", kind: "imagePath" },
    { key: "enemyBaseSrc", label: "Enemy base image", kind: "imagePath" },
    { key: "environment", label: "Environment", kind: "text", placeholder: "cave" },
    { key: "mapIds", label: "Linked map IDs", kind: "stringList" },
  ],
  audio: [
    { key: "assetId", label: "Asset ID", kind: "text" },
    { key: "sourcePath", label: "Audio file", kind: "audioPath", placeholder: "/migration_exports/audio/bgm/..." },
    { key: "kind", label: "Kind", kind: "select", options: ["BGM", "BGS", "ME", "SE"] },
    { key: "loop", label: "Loops", kind: "boolean" },
    { key: "volume", label: "Volume (0-100)", kind: "number" },
    { key: "pitch", label: "Pitch (%)", kind: "number" },
  ],
  fonts: [
    { key: "assetId", label: "Asset ID", kind: "text" },
    { key: "sourcePath", label: "Font file", kind: "fontPath", placeholder: "/fonts/pkmndp.ttf" },
    { key: "familyName", label: "Font family name", kind: "text", placeholder: "Pokemon DP" },
  ],
};

function parseProfile(json: string): ProfileObject | null {
  try {
    const parsed = JSON.parse(json);

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as ProfileObject)
      : null;
  } catch {
    return null;
  }
}

function readString(profile: ProfileObject, key: string) {
  const value = profile[key];

  return typeof value === "string" ? value : "";
}

function readNumber(profile: ProfileObject, key: string) {
  const value = profile[key];

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringArray(profile: ProfileObject, key: string): string[] {
  const value = profile[key];

  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

type PartyEntry = {
  pokemonId?: string;
  speciesEssentialsId?: string;
  level?: number;
  [key: string]: unknown;
};

type EncounterRow = {
  weight?: number;
  pokemonId?: string;
  speciesEssentialsId?: string;
  minLevel?: number;
  maxLevel?: number;
  [key: string]: unknown;
};

type EncounterTable = {
  method?: string;
  density?: number;
  rows?: EncounterRow[];
  [key: string]: unknown;
};

function useCatalogOptions(sectionKey: "pokemons" | "types") {
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const readOptions = () => {
      const items = readStoredDesignerSectionPayload(sectionKey).state.items;
      const ids = items
        .map((item) => {
          const profile = (item as unknown as ProfileObject)[
            sectionKey === "pokemons" ? "pokemonProfile" : "typeProfile"
          ] as ProfileObject | undefined;
          const essentialsId =
            profile && typeof profile.essentialsId === "string"
              ? profile.essentialsId
              : null;

          if (essentialsId) {
            return essentialsId;
          }

          const prefix = sectionKey === "pokemons" ? "pokemon-" : "type-";
          return item.id.startsWith(prefix) ? item.id.slice(prefix.length) : item.name;
        })
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      if (!cancelled) {
        setOptions(Array.from(new Set(ids)));
      }
    };

    readOptions();
    void ensureDesignerSectionOverHttp(sectionKey).then(readOptions);

    return () => {
      cancelled = true;
    };
  }, [sectionKey]);

  return options;
}

function TypeListField({
  label,
  values,
  typeOptions,
  onChange,
}: {
  label: string;
  values: string[];
  typeOptions: string[];
  onChange: (next: string[]) => void;
}) {
  const knownSelected = new Set(values);

  return (
    <FormControl>
      <FormLabel fontSize="sm">{label}</FormLabel>
      {typeOptions.length > 0 ? (
        <Flex wrap="wrap" gap={1.5} mb={2}>
          {typeOptions.map((typeId) => {
            const isSelected = knownSelected.has(typeId);

            return (
              <Button
                key={typeId}
                size="xs"
                variant={isSelected ? "solid" : "outline"}
                colorScheme={isSelected ? "green" : "gray"}
                onClick={() =>
                  onChange(
                    isSelected
                      ? values.filter((value) => value !== typeId)
                      : [...values, typeId]
                  )
                }
              >
                {typeId}
              </Button>
            );
          })}
        </Flex>
      ) : null}
      <Input
        size="sm"
        value={values.join(", ")}
        placeholder="Comma-separated type IDs"
        onChange={(event) =>
          onChange(
            event.target.value
              .split(",")
              .map((entry) => entry.trim().toUpperCase())
              .filter((entry) => entry.length > 0)
          )
        }
      />
    </FormControl>
  );
}

function PartyField({
  values,
  speciesOptions,
  datalistId,
  onChange,
}: {
  values: PartyEntry[];
  speciesOptions: string[];
  datalistId: string;
  onChange: (next: PartyEntry[]) => void;
}) {
  return (
    <FormControl>
      <FormLabel fontSize="sm">Party ({values.length})</FormLabel>
      <datalist id={datalistId}>
        {speciesOptions.map((species) => (
          <option key={species} value={species} />
        ))}
      </datalist>
      {values.map((entry, index) => (
        <Flex key={index} gap={2} mb={2} align="center">
          <Input
            size="sm"
            flex="1"
            list={datalistId}
            value={entry.speciesEssentialsId ?? ""}
            placeholder="Species (Essentials ID)"
            onChange={(event) => {
              const species = event.target.value.trim().toUpperCase();
              const next = [...values];
              next[index] = {
                ...entry,
                speciesEssentialsId: species,
                pokemonId: species ? `pokemon-${species}` : entry.pokemonId,
              };
              onChange(next);
            }}
          />
          <NumberInput
            size="sm"
            width="110px"
            min={1}
            max={100}
            value={entry.level ?? 1}
            onChange={(_, value) => {
              const next = [...values];
              next[index] = { ...entry, level: Number.isFinite(value) ? value : 1 };
              onChange(next);
            }}
          >
            <NumberInputField placeholder="Lv" />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>
          <IconButton
            aria-label="Remove party member"
            size="sm"
            variant="outline"
            colorScheme="red"
            icon={<span>✕</span>}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          />
        </Flex>
      ))}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...values, { speciesEssentialsId: "", level: 5 }])}
        isDisabled={values.length >= 6}
      >
        Add party member
      </Button>
    </FormControl>
  );
}

function EncounterTablesField({
  values,
  speciesOptions,
  datalistId,
  onChange,
}: {
  values: EncounterTable[];
  speciesOptions: string[];
  datalistId: string;
  onChange: (next: EncounterTable[]) => void;
}) {
  const updateTable = (index: number, table: EncounterTable) => {
    const next = [...values];
    next[index] = table;
    onChange(next);
  };

  return (
    <FormControl>
      <FormLabel fontSize="sm">Encounter tables ({values.length})</FormLabel>
      <datalist id={datalistId}>
        {speciesOptions.map((species) => (
          <option key={species} value={species} />
        ))}
      </datalist>
      {values.map((table, tableIndex) => {
        const rows = Array.isArray(table.rows) ? table.rows : [];

        return (
          <Box
            key={tableIndex}
            borderWidth="1px"
            borderRadius="10px"
            p={3}
            mb={3}
            bg="rgba(237, 244, 234, 0.4)"
          >
            <Flex gap={2} mb={2} align="center">
              <Select
                size="sm"
                width="180px"
                value={table.method ?? "Land"}
                onChange={(event) =>
                  updateTable(tableIndex, { ...table, method: event.target.value })
                }
              >
                {ENCOUNTER_METHOD_OPTIONS.concat(
                  table.method && !ENCOUNTER_METHOD_OPTIONS.includes(table.method)
                    ? [table.method]
                    : []
                ).map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </Select>
              <NumberInput
                size="sm"
                width="130px"
                min={0}
                value={table.density ?? 0}
                onChange={(_, value) =>
                  updateTable(tableIndex, {
                    ...table,
                    density: Number.isFinite(value) ? value : 0,
                  })
                }
              >
                <NumberInputField placeholder="Density" />
              </NumberInput>
              <Text fontSize="xs" color="gray.500">
                density
              </Text>
              <Box flex="1" />
              <Button
                size="xs"
                variant="outline"
                colorScheme="red"
                onClick={() => onChange(values.filter((_, i) => i !== tableIndex))}
              >
                Remove table
              </Button>
            </Flex>
            {rows.map((row, rowIndex) => {
              const updateRow = (nextRow: EncounterRow) => {
                const nextRows = [...rows];
                nextRows[rowIndex] = nextRow;
                updateTable(tableIndex, { ...table, rows: nextRows });
              };

              return (
                <Flex key={rowIndex} gap={2} mb={1.5} align="center">
                  <NumberInput
                    size="sm"
                    width="92px"
                    min={0}
                    value={row.weight ?? 0}
                    onChange={(_, value) =>
                      updateRow({ ...row, weight: Number.isFinite(value) ? value : 0 })
                    }
                  >
                    <NumberInputField placeholder="Weight" />
                  </NumberInput>
                  <Input
                    size="sm"
                    flex="1"
                    list={datalistId}
                    value={row.speciesEssentialsId ?? ""}
                    placeholder="Species"
                    onChange={(event) => {
                      const species = event.target.value.trim().toUpperCase();
                      updateRow({
                        ...row,
                        speciesEssentialsId: species,
                        pokemonId: species ? `pokemon-${species}` : row.pokemonId,
                      });
                    }}
                  />
                  <NumberInput
                    size="sm"
                    width="88px"
                    min={1}
                    max={100}
                    value={row.minLevel ?? 1}
                    onChange={(_, value) =>
                      updateRow({ ...row, minLevel: Number.isFinite(value) ? value : 1 })
                    }
                  >
                    <NumberInputField placeholder="Min" />
                  </NumberInput>
                  <NumberInput
                    size="sm"
                    width="88px"
                    min={1}
                    max={100}
                    value={row.maxLevel ?? 1}
                    onChange={(_, value) =>
                      updateRow({ ...row, maxLevel: Number.isFinite(value) ? value : 1 })
                    }
                  >
                    <NumberInputField placeholder="Max" />
                  </NumberInput>
                  <IconButton
                    aria-label="Remove encounter row"
                    size="sm"
                    variant="outline"
                    colorScheme="red"
                    icon={<span>✕</span>}
                    onClick={() =>
                      updateTable(tableIndex, {
                        ...table,
                        rows: rows.filter((_, i) => i !== rowIndex),
                      })
                    }
                  />
                </Flex>
              );
            })}
            <Button
              size="xs"
              variant="outline"
              mt={1}
              onClick={() =>
                updateTable(tableIndex, {
                  ...table,
                  rows: [
                    ...rows,
                    { weight: 10, speciesEssentialsId: "", minLevel: 2, maxLevel: 4 },
                  ],
                })
              }
            >
              Add slot
            </Button>
          </Box>
        );
      })}
      <Button
        size="sm"
        variant="outline"
        onClick={() => onChange([...values, { method: "Land", density: 25, rows: [] }])}
      >
        Add encounter table
      </Button>
    </FormControl>
  );
}

type RegionPoint = {
  gridX?: number;
  gridY?: number;
  name?: string;
  poi?: string;
  fly?: { mapId?: string; cellX?: number; cellY?: number };
  [key: string]: unknown;
};

// The same region map the player sees in the Map menu, with every town-map
// point overlaid. Click a marker to select it; click an empty grid square to
// move the selected point there. Fields below edit the selected point.
function RegionPointsField({
  imageSrc,
  gridSize,
  values,
  onChange,
}: {
  imageSrc: string;
  gridSize: number;
  values: RegionPoint[];
  onChange: (next: RegionPoint[]) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const grid = gridSize > 0 ? gridSize : 16;
  const selected = values[selectedIndex] ?? null;

  const updateSelected = (patch: Partial<RegionPoint>) => {
    if (!selected) {
      return;
    }

    const next = [...values];
    next[selectedIndex] = { ...selected, ...patch };
    onChange(next);
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const image = event.currentTarget.querySelector("img");

    if (!image) {
      return;
    }

    const scaleX = image.naturalWidth / bounds.width;
    const scaleY = image.naturalHeight / bounds.height;
    const gridX = Math.floor(((event.clientX - bounds.left) * scaleX) / grid);
    const gridY = Math.floor(((event.clientY - bounds.top) * scaleY) / grid);
    const hitIndex = values.findIndex(
      (point) => point.gridX === gridX && point.gridY === gridY
    );

    if (hitIndex >= 0) {
      setSelectedIndex(hitIndex);
    } else if (selected) {
      updateSelected({ gridX, gridY });
    }
  };

  return (
    <FormControl>
      <FormLabel fontSize="sm">Map points ({values.length})</FormLabel>
      {imageSrc ? (
        <Box
          position="relative"
          display="inline-block"
          borderWidth="1px"
          borderRadius="8px"
          overflow="hidden"
          cursor="crosshair"
          onClick={handleMapClick}
          mb={3}
          maxW="100%"
        >
          <Image
            src={resolveServerAssetUrl(imageSrc)}
            alt="Region map"
            display="block"
            maxW="100%"
            sx={{ imageRendering: "pixelated" }}
          />
          {values.map((point, index) => (
            <Box
              key={index}
              position="absolute"
              // Percentages so markers track the responsive image size. The
              // classic town map is 480x320 at 16px grid = 30x20 squares.
              left={`${(((point.gridX ?? 0) + 0.5) * grid * 100) / 480}%`}
              top={`${(((point.gridY ?? 0) + 0.5) * grid * 100) / 320}%`}
              transform="translate(-50%, -50%)"
              w="10px"
              h="10px"
              borderRadius="full"
              bg={index === selectedIndex ? "red.500" : point.fly ? "teal.400" : "yellow.400"}
              border="1.5px solid white"
              boxShadow="0 0 0 1px rgba(0,0,0,0.4)"
              title={point.name ?? ""}
              pointerEvents="none"
            />
          ))}
        </Box>
      ) : (
        <Text fontSize="xs" color="orange.600" mb={2}>
          Set the region map image to edit points visually.
        </Text>
      )}

      <Flex gap={2} mb={2} wrap="wrap" align="center">
        <Select
          size="sm"
          width="260px"
          value={selectedIndex}
          onChange={(event) => setSelectedIndex(Number(event.target.value))}
        >
          {values.map((point, index) => (
            <option key={index} value={index}>
              ({point.gridX},{point.gridY}) {point.name ?? "Unnamed"}
            </option>
          ))}
        </Select>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            onChange([...values, { gridX: 0, gridY: 0, name: "New location" }]);
            setSelectedIndex(values.length);
          }}
        >
          Add point
        </Button>
        <Button
          size="sm"
          variant="outline"
          colorScheme="red"
          isDisabled={!selected}
          onClick={() => {
            onChange(values.filter((_, i) => i !== selectedIndex));
            setSelectedIndex(0);
          }}
        >
          Remove selected
        </Button>
      </Flex>

      {selected ? (
        <SimpleGrid columns={{ base: 2, md: 4 }} spacingX={3} spacingY={2}>
          <FormControl>
            <FormLabel fontSize="xs">Name</FormLabel>
            <Input
              size="sm"
              value={selected.name ?? ""}
              onChange={(event) => updateSelected({ name: event.target.value })}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Point of interest</FormLabel>
            <Input
              size="sm"
              value={selected.poi ?? ""}
              onChange={(event) => updateSelected({ poi: event.target.value })}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Grid X</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              value={selected.gridX ?? 0}
              onChange={(_, value) =>
                updateSelected({ gridX: Number.isFinite(value) ? value : 0 })
              }
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Grid Y</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              value={selected.gridY ?? 0}
              onChange={(_, value) =>
                updateSelected({ gridY: Number.isFinite(value) ? value : 0 })
              }
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>
          <FormControl gridColumn={{ md: "1 / 3" }}>
            <FormLabel fontSize="xs">Fly landing map ID (empty = no fly)</FormLabel>
            <Input
              size="sm"
              value={selected.fly?.mapId ?? ""}
              placeholder="map-essentials-013"
              onChange={(event) => {
                const mapId = event.target.value.trim();
                updateSelected({
                  fly: mapId
                    ? { ...(selected.fly ?? { cellX: 0, cellY: 0 }), mapId }
                    : undefined,
                });
              }}
            />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Fly cell X</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              isDisabled={!selected.fly}
              value={selected.fly?.cellX ?? 0}
              onChange={(_, value) =>
                selected.fly &&
                updateSelected({
                  fly: { ...selected.fly, cellX: Number.isFinite(value) ? value : 0 },
                })
              }
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="xs">Fly cell Y</FormLabel>
            <NumberInput
              size="sm"
              min={0}
              isDisabled={!selected.fly}
              value={selected.fly?.cellY ?? 0}
              onChange={(_, value) =>
                selected.fly &&
                updateSelected({
                  fly: { ...selected.fly, cellY: Number.isFinite(value) ? value : 0 },
                })
              }
            >
              <NumberInputField />
            </NumberInput>
          </FormControl>
        </SimpleGrid>
      ) : (
        <Text fontSize="xs" color="gray.500">
          No point selected.
        </Text>
      )}
      <Text mt={2} fontSize="xs" color="gray.500">
        The game reads this data from the generated townMapData files — after editing here, run
        server tools/generateTownMapData.ts (or ask an engineer) to publish the changes to the
        runtime.
      </Text>
    </FormControl>
  );
}

function AudioPreview({ sourcePath }: { sourcePath: string }) {
  const resolved = resolveServerAssetUrl(sourcePath);
  const isPlayable = /\.(ogg|oga|wav|mp3|m4a|webm)(\?|$)/i.test(sourcePath);

  if (!sourcePath) {
    return null;
  }

  if (!isPlayable) {
    return (
      <Text mt={1} fontSize="xs" color="orange.600">
        This format cannot be previewed in the browser (MIDI and similar need conversion).
      </Text>
    );
  }

  return (
    <Box mt={2}>
      {/* key remounts the element when the path changes so the new file loads */}
      <audio key={resolved} controls preload="none" style={{ width: "100%", height: "36px" }}>
        <source src={resolved} />
      </audio>
    </Box>
  );
}

function ImagePathPreview({ sourcePath }: { sourcePath: string }) {
  if (!sourcePath) {
    return null;
  }

  return (
    <Box mt={2} borderWidth="1px" borderRadius="8px" p={2} maxW="280px" bg="white">
      <Image
        src={resolveServerAssetUrl(sourcePath)}
        alt="Asset preview"
        maxH="140px"
        objectFit="contain"
        fallback={
          <Text fontSize="xs" color="orange.600">
            Preview not available (file missing on the asset server).
          </Text>
        }
      />
    </Box>
  );
}

function FontPathPreview({ sourcePath, familyName }: { sourcePath: string; familyName: string }) {
  const [status, setStatus] = useState<"idle" | "loaded" | "error">("idle");
  const previewFamily = `designer-font-preview-${familyName.replace(/[^a-zA-Z0-9]/g, "-")}`;

  useEffect(() => {
    if (!sourcePath || typeof FontFace === "undefined") {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    const fontFace = new FontFace(previewFamily, `url(${resolveServerAssetUrl(sourcePath)})`);

    fontFace
      .load()
      .then((loaded) => {
        if (!cancelled) {
          document.fonts.add(loaded);
          setStatus("loaded");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [sourcePath, previewFamily]);

  if (!sourcePath) {
    return null;
  }

  if (status === "error") {
    return (
      <Text mt={1} fontSize="xs" color="orange.600">
        Font file could not be loaded from the asset server.
      </Text>
    );
  }

  return (
    <Box mt={2} borderWidth="1px" borderRadius="8px" p={3} bg="white">
      <Text fontFamily={status === "loaded" ? previewFamily : undefined} fontSize="lg">
        The quick brown Zubat jumps over the lazy Snorlax 0123456789
      </Text>
    </Box>
  );
}

export default function MigrationProfileEditor({
  sectionKey,
  formState,
  onFormChange,
}: {
  sectionKey: DesignerSectionKey;
  formState: MigrationFormState;
  onFormChange: FormDispatch;
}) {
  const specs = MIGRATION_PROFILE_FIELD_SPECS[sectionKey] ?? [];
  const profile = useMemo(() => parseProfile(formState.profileJson), [formState.profileJson]);
  const needsSpecies = specs.some(
    (spec) => spec.kind === "party" || spec.kind === "encounterTables"
  );
  const needsTypes = specs.some((spec) => spec.kind === "typeList");
  const speciesOptions = useCatalogOptions("pokemons");
  const typeOptions = useCatalogOptions("types");
  const datalistId = `species-options-${sectionKey}`;

  const setField = (key: string, value: unknown) => {
    onFormChange((current) => {
      const parsed = parseProfile(current.profileJson);

      if (!parsed) {
        return current;
      }

      return { profileJson: JSON.stringify({ ...parsed, [key]: value }, null, 2) };
    });
  };

  const renderField = (spec: FieldSpec) => {
    if (!profile) {
      return null;
    }

    switch (spec.kind) {
      case "text":
        return (
          <FormControl key={spec.key}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Input
              size="sm"
              value={readString(profile, spec.key)}
              placeholder={spec.placeholder}
              onChange={(event) => setField(spec.key, event.target.value)}
            />
            {spec.help ? (
              <Text mt={1} fontSize="xs" color="gray.500">
                {spec.help}
              </Text>
            ) : null}
          </FormControl>
        );
      case "textarea":
        return (
          <FormControl key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Textarea
              size="sm"
              minH="72px"
              value={readString(profile, spec.key)}
              placeholder={spec.placeholder}
              onChange={(event) => setField(spec.key, event.target.value)}
            />
          </FormControl>
        );
      case "number":
        return (
          <FormControl key={spec.key}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <NumberInput
              size="sm"
              value={readNumber(profile, spec.key)}
              onChange={(_, value) => setField(spec.key, Number.isFinite(value) ? value : 0)}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            {spec.help ? (
              <Text mt={1} fontSize="xs" color="gray.500">
                {spec.help}
              </Text>
            ) : null}
          </FormControl>
        );
      case "boolean":
        return (
          <FormControl key={spec.key} display="flex" alignItems="center" pt={{ md: 7 }}>
            <Checkbox
              isChecked={Boolean(profile[spec.key])}
              onChange={(event) => setField(spec.key, event.target.checked)}
            >
              {spec.label}
            </Checkbox>
          </FormControl>
        );
      case "select": {
        const current = readString(profile, spec.key);
        const options = spec.options ?? [];

        return (
          <FormControl key={spec.key}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Select
              size="sm"
              value={current}
              onChange={(event) => setField(spec.key, event.target.value)}
            >
              <option value="">—</option>
              {options
                .concat(current && !options.includes(current) ? [current] : [])
                .map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
            </Select>
          </FormControl>
        );
      }
      case "stringList":
        return (
          <FormControl key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Input
              size="sm"
              value={readStringArray(profile, spec.key).join(", ")}
              placeholder={spec.placeholder ?? "Comma-separated values"}
              onChange={(event) =>
                setField(
                  spec.key,
                  event.target.value
                    .split(",")
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0)
                )
              }
            />
          </FormControl>
        );
      case "typeList":
        return (
          <Box key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <TypeListField
              label={spec.label}
              values={readStringArray(profile, spec.key)}
              typeOptions={needsTypes ? typeOptions : []}
              onChange={(next) => setField(spec.key, next)}
            />
          </Box>
        );
      case "party":
        return (
          <Box key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <PartyField
              values={
                Array.isArray(profile[spec.key]) ? (profile[spec.key] as PartyEntry[]) : []
              }
              speciesOptions={needsSpecies ? speciesOptions : []}
              datalistId={datalistId}
              onChange={(next) => setField(spec.key, next)}
            />
          </Box>
        );
      case "encounterTables":
        return (
          <Box key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <EncounterTablesField
              values={
                Array.isArray(profile[spec.key])
                  ? (profile[spec.key] as EncounterTable[])
                  : []
              }
              speciesOptions={needsSpecies ? speciesOptions : []}
              datalistId={datalistId}
              onChange={(next) => setField(spec.key, next)}
            />
          </Box>
        );
      case "regionPoints":
        return (
          <Box key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <RegionPointsField
              imageSrc={readString(profile, "imageSrc")}
              gridSize={readNumber(profile, "gridSize") || 16}
              values={
                Array.isArray(profile[spec.key]) ? (profile[spec.key] as RegionPoint[]) : []
              }
              onChange={(next) => setField(spec.key, next)}
            />
          </Box>
        );
      case "badgeIcon": {
        const iconIndex = readNumber(profile, spec.key);

        return (
          <FormControl key={spec.key}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Flex align="center" gap={3}>
              <NumberInput
                size="sm"
                width="100px"
                min={0}
                max={7}
                value={iconIndex}
                onChange={(_, value) =>
                  setField(spec.key, Number.isFinite(value) ? value : 0)
                }
              >
                <NumberInputField />
                <NumberInputStepper>
                  <NumberIncrementStepper />
                  <NumberDecrementStepper />
                </NumberInputStepper>
              </NumberInput>
              <Image
                src={resolveServerAssetUrl(
                  `/migration_exports/badges/venova/badge-${iconIndex}.png`
                )}
                alt={`Badge ${iconIndex}`}
                boxSize="32px"
                objectFit="contain"
                sx={{ imageRendering: "pixelated" }}
                fallback={
                  <Text fontSize="xs" color="orange.600">
                    no icon
                  </Text>
                }
              />
            </Flex>
            {spec.help ? (
              <Text mt={1} fontSize="xs" color="gray.500">
                {spec.help}
              </Text>
            ) : null}
          </FormControl>
        );
      }
      case "imagePath":
        return (
          <FormControl key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Input
              size="sm"
              value={readString(profile, spec.key)}
              placeholder={spec.placeholder}
              onChange={(event) => setField(spec.key, event.target.value)}
            />
            <ImagePathPreview sourcePath={readString(profile, spec.key)} />
          </FormControl>
        );
      case "audioPath":
        return (
          <FormControl key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Input
              size="sm"
              value={readString(profile, spec.key)}
              placeholder={spec.placeholder}
              onChange={(event) => setField(spec.key, event.target.value)}
            />
            <AudioPreview sourcePath={readString(profile, spec.key)} />
          </FormControl>
        );
      case "fontPath":
        return (
          <FormControl key={spec.key} gridColumn={{ md: "1 / -1" }}>
            <FormLabel fontSize="sm">{spec.label}</FormLabel>
            <Input
              size="sm"
              value={readString(profile, spec.key)}
              placeholder={spec.placeholder}
              onChange={(event) => setField(spec.key, event.target.value)}
            />
            <FontPathPreview
              sourcePath={readString(profile, spec.key)}
              familyName={readString(profile, "familyName") || "preview"}
            />
          </FormControl>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {profile === null ? (
        <Text color="#914335" fontSize="sm">
          The stored profile JSON is invalid — fix it in the raw editor below to re-enable the
          property fields.
        </Text>
      ) : specs.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} spacingX={4} spacingY={3}>
          {specs.map(renderField)}
        </SimpleGrid>
      ) : null}

      <Accordion allowToggle mt={2}>
        <AccordionItem border="none">
          <AccordionButton px={0} _hover={{ bg: "transparent" }}>
            <Text fontSize="sm" fontWeight="600" color="#55645a">
              Advanced: raw profile JSON
            </Text>
            <AccordionIcon />
          </AccordionButton>
          <AccordionPanel px={0}>
            <FormControl isInvalid={profile === null}>
              <Textarea
                value={formState.profileJson}
                onChange={(event) => onFormChange({ profileJson: event.target.value })}
                fontFamily="mono"
                minH="220px"
                spellCheck={false}
              />
              {profile === null ? (
                <Text mt={2} color="#914335" fontSize="sm">
                  Enter a valid JSON object.
                </Text>
              ) : (
                <Text mt={2} color="#55645a" fontSize="sm">
                  {Object.keys(profile).length} profile fields. Fields the form does not show
                  (import provenance, extra metadata) are preserved on save.
                </Text>
              )}
            </FormControl>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </>
  );
}
