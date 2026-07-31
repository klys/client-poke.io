import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  Input,
  Select,
  Spinner,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { getBackendBaseUrl } from "../../game/backendConfig";
import {
  getPlayableMapsCacheVersion,
  loadPlayableMapsSnapshot,
  persistPlayableMapsSyncPayload,
  sanitizePlayableMapsSyncPayload,
} from "../../game/playableMapRuntime";
import { resolveServerAssetUrl } from "../../tilemap/serverAssets";

// Every NPC that actually exists in the game world lives as a placement
// inside the playable-maps snapshot (imported Essentials events: trainers,
// marts, Pokemon Center healers, signs, chests, talking NPCs...). The NPC
// catalog section only holds reusable templates, which is why it looks almost
// empty. This browser surfaces the real world NPCs, filterable by kind and
// map, and deep-links into the map editor where each one is edited.

type NpcRow = {
  mapId: string;
  mapName: string;
  placementId: string;
  name: string;
  npcType: string;
  x: number;
  y: number;
  previewImageSrc: string;
};

const NPC_TYPE_LABELS: Record<string, string> = {
  trainer: "Trainer",
  store: "Store / Mart",
  healer: "Pokemon Center (CDI)",
  chest: "Chest",
  sign: "Sign",
  pc: "PC",
  standing: "Talking NPC",
};

const ROWS_PER_PAGE = 50;

export default function MapNpcBrowser() {
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    getPlayableMapsCacheVersion() !== null ? "ready" : "loading"
  );
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [mapFilter, setMapFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;

    const ensureMaps = async () => {
      if (getPlayableMapsCacheVersion() !== null) {
        setLoadState("ready");
        return;
      }

      try {
        const response = await fetch(`${getBackendBaseUrl()}/playable-maps.json`);

        if (!response.ok) {
          throw new Error(String(response.status));
        }

        const payload = sanitizePlayableMapsSyncPayload(await response.json());

        if (!payload) {
          throw new Error("invalid payload");
        }

        persistPlayableMapsSyncPayload(payload);

        if (!cancelled) {
          setSnapshotVersion((version) => version + 1);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) {
          setLoadState("error");
        }
      }
    };

    void ensureMaps();

    return () => {
      cancelled = true;
    };
  }, []);

  const { rows, mapNames } = useMemo(() => {
    if (loadState !== "ready") {
      return { rows: [] as NpcRow[], mapNames: [] as Array<{ id: string; name: string }> };
    }

    const snapshot = loadPlayableMapsSnapshot();
    const nameById = new Map(snapshot.items.map((item) => [item.id, item.name]));
    const collected: NpcRow[] = [];

    Object.entries(snapshot.editorDataByMapId).forEach(([mapId, editorData]) => {
      const npcs = Array.isArray((editorData as { npcs?: unknown[] })?.npcs)
        ? ((editorData as { npcs: unknown[] }).npcs as Array<Record<string, unknown>>)
        : [];

      npcs.forEach((npc) => {
        collected.push({
          mapId,
          mapName: nameById.get(mapId) ?? mapId,
          placementId: typeof npc.id === "string" ? npc.id : "",
          name: typeof npc.name === "string" && npc.name ? npc.name : "(unnamed)",
          npcType: typeof npc.npcType === "string" ? npc.npcType : "standing",
          x: typeof npc.x === "number" ? npc.x : 0,
          y: typeof npc.y === "number" ? npc.y : 0,
          previewImageSrc:
            typeof npc.previewImageSrc === "string" ? npc.previewImageSrc : "",
        });
      });
    });

    collected.sort(
      (a, b) => a.mapName.localeCompare(b.mapName) || a.name.localeCompare(b.name)
    );

    const seenMaps = new Map<string, string>();
    collected.forEach((row) => seenMaps.set(row.mapId, row.mapName));

    return {
      rows: collected,
      mapNames: Array.from(seenMaps.entries()).map(([id, name]) => ({ id, name })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadState, snapshotVersion]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (typeFilter !== "all" && row.npcType !== typeFilter) {
        return false;
      }

      if (mapFilter !== "all" && row.mapId !== mapFilter) {
        return false;
      }

      return (
        normalizedSearch.length === 0 || row.name.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [rows, search, typeFilter, mapFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const visiblePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice(
    (visiblePage - 1) * ROWS_PER_PAGE,
    visiblePage * ROWS_PER_PAGE
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.npcType, (counts.get(row.npcType) ?? 0) + 1));
    return counts;
  }, [rows]);

  return (
    <Box
      mb={8}
      p={{ base: 4, md: 5 }}
      borderRadius="24px"
      bg="linear-gradient(135deg, rgba(255,253,246,0.95) 0%, rgba(237,244,234,0.95) 100%)"
      border="1px solid rgba(43, 66, 47, 0.12)"
    >
      <Text
        fontSize="sm"
        fontWeight="700"
        textTransform="uppercase"
        letterSpacing="0.14em"
        color="#5e7a61"
        mb={1}
      >
        World NPCs (from playable maps)
      </Text>
      <Text fontSize="sm" color="#55645a" mb={4}>
        Every NPC placed in the game world — trainers, stores, Pokemon Centers, signs, quest and
        talking NPCs. Click one to open it in its map editor. The catalog below this panel holds
        reusable NPC templates.
      </Text>

      {loadState === "loading" ? (
        <Flex align="center" gap={3} py={4}>
          <Spinner size="sm" color="#2e5b37" />
          <Text fontSize="sm" color="#55645a">
            Loading world map data…
          </Text>
        </Flex>
      ) : loadState === "error" ? (
        <Text fontSize="sm" color="#914335">
          Could not download the playable maps snapshot. Reload the page to retry.
        </Text>
      ) : (
        <>
          <Flex wrap="wrap" gap={2} mb={3}>
            {Array.from(typeCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([npcType, count]) => (
                <Badge
                  key={npcType}
                  px={2.5}
                  py={1}
                  borderRadius="full"
                  bg={typeFilter === npcType ? "#2e5b37" : "rgba(46, 91, 55, 0.08)"}
                  color={typeFilter === npcType ? "white" : "#2e5b37"}
                  cursor="pointer"
                  textTransform="none"
                  onClick={() => {
                    setTypeFilter((current) => (current === npcType ? "all" : npcType));
                    setPage(1);
                  }}
                >
                  {NPC_TYPE_LABELS[npcType] ?? npcType}: {count}
                </Badge>
              ))}
          </Flex>

          <Flex gap={3} mb={3} wrap="wrap">
            <Input
              size="sm"
              maxW="260px"
              bg="white"
              placeholder="Search NPCs by name"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <Select
              size="sm"
              maxW="220px"
              bg="white"
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All kinds</option>
              {Array.from(typeCounts.keys()).map((npcType) => (
                <option key={npcType} value={npcType}>
                  {NPC_TYPE_LABELS[npcType] ?? npcType}
                </option>
              ))}
            </Select>
            <Select
              size="sm"
              maxW="260px"
              bg="white"
              value={mapFilter}
              onChange={(event) => {
                setMapFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">All maps</option>
              {mapNames.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name}
                </option>
              ))}
            </Select>
          </Flex>

          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th></Th>
                  <Th>Name</Th>
                  <Th>Kind</Th>
                  <Th>Map</Th>
                  <Th isNumeric>Cell</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {pageRows.map((row) => (
                  <Tr key={`${row.mapId}-${row.placementId}`}>
                    <Td width="40px">
                      {row.previewImageSrc ? (
                        <Box
                          as="img"
                          src={resolveServerAssetUrl(row.previewImageSrc)}
                          alt=""
                          w="28px"
                          h="28px"
                          objectFit="contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : null}
                    </Td>
                    <Td fontWeight="600">{row.name}</Td>
                    <Td>
                      <Badge textTransform="none">
                        {NPC_TYPE_LABELS[row.npcType] ?? row.npcType}
                      </Badge>
                    </Td>
                    <Td>{row.mapName}</Td>
                    <Td isNumeric>
                      {row.x},{row.y}
                    </Td>
                    <Td>
                      <Button
                        as={RouterLink}
                        to={`/designer/maps-editor/${row.mapId}`}
                        size="xs"
                        variant="outline"
                        colorScheme="green"
                      >
                        Open map
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>

          <Flex mt={3} justify="space-between" align="center" wrap="wrap" gap={2}>
            <Text fontSize="sm" color="#55645a">
              {filteredRows.length} NPCs ({rows.length} total in the world)
            </Text>
            <Flex gap={2} align="center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                isDisabled={visiblePage === 1}
              >
                Previous
              </Button>
              <Text fontSize="sm" color="#55645a">
                Page {visiblePage} / {totalPages}
              </Text>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                isDisabled={visiblePage === totalPages}
              >
                Next
              </Button>
            </Flex>
          </Flex>
        </>
      )}
    </Box>
  );
}
