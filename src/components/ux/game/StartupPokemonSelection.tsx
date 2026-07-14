import {
  Avatar,
  Badge,
  Box,
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Text,
  VStack
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/authContext';
import type { DesignerItemSeed, DesignerPokemonProfile } from '../../designer/designerSections';
import { sanitizePokemonNicknameInput, validatePokemonNickname } from './pokemonName';

type StarterPokemon = {
  id: string;
  name: string;
  category: string;
  profile: DesignerPokemonProfile;
};

function toStarterPokemon(item: DesignerItemSeed): StarterPokemon | null {
  if (!item.pokemonProfile?.isInitialPokemon) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    profile: item.pokemonProfile
  };
}

const StartupPokemonSelection = () => {
  const { authReady, authenticated, chooseStarter, socket, user } = useAuth();
  const [selectedPokemonId, setSelectedPokemonId] = useState('');
  const [nickname, setNickname] = useState('');
  const [starters, setStarters] = useState<StarterPokemon[]>([]);
  const [startersReady, setStartersReady] = useState(false);

  useEffect(() => {
    if (!authReady || !authenticated || !socket) {
      return undefined;
    }

    const handleState = (payload: { sectionKey?: string; state?: { items?: DesignerItemSeed[] } }) => {
      if (payload.sectionKey && payload.sectionKey !== 'pokemons') {
        return;
      }

      const nextStarters = (payload.state?.items ?? [])
        .map(toStarterPokemon)
        .filter(Boolean) as StarterPokemon[];

      setStarters(nextStarters);
      setStartersReady(true);
    };

    socket.on('designer:section:state', handleState);
    socket.emit('designer:section:join', {
      sectionKey: 'pokemons'
    });

    return () => {
      socket.emit('designer:section:leave', { sectionKey: 'pokemons' });
      socket.off('designer:section:state', handleState);
    };
  }, [authReady, authenticated, socket]);

  const selectedPokemon = useMemo(
    () => starters.find((pokemon) => pokemon.id === selectedPokemonId) ?? null,
    [selectedPokemonId, starters]
  );
  const nicknameError = nickname ? validatePokemonNickname(nickname) : null;

  return (
    <Box minH="100vh" bg="#050505" color="white" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box width="min(920px, 100%)" bg="rgba(17, 24, 39, 0.98)" border="1px solid rgba(255,255,255,0.16)" borderRadius="8px" p={{ base: 5, md: 8 }}>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading size="lg">Welcome, trainer {user?.name}.</Heading>
            <Text color="gray.300" mt={2}>Pick your first Pokemon. You will choose your character skin on the next screen.</Text>
          </Box>

          <Box>
            <Text fontWeight="700" mb={3}>Choose one initial Pokemon</Text>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              {starters.map((pokemon) => (
                <Box
                  key={pokemon.id}
                  as="button"
                  type="button"
                  textAlign="left"
                  p={4}
                  borderRadius="8px"
                  border={selectedPokemonId === pokemon.id ? '2px solid #38b2ac' : '1px solid rgba(255,255,255,0.14)'}
                  bg={selectedPokemonId === pokemon.id ? 'rgba(20, 184, 166, 0.16)' : 'whiteAlpha.100'}
                  onClick={() => setSelectedPokemonId(pokemon.id)}
                >
                  <HStack spacing={3}>
                    <Avatar name={pokemon.name} src={pokemon.profile.iconImageSrc} />
                    <Box>
                      <Text fontWeight="800">{pokemon.name}</Text>
                      <HStack mt={1}>
                        {pokemon.profile.elements.map((element) => <Badge key={element}>{element}</Badge>)}
                      </HStack>
                    </Box>
                  </HStack>
                  <Text mt={3} color="gray.300" fontSize="sm">
                    HP {pokemon.profile.hp} • Skills {pokemon.profile.skills.slice(0, 4).map((skill) => skill.skillName).join(', ') || 'None'}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
            {startersReady && starters.length === 0 ? (
              <Text color="yellow.200">No initial Pokemon are available. Mark at least one Pokemon as Initial Pokemon in the designer.</Text>
            ) : null}
          </Box>

          <FormControl isInvalid={Boolean(nicknameError)}>
            <FormLabel>Pokemon name (optional)</FormLabel>
            <Input
              value={nickname}
              maxLength={10}
              placeholder="Letters only"
              onChange={(event) => setNickname(sanitizePokemonNicknameInput(event.target.value))}
            />
            <FormHelperText color={nicknameError ? 'red.200' : 'gray.300'}>
              {nicknameError ?? (nickname ? 'This name is permanent once your Pokemon joins your team.' : `Leave blank to keep ${selectedPokemon?.name ?? 'the Pokemon'}'s species name.`)}
            </FormHelperText>
          </FormControl>

          <Button
            colorScheme="teal"
            size="lg"
            isDisabled={!selectedPokemon || Boolean(nicknameError)}
            onClick={() => {
              if (!selectedPokemon || nicknameError) {
                return;
              }

              chooseStarter({ pokemonId: selectedPokemon.id, nickname: nickname.trim() });
            }}
          >
            Continue with {selectedPokemon?.name ?? 'Pokemon'}
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};

export default StartupPokemonSelection;
