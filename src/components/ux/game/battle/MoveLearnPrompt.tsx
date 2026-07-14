import { Box, Button, HStack, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import type { PendingLearnPrompt } from "./useBattleEventQueue";

/**
 * "X wants to learn Y" prompt. The pokemon already knows four moves, so the
 * player picks one to forget or skips learning. Resolved through the
 * `battle:learn-move` socket event; the server keeps the request pending
 * until answered.
 */
export default function MoveLearnPrompt({
  prompt,
  onResolve
}: {
  prompt: PendingLearnPrompt;
  onResolve: (moveName: string, replaceMoveName: string | null) => void;
}) {
  const [choosing, setChoosing] = useState(false);

  return (
    <Box
      position="absolute"
      left="50%"
      bottom={{ base: "160px", md: "200px" }}
      transform="translateX(-50%)"
      zIndex={32}
      bg="#f8f4e8"
      color="#3a3a32"
      border="3px solid #55524a"
      borderRadius="10px"
      boxShadow="6px 6px 0 rgba(30,30,30,0.4)"
      px={4}
      py={3}
      width={{ base: "min(94vw, 340px)", md: "380px" }}
    >
      <Text fontWeight="900" fontSize="sm">
        {prompt.pokemonName} wants to learn {prompt.moveName}!
      </Text>
      {!choosing ? (
        <HStack mt={2} spacing={2}>
          <Button size="sm" colorScheme="orange" flex="1" onClick={() => setChoosing(true)}>
            Forget a move
          </Button>
          <Button
            size="sm"
            variant="outline"
            colorScheme="gray"
            flex="1"
            onClick={() => onResolve(prompt.moveName, null)}
          >
            Skip {prompt.moveName}
          </Button>
        </HStack>
      ) : (
        <VStack mt={2} spacing={1.5} align="stretch">
          <Text fontSize="xs" fontWeight="700" color="#6b675c">
            Which move should be forgotten?
          </Text>
          {prompt.currentMoves.map((moveName) => (
            <Button
              key={moveName}
              size="sm"
              variant="outline"
              colorScheme="purple"
              justifyContent="space-between"
              onClick={() => onResolve(prompt.moveName, moveName)}
            >
              <Text as="span" noOfLines={1}>{moveName}</Text>
              <Text as="span" fontSize="xs" color="#9c4221">forget</Text>
            </Button>
          ))}
          <Button size="xs" variant="ghost" onClick={() => setChoosing(false)}>
            Back
          </Button>
        </VStack>
      )}
    </Box>
  );
}
