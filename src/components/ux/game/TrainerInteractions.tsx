import {
  Avatar,
  Box,
  Button,
  HStack,
  Text,
  VStack
} from "@chakra-ui/react";
import { useContext } from "react";
import type { SyntheticEvent } from "react";
import { AppContext } from "../../../context/appContext";

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

export function TrainerInteractionCard() {
  const { socket, selectedTrainer, setSelectedTrainer } = useContext(AppContext);

  if (!selectedTrainer) {
    return null;
  }

  const displayName = selectedTrainer.username || selectedTrainer.name || "Trainer";

  return (
    <Box
      position="fixed"
      right={{ base: 3, md: 6 }}
      top={{ base: 20, md: 24 }}
      width={{ base: "calc(100vw - 24px)", sm: "340px" }}
      maxW="calc(100vw - 24px)"
      bg="rgba(17, 24, 39, 0.97)"
      border="1px solid rgba(255,255,255,0.18)"
      borderRadius="8px"
      boxShadow="0 24px 60px rgba(0,0,0,0.42)"
      color="white"
      p={4}
      zIndex={3900}
      data-game-ux="true"
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
    >
      <HStack align="center" spacing={3}>
        <Avatar name={displayName} src={selectedTrainer.profileImage} />
        <Box minW={0}>
          <Text fontSize="lg" fontWeight="800" noOfLines={1}>{displayName}</Text>
          <Text color="gray.300" fontSize="sm" noOfLines={2}>
            {selectedTrainer.description || "Ready for a challenge."}
          </Text>
        </Box>
      </HStack>
      <VStack mt={4} spacing={3} align="stretch">
        <Button
          colorScheme="red"
          onClick={() => {
            socket.emit("battle:challenge-player", {
              targetPlayerId: selectedTrainer.playerId
            });
            setSelectedTrainer(null);
          }}
        >
          Challenge to Battle
        </Button>
        <Button
          variant="outline"
          color="white"
          borderColor="whiteAlpha.500"
          onClick={() => {
            socket.emit("battle:trade-request", {
              targetPlayerId: selectedTrainer.playerId
            });
            setSelectedTrainer(null);
          }}
        >
          Trade Request
        </Button>
        <Button variant="ghost" color="gray.200" onClick={() => setSelectedTrainer(null)}>
          Close
        </Button>
      </VStack>
    </Box>
  );
}

export function BattlePrompts() {
  const { socket, battlePrompts, removeBattlePrompt } = useContext(AppContext);

  if (battlePrompts.length === 0) {
    return null;
  }

  const prompt = battlePrompts[0];
  const isBattlePrompt = prompt.type === "battle";

  return (
    <Box
      position="fixed"
      left="50%"
      top="18px"
      transform="translateX(-50%)"
      width={{ base: "calc(100vw - 24px)", sm: "430px" }}
      maxW="calc(100vw - 24px)"
      bg="rgba(17, 24, 39, 0.98)"
      border="1px solid rgba(255,255,255,0.18)"
      borderRadius="8px"
      boxShadow="0 18px 44px rgba(0,0,0,0.38)"
      color="white"
      p={4}
      zIndex={4300}
      data-game-ux="true"
      onClick={stopUxEvent}
      onMouseDown={stopUxEvent}
      onPointerDown={stopUxEvent}
    >
      <Text fontWeight="800">
        {isBattlePrompt
          ? `${prompt.fromUsername} is challenging you to battle.`
          : `${prompt.fromUsername} wants to trade with you.`}
      </Text>
      <HStack mt={4} justify="flex-end">
        <Button
          variant="ghost"
          color="gray.200"
          onClick={() => {
            socket.emit(isBattlePrompt ? "battle:challenge-response" : "battle:trade-response", {
              [isBattlePrompt ? "challengeId" : "requestId"]: prompt.id,
              accepted: false
            });
            removeBattlePrompt(prompt.id);
          }}
        >
          Ignore
        </Button>
        <Button
          colorScheme={isBattlePrompt ? "red" : "teal"}
          onClick={() => {
            socket.emit(isBattlePrompt ? "battle:challenge-response" : "battle:trade-response", {
              [isBattlePrompt ? "challengeId" : "requestId"]: prompt.id,
              accepted: true
            });
            removeBattlePrompt(prompt.id);
          }}
        >
          Accept
        </Button>
      </HStack>
    </Box>
  );
}
