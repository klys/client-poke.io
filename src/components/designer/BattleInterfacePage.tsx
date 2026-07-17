import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormLabel,
  Grid,
  Heading,
  HStack,
  Input,
  Select,
  SimpleGrid,
  Stack,
  Text,
  useToast,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import {
  persistStoredDesignerSectionPayload,
  readStoredDesignerSectionPayload,
} from "./designerCache";
import type { DesignerBattleInterfaceProfile, DesignerItemSeed } from "./designerSections";
import {
  DEFAULT_BATTLE_INTERFACE_CONFIG,
  sanitizeBattleInterfaceConfig,
  type BattleInterfaceConfig,
} from "../ux/game/battle/battleInterfaceConfig";

const SECTION_KEY = "battleInterface" as const;

type SyncPayload = {
  sectionKey?: string;
  state: { categories: string[]; items: DesignerItemSeed[] };
  version: number;
  updatedAt: string | null;
  updatedByUserId: number | null;
  updatedByUsername: string | null;
};

function buildSectionState(config: BattleInterfaceConfig) {
  return {
    categories: ["Battle UI"],
    items: [
      {
        id: "battle-interface-config",
        name: "Battle Interface",
        category: "Battle UI",
        details: [],
        battleInterfaceProfile: config as DesignerBattleInterfaceProfile,
      },
    ],
  };
}

export default function BattleInterfacePage() {
  const { authReady, authenticated, socket } = useAuth();
  const toast = useToast();
  const [config, setConfig] = useState<BattleInterfaceConfig>(() => {
    const payload = readStoredDesignerSectionPayload(SECTION_KEY);
    const item = payload.state.items[0] as { battleInterfaceProfile?: unknown } | undefined;
    return sanitizeBattleInterfaceConfig(item?.battleInterfaceProfile);
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncReady, setIsSyncReady] = useState(false);
  const battleBackgrounds = useMemo(
    () => readStoredDesignerSectionPayload("battleBackgrounds").state.items,
    []
  );

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return;
    }

    const joinSectionRoom = () => {
      const storedPayload = readStoredDesignerSectionPayload(SECTION_KEY);
      const seedState =
        storedPayload.version === null
          ? storedPayload.state.items.length > 0
            ? storedPayload.state
            : buildSectionState(DEFAULT_BATTLE_INTERFACE_CONFIG)
          : undefined;

      socket.emit("designer:section:join", {
        sectionKey: SECTION_KEY,
        version: storedPayload.version,
        seedState,
      });
    };

    const handleState = (payload: SyncPayload) => {
      if (payload.sectionKey && payload.sectionKey !== SECTION_KEY) {
        return;
      }

      const firstItem = payload.state.items[0] as { battleInterfaceProfile?: unknown } | undefined;
      setConfig(sanitizeBattleInterfaceConfig(firstItem?.battleInterfaceProfile));
      setIsSyncReady(true);
      setIsSaving(false);
      persistStoredDesignerSectionPayload(SECTION_KEY, {
        state: payload.state,
        version: payload.version,
        updatedAt: payload.updatedAt,
        updatedByUsername: payload.updatedByUsername,
      });
    };

    const handleError = ({ message }: { message: string }) => {
      setIsSaving(false);
      toast({ title: message, status: "error", duration: 4000, isClosable: true, position: "top" });
    };

    socket.on("designer:section:state", handleState);
    socket.on("designer:section:error", handleError);
    socket.on("connect", joinSectionRoom);

    if (!socket.connected) {
      socket.connect();
    } else {
      joinSectionRoom();
    }

    return () => {
      socket.emit("designer:section:leave", { sectionKey: SECTION_KEY });
      socket.off("designer:section:state", handleState);
      socket.off("designer:section:error", handleError);
      socket.off("connect", joinSectionRoom);
    };
  }, [authReady, authenticated, socket, toast]);

  const set = <Key extends keyof BattleInterfaceConfig>(key: Key, value: BattleInterfaceConfig[Key]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };

  const handleSave = () => {
    if (!socket || !authenticated) {
      return;
    }

    setIsSaving(true);
    socket.emit("designer:section:update", {
      sectionKey: SECTION_KEY,
      state: buildSectionState(sanitizeBattleInterfaceConfig(config)),
    });
  };

  const colorField = (label: string, key: keyof BattleInterfaceConfig) => (
    <FormControl key={key}>
      <FormLabel fontSize="sm">{label}</FormLabel>
      <Input
        type="color"
        value={String(config[key])}
        onChange={(event) => set(key, event.target.value as never)}
        padding={1}
        height="38px"
      />
    </FormControl>
  );

  const numberField = (label: string, key: keyof BattleInterfaceConfig, min: number, max: number, step = 1) => (
    <FormControl key={key}>
      <FormLabel fontSize="sm">{label}</FormLabel>
      <Input
        type="number"
        value={Number(config[key])}
        min={min}
        max={max}
        step={step}
        onChange={(event) => set(key, Number(event.target.value) as never)}
      />
    </FormControl>
  );

  const textField = (label: string, key: keyof BattleInterfaceConfig, placeholder: string) => (
    <FormControl key={key}>
      <FormLabel fontSize="sm">{label}</FormLabel>
      <Input
        value={String(config[key])}
        placeholder={placeholder}
        onChange={(event) => set(key, event.target.value as never)}
      />
    </FormControl>
  );

  return (
    <Box maxW="1080px" mx="auto" px={{ base: 4, md: 8 }} py={8}>
      <HStack justify="space-between" align="start" mb={6}>
        <Box>
          <Heading size="lg">Battle Interface</Heading>
          <Text color="gray.500" mt={1}>
            Customize the battle scene the game runtime renders: backgrounds, databoxes, message
            window, sounds, transitions, and battle log.
          </Text>
        </Box>
        <Button as={RouterLink} to="/designer" variant="outline">
          Back to Designer
        </Button>
      </HStack>

      <Badge colorScheme={isSyncReady ? "green" : "yellow"} mb={4}>
        {isSyncReady ? "Live sync active" : "Connecting..."}
      </Badge>

      <Grid templateColumns={{ base: "1fr", lg: "1fr 340px" }} gap={6}>
        <Stack spacing={6}>
          <Box borderWidth="1px" borderRadius="10px" p={4}>
            <Heading size="sm" mb={3}>Scene</Heading>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              <FormControl>
                <FormLabel fontSize="sm">Battle background (migrated battlebacks)</FormLabel>
                <Select
                  value={config.battleBackgroundId}
                  onChange={(event) => set("battleBackgroundId", event.target.value)}
                >
                  <option value="">Default gradient</option>
                  {battleBackgrounds.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Intro transition</FormLabel>
                <Select
                  value={config.introTransition}
                  onChange={(event) => set("introTransition", event.target.value as BattleInterfaceConfig["introTransition"])}
                >
                  <option value="random">Random (new one each battle)</option>
                  <option value="flash-wipe">Flash + wipe (classic)</option>
                  <option value="fade">Fade</option>
                  <option value="iris">Iris close</option>
                  <option value="blinds">Blinds</option>
                  <option value="checker">Checkerboard</option>
                  <option value="shutter">Shutter slats</option>
                  <option value="none">None</option>
                </Select>
              </FormControl>
              {textField("Background image URL (override)", "backgroundImageSrc", "/migration_exports/... or data URL")}
              {numberField("Animation speed", "animationSpeed", 0.25, 3, 0.25)}
            </SimpleGrid>
          </Box>

          <Box borderWidth="1px" borderRadius="10px" p={4}>
            <Heading size="sm" mb={3}>Databoxes & message window</Heading>
            <SimpleGrid columns={{ base: 2, sm: 3 }} spacing={3}>
              {colorField("Player databox", "databoxPlayerColor")}
              {colorField("Enemy databox", "databoxEnemyColor")}
              {colorField("Databox text", "databoxTextColor")}
              {colorField("Message box", "messageBoxColor")}
              {colorField("Message text", "messageBoxTextColor")}
              {colorField("Message border", "messageBoxBorderColor")}
              {numberField("Message rows", "messageRows", 1, 4)}
              {numberField("Text speed (ms/char)", "textSpeedMsPerChar", 0, 90)}
              {numberField("Battle log rows", "logRows", 3, 14)}
            </SimpleGrid>
            <Checkbox
              mt={3}
              isChecked={config.showBattleLog}
              onChange={(event) => set("showBattleLog", event.target.checked)}
            >
              Show battle log toggle in battles
            </Checkbox>
          </Box>

          <Box borderWidth="1px" borderRadius="10px" p={4}>
            <Heading size="sm" mb={3}>Audio</Heading>
            <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
              {textField("Battle BGM URL", "battleBgmSrc", "/migration_exports/audio/bgm/...")}
              {textField("Victory ME URL", "victoryMeSrc", "/migration_exports/audio/me/...")}
              {textField("Wild intro SE URL", "wildIntroSeSrc", "optional")}
              {textField("Trainer intro SE URL", "trainerIntroSeSrc", "optional")}
              {numberField("BGM volume", "bgmVolume", 0, 1, 0.05)}
              {numberField("SE volume", "seVolume", 0, 1, 0.05)}
            </SimpleGrid>
            <HStack mt={3} spacing={6}>
              <Checkbox isChecked={config.muteBgm} onChange={(event) => set("muteBgm", event.target.checked)}>
                Mute BGM
              </Checkbox>
              <Checkbox isChecked={config.muteSe} onChange={(event) => set("muteSe", event.target.checked)}>
                Mute sound effects
              </Checkbox>
            </HStack>
          </Box>

          <Button
            colorScheme="teal"
            size="lg"
            onClick={handleSave}
            isLoading={isSaving}
            isDisabled={!authenticated}
          >
            Save battle interface
          </Button>
        </Stack>

        {/* Live preview */}
        <Box>
          <Heading size="sm" mb={3}>Preview</Heading>
          <Box
            borderRadius="10px"
            overflow="hidden"
            borderWidth="1px"
            position="relative"
            height="300px"
            bg={
              config.backgroundImageSrc
                ? undefined
                : "linear-gradient(180deg, #8fd3e8 0%, #cdeec3 58%, #9ed88f 100%)"
            }
            backgroundImage={config.backgroundImageSrc ? `url(${config.backgroundImageSrc})` : undefined}
            backgroundSize="cover"
          >
            <Box
              position="absolute"
              top="10px"
              left="10px"
              bg={config.databoxEnemyColor}
              color={config.databoxTextColor}
              border="2px solid #55524a"
              borderRadius="4px 10px 10px 4px"
              px={3}
              py={1.5}
              fontSize="xs"
              fontWeight="900"
            >
              Wild Mon Lv12
              <Box mt={1} h="6px" w="130px" bg="#57534a" borderRadius="3px">
                <Box h="100%" w="65%" bg="#4cc95e" borderRadius="3px" />
              </Box>
            </Box>
            <Box
              position="absolute"
              right="10px"
              bottom="86px"
              bg={config.databoxPlayerColor}
              color={config.databoxTextColor}
              border="2px solid #55524a"
              borderRadius="10px 4px 4px 10px"
              px={3}
              py={1.5}
              fontSize="xs"
              fontWeight="900"
            >
              Your Mon Lv14
              <Box mt={1} h="6px" w="130px" bg="#57534a" borderRadius="3px">
                <Box h="100%" w="88%" bg="#4cc95e" borderRadius="3px" />
              </Box>
              <Box mt={1} h="3px" w="130px" bg="#57534a">
                <Box h="100%" w="40%" bg="#43b0e8" />
              </Box>
            </Box>
            <Box
              position="absolute"
              left={0}
              right={0}
              bottom={0}
              height={`${58 + config.messageRows * 16}px`}
              bg={config.messageBoxColor}
              borderTop={`3px solid ${config.messageBoxBorderColor}`}
              p={2}
            >
              <Box
                border={`1px solid ${config.messageBoxBorderColor}`}
                borderRadius="6px"
                h="100%"
                px={3}
                py={1.5}
              >
                <Text color={config.messageBoxTextColor} fontWeight="800" fontSize="sm">
                  What will Your Mon do?
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Grid>
    </Box>
  );
}
