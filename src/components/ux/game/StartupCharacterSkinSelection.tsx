import {
  Badge,
  Box,
  Button,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";
import type { DesignerItemSeed } from "../../designer/designerSections";
import {
  getCharacterSkinPreview,
  loadCharacterSkinCatalog,
  toCharacterSkinCatalogItem,
} from "./characterSkinCatalog";
import { useAuth } from "../../../context/authContext";

const StartupCharacterSkinSelection = () => {
  const { authReady, authenticated, socket, updateProfile, user } = useAuth();
  const [characterSkins, setCharacterSkins] = useState(() => loadCharacterSkinCatalog());
  const [characterSkinsReady, setCharacterSkinsReady] = useState(characterSkins.length > 0);
  const [selectedSkinId, setSelectedSkinId] = useState(user?.characterSkinId || "");

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return undefined;
    }

    const handleState = (payload: {
      sectionKey?: string;
      state?: { items?: DesignerItemSeed[] };
    }) => {
      if (payload.sectionKey && payload.sectionKey !== "players") {
        return;
      }

      const nextCharacterSkins = (payload.state?.items ?? [])
        .map(toCharacterSkinCatalogItem)
        .filter((item): item is NonNullable<typeof item> => item !== null);

      setCharacterSkins(nextCharacterSkins);
      setCharacterSkinsReady(true);
    };

    socket.on("designer:section:state", handleState);
    socket.emit("designer:section:join", {
      sectionKey: "players",
    });

    return () => {
      socket.emit("designer:section:leave", { sectionKey: "players" });
      socket.off("designer:section:state", handleState);
    };
  }, [authReady, authenticated, socket]);

  useEffect(() => {
    if (user?.characterSkinId) {
      setSelectedSkinId(user.characterSkinId);
    }
  }, [user?.characterSkinId]);

  const selectedSkin = useMemo(
    () => characterSkins.find((skin) => skin.id === selectedSkinId) ?? null,
    [characterSkins, selectedSkinId]
  );

  return (
    <Box
      minH="100vh"
      bg="#050505"
      color="white"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        width="min(920px, 100%)"
        bg="rgba(17, 24, 39, 0.98)"
        border="1px solid rgba(255,255,255,0.16)"
        borderRadius="8px"
        p={{ base: 5, md: 8 }}
      >
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading size="lg">Choose your character skin.</Heading>
            <Text color="gray.300" mt={2}>
              Your starter is ready. Pick the trainer sprite set you want to use before entering the world.
            </Text>
          </Box>

          <Box>
            <Text fontWeight="700" mb={3}>Available character skins</Text>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              {characterSkins.map((skin) => {
                const previewSrc = getCharacterSkinPreview(skin.profile);

                return (
                  <Box
                    key={skin.id}
                    as="button"
                    type="button"
                    textAlign="left"
                    p={4}
                    borderRadius="8px"
                    border={
                      selectedSkinId === skin.id
                        ? "2px solid #38b2ac"
                        : "1px solid rgba(255,255,255,0.14)"
                    }
                    bg={
                      selectedSkinId === skin.id
                        ? "rgba(20, 184, 166, 0.16)"
                        : "whiteAlpha.100"
                    }
                    onClick={() => setSelectedSkinId(skin.id)}
                  >
                    <Box
                      minH="156px"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      borderRadius="8px"
                      bg="rgba(255,255,255,0.04)"
                      border="1px dashed rgba(255,255,255,0.12)"
                    >
                      {previewSrc ? (
                        <Box
                          as="img"
                          src={previewSrc}
                          alt={`${skin.name} preview`}
                          maxW="96px"
                          maxH="96px"
                          objectFit="contain"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <Text color="gray.400">No preview</Text>
                      )}
                    </Box>
                    <Text mt={3} fontWeight="800">{skin.name}</Text>
                    <HStack mt={1} spacing={2} flexWrap="wrap">
                      <Badge>{skin.category}</Badge>
                      {skin.profile.frontImageSrc ? <Badge colorScheme="green">Front</Badge> : null}
                      {skin.profile.backImageSrc ? <Badge colorScheme="green">Back</Badge> : null}
                    </HStack>
                  </Box>
                );
              })}
            </SimpleGrid>
            {characterSkinsReady && characterSkins.length === 0 ? (
              <Text color="yellow.200">
                No character skins are available. Create at least one in the designer first.
              </Text>
            ) : null}
          </Box>

          <Button
            colorScheme="teal"
            size="lg"
            isDisabled={!selectedSkin}
            onClick={() => {
              if (!selectedSkin) {
                return;
              }

              updateProfile({ characterSkinId: selectedSkin.id });
            }}
          >
            Enter the world as {selectedSkin?.name ?? "this trainer"}
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};

export default StartupCharacterSkinSelection;
