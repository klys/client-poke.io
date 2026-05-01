import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Grid,
  GridItem,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  useToast,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import {
  persistStoredDesignerSectionPayload,
  readStoredDesignerSectionPayload,
} from "./designerCache";
import type { DesignerItemSeed } from "./designerSections";
import {
  buildLevelingCurveSectionState,
  computeBattleExperience,
  DEFAULT_LEVELING_CURVE_CONFIG,
  evaluateLevelingCurveFormula,
  getExperienceForNextLevel,
  getTotalExperienceToReachLevel,
  LEVELING_CURVE_SECTION_KEY,
  sanitizeLevelingCurveConfig,
  type LevelingCurveConfig,
} from "./levelingCurve";

type LevelingCurveFormState = {
  startExpForNextLevel: string;
  expGainedPerBattle: string;
  bonusDefeatingHigherLevelFormula: string;
  debonusDefeatingLowerLevelFormula: string;
  percentageExpIncreaseNextLevel: string;
};

type DesignerSectionState = {
  categories: string[];
  items: DesignerItemSeed[];
};

type DesignerObjectsSyncPayload = {
  sectionKey?: string;
  state: DesignerSectionState;
  version: number;
  updatedAt: string | null;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
};

function createFormState(config: LevelingCurveConfig): LevelingCurveFormState {
  return {
    startExpForNextLevel: String(config.startExpForNextLevel),
    expGainedPerBattle: String(config.expGainedPerBattle),
    bonusDefeatingHigherLevelFormula: config.bonusDefeatingHigherLevelFormula,
    debonusDefeatingLowerLevelFormula: config.debonusDefeatingLowerLevelFormula,
    percentageExpIncreaseNextLevel: String(config.percentageExpIncreaseNextLevel),
  };
}

function parsePositiveNumber(value: string) {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value: string) {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function parseConfigFromForm(formState: LevelingCurveFormState) {
  const startExpForNextLevel = parsePositiveNumber(formState.startExpForNextLevel);
  const expGainedPerBattle = parseNonNegativeNumber(formState.expGainedPerBattle);
  const percentageExpIncreaseNextLevel = parseNonNegativeNumber(
    formState.percentageExpIncreaseNextLevel
  );

  if (
    startExpForNextLevel === null ||
    expGainedPerBattle === null ||
    percentageExpIncreaseNextLevel === null
  ) {
    return null;
  }

  return sanitizeLevelingCurveConfig({
    startExpForNextLevel,
    expGainedPerBattle,
    bonusDefeatingHigherLevelFormula: formState.bonusDefeatingHigherLevelFormula,
    debonusDefeatingLowerLevelFormula: formState.debonusDefeatingLowerLevelFormula,
    percentageExpIncreaseNextLevel,
  });
}

function formatNumber(value: number) {
  return value.toLocaleString();
}

function buildPolylinePoints(
  values: number[],
  width: number,
  height: number,
  padding: { top: number; right: number; bottom: number; left: number },
  maxValue: number
) {
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  return values
    .map((value, index) => {
      const x = padding.left + (index / Math.max(1, values.length - 1)) * chartWidth;
      const y =
        padding.top +
        chartHeight -
        (maxValue === 0 ? 0 : (value / maxValue) * chartHeight);

      return `${x},${y}`;
    })
    .join(" ");
}

function readInitialConfig() {
  const storedPayload = readStoredDesignerSectionPayload(LEVELING_CURVE_SECTION_KEY);
  const firstItem = storedPayload.state.items[0];
  return sanitizeLevelingCurveConfig(firstItem?.levelingCurveProfile);
}

export default function LevelingCurvePage() {
  const toast = useToast();
  const { authReady, authenticated, socket } = useAuth();
  const [savedConfig, setSavedConfig] = useState<LevelingCurveConfig>(readInitialConfig);
  const [formState, setFormState] = useState<LevelingCurveFormState>(() =>
    createFormState(readInitialConfig())
  );
  const [sectionVersion, setSectionVersion] = useState<number | null>(
    () => readStoredDesignerSectionPayload(LEVELING_CURVE_SECTION_KEY).version
  );
  const [syncMeta, setSyncMeta] = useState<{
    updatedAt: string | null;
    updatedByUsername: string | null;
  }>(() => {
    const storedPayload = readStoredDesignerSectionPayload(LEVELING_CURVE_SECTION_KEY);
    return {
      updatedAt: storedPayload.updatedAt,
      updatedByUsername: storedPayload.updatedByUsername,
    };
  });
  const [isSyncReady, setIsSyncReady] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(Boolean(socket?.connected));
  const [isSaving, setIsSaving] = useState(false);

  const parsedConfig = useMemo(() => parseConfigFromForm(formState), [formState]);
  const bonusFormulaPreview = useMemo(
    () =>
      evaluateLevelingCurveFormula(formState.bonusDefeatingHigherLevelFormula, {
        Alvl: 25,
        Blvl: 35,
      }),
    [formState.bonusDefeatingHigherLevelFormula]
  );
  const debonusFormulaPreview = useMemo(
    () =>
      evaluateLevelingCurveFormula(formState.debonusDefeatingLowerLevelFormula, {
        Alvl: 35,
        Blvl: 25,
      }),
    [formState.debonusDefeatingLowerLevelFormula]
  );
  const isBonusFormulaValid =
    formState.bonusDefeatingHigherLevelFormula.trim().length > 0 && bonusFormulaPreview !== null;
  const isDebonusFormulaValid =
    formState.debonusDefeatingLowerLevelFormula.trim().length > 0 && debonusFormulaPreview !== null;
  const isFormValid =
    parsedConfig !== null && isBonusFormulaValid && isDebonusFormulaValid;
  const chartConfig = parsedConfig ?? savedConfig;
  const savedFormState = useMemo(() => createFormState(savedConfig), [savedConfig]);
  const hasUnsavedChanges =
    JSON.stringify(formState) !== JSON.stringify(savedFormState);

  const chartSeries = useMemo(() => {
    const levels = Array.from({ length: 100 }, (_, index) => index + 1);
    return {
      levels,
      requiredPerLevel: levels.map((level) => getExperienceForNextLevel(level, chartConfig)),
      cumulativeExp: levels.map((level) => getTotalExperienceToReachLevel(level, chartConfig)),
      sameLevelBattleExp: levels.map((level) => computeBattleExperience(chartConfig, level, level)),
      higherLevelBattleExp: levels.map((level) =>
        computeBattleExperience(chartConfig, level, Math.min(100, level + 10))
      ),
      lowerLevelBattleExp: levels.map((level) =>
        computeBattleExperience(chartConfig, level, Math.max(1, level - 10))
      ),
    };
  }, [chartConfig]);

  const chartDimensions = { width: 760, height: 360 };
  const chartPadding = { top: 18, right: 18, bottom: 34, left: 56 };
  const maxChartValue = useMemo(
    () =>
      Math.max(
        ...chartSeries.cumulativeExp,
        ...chartSeries.requiredPerLevel,
        ...chartSeries.sameLevelBattleExp,
        ...chartSeries.higherLevelBattleExp,
        ...chartSeries.lowerLevelBattleExp
      ),
    [chartSeries]
  );

  const lastSyncedLabel = useMemo(() => {
    if (!syncMeta.updatedAt) {
      return null;
    }

    const timestamp = new Date(syncMeta.updatedAt);
    return Number.isNaN(timestamp.getTime())
      ? syncMeta.updatedAt
      : timestamp.toLocaleString();
  }, [syncMeta.updatedAt]);

  const updateField = useCallback(
    (field: keyof LevelingCurveFormState, value: string) => {
      setFormState((current) => ({ ...current, [field]: value }));
    },
    []
  );

  useEffect(() => {
    setIsSocketConnected(Boolean(socket?.connected));
  }, [socket]);

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return;
    }

    const joinSectionRoom = () => {
      setIsSocketConnected(true);
      setIsSyncReady(false);

      const storedPayload = readStoredDesignerSectionPayload(LEVELING_CURVE_SECTION_KEY);
      const seedState =
        storedPayload.version === null
          ? storedPayload.state.items.length > 0
            ? storedPayload.state
            : buildLevelingCurveSectionState(DEFAULT_LEVELING_CURVE_CONFIG)
          : undefined;

      socket.emit("designer:section:join", {
        sectionKey: LEVELING_CURVE_SECTION_KEY,
        version: storedPayload.version,
        seedState,
      });
    };

    const handleState = (payload: DesignerObjectsSyncPayload) => {
      if (payload.sectionKey && payload.sectionKey !== LEVELING_CURVE_SECTION_KEY) {
        return;
      }

      const firstItem = payload.state.items[0];
      const nextConfig = sanitizeLevelingCurveConfig(firstItem?.levelingCurveProfile);

      setSavedConfig(nextConfig);
      setFormState(createFormState(nextConfig));
      setSectionVersion(payload.version);
      setSyncMeta({
        updatedAt: payload.updatedAt,
        updatedByUsername: payload.updatedByUsername,
      });
      setIsSyncReady(true);
      setIsSaving(false);

      persistStoredDesignerSectionPayload(LEVELING_CURVE_SECTION_KEY, {
        state: payload.state,
        version: payload.version,
        updatedAt: payload.updatedAt,
        updatedByUsername: payload.updatedByUsername,
      });
    };

    const handleVersion = (payload: {
      sectionKey: string;
      version: number | null;
      updatedAt: string | null;
    }) => {
      if (payload.sectionKey !== LEVELING_CURVE_SECTION_KEY) {
        return;
      }

      setSectionVersion(payload.version);
      setSyncMeta((current) => ({
        ...current,
        updatedAt: payload.updatedAt,
      }));
      setIsSyncReady(true);
    };

    const handleError = ({ message }: { message: string }) => {
      setIsSaving(false);
      setIsSyncReady(false);
      toast({
        title: message,
        status: "error",
        duration: 4000,
        isClosable: true,
        position: "top",
      });
    };

    const handleConnect = () => {
      joinSectionRoom();
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
      setIsSyncReady(false);
    };

    socket.on("designer:section:state", handleState);
    socket.on("designer:section:version", handleVersion);
    socket.on("designer:section:error", handleError);
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    if (!socket.connected) {
      socket.connect();
    } else {
      joinSectionRoom();
    }

    return () => {
      socket.emit("designer:section:leave", { sectionKey: LEVELING_CURVE_SECTION_KEY });
      socket.off("designer:section:state", handleState);
      socket.off("designer:section:version", handleVersion);
      socket.off("designer:section:error", handleError);
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [authReady, authenticated, socket, toast]);

  const handleSave = useCallback(() => {
    if (!socket || !authenticated) {
      return;
    }

    if (!parsedConfig || !isBonusFormulaValid || !isDebonusFormulaValid) {
      toast({
        title: "Fix the form before saving.",
        description: "Use numeric values and formulas that only reference Alvl and Blvl.",
        status: "warning",
        duration: 3500,
        isClosable: true,
        position: "top",
      });
      return;
    }

    setIsSaving(true);
    socket.emit("designer:section:update", {
      sectionKey: LEVELING_CURVE_SECTION_KEY,
      state: buildLevelingCurveSectionState(parsedConfig),
    });
  }, [
    authenticated,
    isBonusFormulaValid,
    isDebonusFormulaValid,
    parsedConfig,
    socket,
    toast,
  ]);

  const statusText = !authReady
    ? "Preparing the live leveling configuration channel."
    : !authenticated
      ? "Authentication is required to edit the leveling curve."
      : !isSocketConnected
        ? "Reconnecting the live leveling configuration channel."
        : !isSyncReady
          ? "Loading the latest leveling configuration."
          : hasUnsavedChanges
            ? "You have unsaved changes."
            : `Live sync is active.${lastSyncedLabel ? ` Last saved ${lastSyncedLabel}.` : ""}${syncMeta.updatedByUsername ? ` Latest change by ${syncMeta.updatedByUsername}.` : ""}`;

  const legendItems = [
    { label: "Cumulative EXP", color: "#2f855a" },
    { label: "EXP For Next Level", color: "#dd6b20" },
    { label: "Battle EXP vs Same Level", color: "#2b6cb0" },
    { label: "Battle EXP vs Foe +10", color: "#805ad5" },
    { label: "Battle EXP vs Foe -10", color: "#c53030" },
  ];

  const sampleLevel = 25;
  const sampleCards = [
    {
      label: `Level ${sampleLevel} to ${sampleLevel + 1}`,
      value: `${formatNumber(getExperienceForNextLevel(sampleLevel, chartConfig))} EXP`,
    },
    {
      label: `Win vs Level ${sampleLevel}`,
      value: `${formatNumber(computeBattleExperience(chartConfig, sampleLevel, sampleLevel))} EXP`,
    },
    {
      label: `Win vs Level ${sampleLevel + 10}`,
      value: `${formatNumber(computeBattleExperience(chartConfig, sampleLevel, sampleLevel + 10))} EXP`,
    },
    {
      label: `Win vs Level ${sampleLevel - 10}`,
      value: `${formatNumber(computeBattleExperience(chartConfig, sampleLevel, sampleLevel - 10))} EXP`,
    },
  ];

  return (
    <Box
      minH="100vh"
      px={{ base: 4, md: 8, xl: 12 }}
      py={{ base: 6, md: 10 }}
      bg="linear-gradient(180deg, #f6f1e3 0%, #e2edf3 100%)"
    >
      <Box
        maxW="1280px"
        mx="auto"
        p={{ base: 5, md: 8 }}
        borderRadius="32px"
        bg="rgba(255, 252, 245, 0.9)"
        border="1px solid rgba(54, 73, 82, 0.14)"
        boxShadow="0 24px 60px rgba(45, 65, 79, 0.12)"
        backdropFilter="blur(12px)"
      >
        <Stack spacing={6}>
          <HStack justify="space-between" align="flex-start" spacing={4} flexWrap="wrap">
            <Box>
              <Badge
                mb={3}
                colorScheme={hasUnsavedChanges ? "orange" : "green"}
                px={3}
                py={1}
                borderRadius="full"
              >
                Leveling Curve
              </Badge>
              <Heading size="lg" color="#22313a" mb={2}>
                Configure EXP rewards and level growth.
              </Heading>
              <Text color="#5b6972" maxW="780px">
                This curve controls how much EXP a winning Pokemon gains, how fast the next
                level requirement grows, and the formulas applied when the foe is higher or
                lower level.
              </Text>
            </Box>
            <HStack spacing={3}>
              <Button as={RouterLink} to="/designer" variant="outline" colorScheme="gray">
                Back To Designer
              </Button>
              <Button
                variant="ghost"
                colorScheme="gray"
                onClick={() => setFormState(createFormState(savedConfig))}
                isDisabled={!hasUnsavedChanges}
              >
                Revert
              </Button>
              <Button
                colorScheme="green"
                onClick={handleSave}
                isDisabled={!isFormValid || !hasUnsavedChanges || !authenticated || !isSocketConnected}
                isLoading={isSaving}
              >
                Save Curve
              </Button>
            </HStack>
          </HStack>

          <Box
            borderRadius="20px"
            px={4}
            py={3}
            bg={hasUnsavedChanges ? "orange.50" : "green.50"}
            borderWidth="1px"
            borderColor={hasUnsavedChanges ? "orange.200" : "green.200"}
          >
            <Text color={hasUnsavedChanges ? "orange.700" : "green.700"} fontWeight="600">
              {statusText}
            </Text>
            {sectionVersion !== null ? (
              <Text mt={1} color="#67727a" fontSize="sm">
                Version {sectionVersion}
              </Text>
            ) : null}
          </Box>

          <Grid templateColumns={{ base: "1fr", xl: "380px 1fr" }} gap={6}>
            <GridItem>
              <Stack spacing={4}>
                <Box
                  borderRadius="24px"
                  border="1px solid rgba(72, 92, 101, 0.14)"
                  bg="white"
                  p={5}
                >
                  <Heading size="md" color="#22313a" mb={4}>
                    Variables
                  </Heading>
                  <Stack spacing={4}>
                    <FormControl isInvalid={parsePositiveNumber(formState.startExpForNextLevel) === null}>
                      <FormLabel>START_EXP_FOR_NEXT_LEVEL</FormLabel>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={formState.startExpForNextLevel}
                        onChange={(event) =>
                          updateField("startExpForNextLevel", event.target.value)
                        }
                      />
                    </FormControl>

                    <FormControl isInvalid={parseNonNegativeNumber(formState.expGainedPerBattle) === null}>
                      <FormLabel>EXP_GAINED_PER_BATTLE</FormLabel>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={formState.expGainedPerBattle}
                        onChange={(event) =>
                          updateField("expGainedPerBattle", event.target.value)
                        }
                      />
                    </FormControl>

                    <FormControl isInvalid={!isBonusFormulaValid}>
                      <FormLabel>BONUS_DEFEATING_HIGHER_LEVEL</FormLabel>
                      <Textarea
                        rows={3}
                        value={formState.bonusDefeatingHigherLevelFormula}
                        onChange={(event) =>
                          updateField("bonusDefeatingHigherLevelFormula", event.target.value)
                        }
                      />
                      <FormHelperText>
                        Use `Alvl` and `Blvl`. Preview at A=25, B=35:{" "}
                        {bonusFormulaPreview === null ? "Invalid formula" : bonusFormulaPreview}
                      </FormHelperText>
                    </FormControl>

                    <FormControl isInvalid={!isDebonusFormulaValid}>
                      <FormLabel>DEBONUS_DEFEATING_LOWER_LEVEL</FormLabel>
                      <Textarea
                        rows={3}
                        value={formState.debonusDefeatingLowerLevelFormula}
                        onChange={(event) =>
                          updateField("debonusDefeatingLowerLevelFormula", event.target.value)
                        }
                      />
                      <FormHelperText>
                        Use `Alvl` and `Blvl`. Preview at A=35, B=25:{" "}
                        {debonusFormulaPreview === null ? "Invalid formula" : debonusFormulaPreview}
                      </FormHelperText>
                    </FormControl>

                    <FormControl
                      isInvalid={
                        parseNonNegativeNumber(formState.percentageExpIncreaseNextLevel) === null
                      }
                    >
                      <FormLabel>PERCENTAGE_EXP_INCREASE_NEXT_LEVEL</FormLabel>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        value={formState.percentageExpIncreaseNextLevel}
                        onChange={(event) =>
                          updateField("percentageExpIncreaseNextLevel", event.target.value)
                        }
                      />
                      <FormHelperText>
                        Stored as a percentage. Example: `10` means `10%`.
                      </FormHelperText>
                    </FormControl>
                  </Stack>
                </Box>

                <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                  {sampleCards.map((card) => (
                    <Box
                      key={card.label}
                      borderRadius="20px"
                      border="1px solid rgba(72, 92, 101, 0.14)"
                      bg="linear-gradient(135deg, #ffffff 0%, #f3f8fb 100%)"
                      p={4}
                    >
                      <Text fontSize="sm" color="#66747c">
                        {card.label}
                      </Text>
                      <Text mt={1} fontSize="xl" fontWeight="700" color="#21313a">
                        {card.value}
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>
              </Stack>
            </GridItem>

            <GridItem>
              <Stack spacing={4}>
                <Box
                  borderRadius="24px"
                  border="1px solid rgba(72, 92, 101, 0.14)"
                  bg="white"
                  p={5}
                >
                  <Heading size="md" color="#22313a" mb={2}>
                    Level 1-100 Curve
                  </Heading>
                  <Text color="#66747c" mb={5}>
                    The graph combines total EXP growth, per-level requirement, and sample
                    battle rewards for equal, higher, and lower level wins.
                  </Text>

                  <Box
                    borderRadius="20px"
                    bg="linear-gradient(180deg, #f8fbfd 0%, #edf5f9 100%)"
                    border="1px solid rgba(82, 112, 126, 0.14)"
                    p={3}
                    overflowX="auto"
                  >
                    <svg
                      viewBox={`0 0 ${chartDimensions.width} ${chartDimensions.height}`}
                      width="100%"
                      role="img"
                      aria-label="Leveling curve graph"
                    >
                      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y =
                          chartPadding.top +
                          (chartDimensions.height - chartPadding.top - chartPadding.bottom) * ratio;

                        return (
                          <g key={ratio}>
                            <line
                              x1={chartPadding.left}
                              y1={y}
                              x2={chartDimensions.width - chartPadding.right}
                              y2={y}
                              stroke="rgba(83, 109, 120, 0.16)"
                              strokeDasharray="4 6"
                            />
                            <text
                              x={12}
                              y={y + 4}
                              fill="#64727b"
                              fontSize="11"
                              fontFamily="sans-serif"
                            >
                              {formatNumber(Math.round(maxChartValue * (1 - ratio)))}
                            </text>
                          </g>
                        );
                      })}

                      <line
                        x1={chartPadding.left}
                        y1={chartPadding.top}
                        x2={chartPadding.left}
                        y2={chartDimensions.height - chartPadding.bottom}
                        stroke="#8aa0ad"
                        strokeWidth="1.2"
                      />
                      <line
                        x1={chartPadding.left}
                        y1={chartDimensions.height - chartPadding.bottom}
                        x2={chartDimensions.width - chartPadding.right}
                        y2={chartDimensions.height - chartPadding.bottom}
                        stroke="#8aa0ad"
                        strokeWidth="1.2"
                      />

                      {[1, 25, 50, 75, 100].map((level) => {
                        const x =
                          chartPadding.left +
                          ((level - 1) / 99) *
                            (chartDimensions.width - chartPadding.left - chartPadding.right);

                        return (
                          <g key={level}>
                            <line
                              x1={x}
                              y1={chartPadding.top}
                              x2={x}
                              y2={chartDimensions.height - chartPadding.bottom}
                              stroke="rgba(83, 109, 120, 0.12)"
                            />
                            <text
                              x={x}
                              y={chartDimensions.height - 10}
                              textAnchor="middle"
                              fill="#64727b"
                              fontSize="11"
                              fontFamily="sans-serif"
                            >
                              {level}
                            </text>
                          </g>
                        );
                      })}

                      <polyline
                        fill="none"
                        stroke="#2f855a"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={buildPolylinePoints(
                          chartSeries.cumulativeExp,
                          chartDimensions.width,
                          chartDimensions.height,
                          chartPadding,
                          maxChartValue
                        )}
                      />
                      <polyline
                        fill="none"
                        stroke="#dd6b20"
                        strokeWidth="2.6"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={buildPolylinePoints(
                          chartSeries.requiredPerLevel,
                          chartDimensions.width,
                          chartDimensions.height,
                          chartPadding,
                          maxChartValue
                        )}
                      />
                      <polyline
                        fill="none"
                        stroke="#2b6cb0"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={buildPolylinePoints(
                          chartSeries.sameLevelBattleExp,
                          chartDimensions.width,
                          chartDimensions.height,
                          chartPadding,
                          maxChartValue
                        )}
                      />
                      <polyline
                        fill="none"
                        stroke="#805ad5"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={buildPolylinePoints(
                          chartSeries.higherLevelBattleExp,
                          chartDimensions.width,
                          chartDimensions.height,
                          chartPadding,
                          maxChartValue
                        )}
                      />
                      <polyline
                        fill="none"
                        stroke="#c53030"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        points={buildPolylinePoints(
                          chartSeries.lowerLevelBattleExp,
                          chartDimensions.width,
                          chartDimensions.height,
                          chartPadding,
                          maxChartValue
                        )}
                      />
                    </svg>
                  </Box>

                  <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={3} mt={4}>
                    {legendItems.map((item) => (
                      <HStack key={item.label} spacing={3}>
                        <Box w="14px" h="14px" borderRadius="full" bg={item.color} />
                        <Text color="#59676f">{item.label}</Text>
                      </HStack>
                    ))}
                  </SimpleGrid>
                </Box>

                <Box
                  borderRadius="24px"
                  border="1px solid rgba(72, 92, 101, 0.14)"
                  bg="white"
                  p={5}
                >
                  <Heading size="sm" color="#22313a" mb={3}>
                    Formula Notes
                  </Heading>
                  <Stack spacing={2} color="#66747c">
                    <Text>Allowed tokens: numbers, `Alvl`, `Blvl`, `+`, `-`, `*`, `/`, parentheses.</Text>
                    <Text>You can write percentages like `5% * (Blvl - Alvl)` and the editor will interpret `5%` as `0.05`.</Text>
                    <Text>At runtime the winning Pokemon receives base battle EXP adjusted by the selected bonus or debonus formula.</Text>
                    <Text>When a Pokemon levels up, it is fully healed, all move PP are restored, and each stat gains a random bonus from `0` to `5`.</Text>
                  </Stack>
                </Box>
              </Stack>
            </GridItem>
          </Grid>
        </Stack>
      </Box>
    </Box>
  );
}
