import {
  Box,
  Button,
  HStack,
  Spinner,
  Text,
  VStack
} from "@chakra-ui/react";
import { useContext, useEffect, useState } from "react";
import type { CSSProperties, ReactNode, SyntheticEvent } from "react";
import { AppContext } from "../../../context/appContext";
import { useGameSettings } from "../../../settings/gameSettings";
import { useT } from "../../../i18n";
import { TrainerCardView, type TrainerCardTeamMember } from "./TrainerCard";
import { useSocial } from "./social/SocialContext";
import { UX_LAYER } from "../layers";

/** The public trainer card the server returns for another player. */
type FetchedTrainerCard = {
  playerId: string;
  userId: number | null;
  name: string;
  username: string;
  /** Account identity (`accountId` = `userId`, `accountName` = `username`). */
  accountId: number | null;
  accountName: string;
  /** Active character identity (`characterName` is the display-primary name). */
  characterId: number | null;
  characterName: string;
  description: string;
  characterSkinId: string;
  trainerCardColor: string;
  badges: number[];
  party: TrainerCardTeamMember[];
};

function stopUxEvent(event: SyntheticEvent) {
  event.stopPropagation();
}

export function TrainerInteractionCard() {
  const { socket, selectedTrainer, setSelectedTrainer } = useContext(AppContext);
  const [gameSettings] = useGameSettings();
  const t = useT();
  const social = useSocial();
  const [card, setCard] = useState<FetchedTrainerCard | null>(null);

  const targetPlayerId: string | undefined = selectedTrainer?.playerId;

  // Fetch the clicked player's public trainer card (medals, skin, team). The
  // reply arrives on the same game socket; ignore stale replies for a player
  // we've since stopped inspecting.
  useEffect(() => {
    if (!socket || !targetPlayerId) {
      setCard(null);
      return undefined;
    }

    setCard(null);
    const handleCard = (data: FetchedTrainerCard) => {
      if (data.playerId === targetPlayerId) {
        setCard(data);
      }
    };
    socket.on("trainer:card-data", handleCard);
    socket.emit("trainer:card", { targetPlayerId });

    return () => {
      socket.off("trainer:card-data", handleCard);
    };
  }, [socket, targetPlayerId]);

  if (!selectedTrainer) {
    return null;
  }

  // Character name is display-primary; the @account handle is secondary.
  const displayName =
    card?.characterName ||
    selectedTrainer.characterName ||
    selectedTrainer.name ||
    selectedTrainer.username ||
    "Trainer";

  return (
    <Box
      // Settings -> Display -> NPC dialog size.
      style={{ zoom: gameSettings.uiScale.dialogs } as CSSProperties}
      position="fixed"
      right={{ base: 3, md: 6 }}
      top={{ base: 20, md: 24 }}
      width={{ base: "calc(100vw - 24px)", sm: "360px" }}
      maxW="calc(100vw - 24px)"
      maxH="calc(100dvh - 96px)"
      overflowY="auto"
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
      <TrainerCardView
        name={displayName}
        username={card?.accountName || card?.username || selectedTrainer.username}
        description={card?.description ?? selectedTrainer.description}
        characterSkinId={card?.characterSkinId ?? selectedTrainer.characterSkinId}
        badges={card?.badges ?? []}
        team={card?.party ?? []}
        colorKey={card?.trainerCardColor}
        medalsLabel={t('trainer.gymMedals')}
        teamLabel={t('trainer.team')}
        noDescription={t('trainer.readyForChallenge')}
      />
      {!card ? (
        <HStackCentered>
          <Spinner size="sm" />
          <Text color="gray.300" fontSize="sm">{t('trainer.loadingCard')}</Text>
        </HStackCentered>
      ) : null}
      {(() => {
        // Friendship status + actions once the card (with userId) arrived.
        const targetUserId = card?.userId ?? null;
        if (targetUserId === null || targetUserId === social.myUserId) {
          return null;
        }
        // Friendship and blocking are account-level: prefer the account id
        // from the card, falling back to the legacy userId (they are equal).
        const targetAccountId = card?.accountId ?? targetUserId;
        const targetAccountName = card?.accountName || card?.username || '';
        const isFriend = social.friends.some((friend) => friend.userId === targetUserId);
        const isBlocked = social.blocked.some((entry) => entry.accountId === targetAccountId);
        const requestPending =
          social.outgoing.some((request) => request.userId === targetUserId) ||
          social.incoming.some((request) => request.userId === targetUserId);
        return (
          <VStack mt={4} spacing={2} align="stretch">
            {isFriend ? (
              <Text color="green.300" fontSize="sm" fontWeight="700" textAlign="center">
                {t('trainer.isFriend')}
              </Text>
            ) : (
              <Button
                colorScheme="teal"
                variant={requestPending ? 'outline' : 'solid'}
                isDisabled={requestPending}
                onClick={() => {
                  if (typeof card?.accountId === 'number') {
                    social.requestFriendByAccountId(card.accountId);
                  } else if (card?.username) {
                    social.requestFriend(card.username);
                  }
                }}
              >
                {requestPending ? t('trainer.friendRequestPending') : t('trainer.addFriend')}
              </Button>
            )}
            {isBlocked ? (
              <Text color="red.300" fontSize="sm" fontWeight="700" textAlign="center">
                {t('trainer.blocked')}
              </Text>
            ) : (
              <Button
                variant="outline"
                colorScheme="red"
                onClick={() => {
                  if (
                    window.confirm(t('trainer.blockConfirm', { name: targetAccountName })) &&
                    typeof targetAccountId === 'number'
                  ) {
                    social.blockAccount(targetAccountId);
                    setSelectedTrainer(null);
                  }
                }}
              >
                {t('trainer.block')}
              </Button>
            )}
            {isFriend ? (
              <Button
                variant="outline"
                color="white"
                borderColor="whiteAlpha.500"
                onClick={() => {
                  social.createPrivateChat([targetUserId]);
                  setSelectedTrainer(null);
                }}
              >
                {t('trainer.privateChat')}
              </Button>
            ) : null}
          </VStack>
        );
      })()}
      <VStack mt={4} spacing={3} align="stretch">
        <Button
          colorScheme="red"
          onClick={() => {
            socket.emit("battle:challenge-player", { targetPlayerId: selectedTrainer.playerId });
            setSelectedTrainer(null);
          }}
        >
          {t('trainer.challenge')}
        </Button>
        <Button
          variant="outline"
          color="white"
          borderColor="whiteAlpha.500"
          onClick={() => {
            // Opens a real trade session (TradeManager) — see the trade/ module.
            socket.emit("trade:request", { targetPlayerId: selectedTrainer.playerId });
            setSelectedTrainer(null);
          }}
        >
          {t('trainer.trade')}
        </Button>
        <Button variant="ghost" color="gray.200" onClick={() => setSelectedTrainer(null)}>
          {t('trainer.close')}
        </Button>
      </VStack>
    </Box>
  );
}

function HStackCentered({ children }: { children: ReactNode }) {
  return (
    <Box mt={3} display="flex" alignItems="center" justifyContent="center" gap={2}>
      {children}
    </Box>
  );
}

export function BattlePrompts() {
  const { socket, battlePrompts, removeBattlePrompt } = useContext(AppContext);
  const [gameSettings] = useGameSettings();

  if (battlePrompts.length === 0) {
    return null;
  }

  const prompt = battlePrompts[0];
  const isBattlePrompt = prompt.type === "battle";

  return (
    <Box
      // Settings -> Display -> NPC dialog size.
      style={{ zoom: gameSettings.uiScale.dialogs } as CSSProperties}
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
      // Incoming request: must stay clickable over an open system window or a
      // full-screen takeover. See ../layers.ts.
      zIndex={UX_LAYER.TAKEOVER_PROMPT}
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
