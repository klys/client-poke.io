import {
  Avatar,
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Radio,
  RadioGroup,
  SimpleGrid,
  Text,
  VStack
} from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/authContext';
import type { DesignerItemSeed, DesignerPokemonProfile } from '../../designer/designerSections';

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
  const [gender, setGender] = useState(user?.trainerGender || '');
  const [selectedPokemonId, setSelectedPokemonId] = useState('');
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

  return (
    <Box minH="100vh" bg="#050505" color="white" display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box width="min(920px, 100%)" bg="rgba(17, 24, 39, 0.98)" border="1px solid rgba(255,255,255,0.16)" borderRadius="8px" p={{ base: 5, md: 8 }}>
        <VStack align="stretch" spacing={6}>
          <Box>
            <Heading size="lg">Welcome, trainer {user?.name}.</Heading>
            <Text color="gray.300" mt={2}>Before you enter the first map, choose how you want to be addressed and pick your first Pokemon.</Text>
          </Box>

          <FormControl>
            <FormLabel>Trainer gender</FormLabel>
            <RadioGroup value={gender} onChange={setGender}>
              <HStack spacing={5} flexWrap="wrap">
                <Radio value="female">Female</Radio>
                <Radio value="male">Male</Radio>
                <Radio value="nonbinary">Non-binary</Radio>
              </HStack>
            </RadioGroup>
          </FormControl>

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

          <Button
            colorScheme="teal"
            size="lg"
            isDisabled={!gender || !selectedPokemon}
            onClick={() => {
              if (!selectedPokemon) {
                return;
              }

              chooseStarter({ gender, pokemonId: selectedPokemon.id });
            }}
          >
            Start with {selectedPokemon?.name ?? 'Pokemon'}
          </Button>
        </VStack>
      </Box>
    </Box>
  );
};

export default StartupPokemonSelection;
