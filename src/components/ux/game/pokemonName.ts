export const POKEMON_NICKNAME_MAX_LENGTH = 10;

const POKEMON_NICKNAME_PATTERN = /^[A-Za-z]{1,10}$/;
const BLOCKED_POKEMON_NICKNAMES = new Set([
  'ass',
  'bastard',
  'bitch',
  'bollocks',
  'crap',
  'cunt',
  'damn',
  'dick',
  'fag',
  'fuck',
  'hoe',
  'nazi',
  'piss',
  'prick',
  'pussy',
  'shit',
  'slut',
  'twat',
  'whore'
]);

export type PokemonNameLike = {
  name: string;
  nickname?: string;
};

export function sanitizePokemonNicknameInput(value: string) {
  return value.replace(/[^A-Za-z]/g, '').slice(0, POKEMON_NICKNAME_MAX_LENGTH);
}

export function validatePokemonNickname(value: string) {
  const nickname = value.trim();

  if (!POKEMON_NICKNAME_PATTERN.test(nickname)) {
    return 'Use letters only, no spaces, up to 10 characters.';
  }

  if (BLOCKED_POKEMON_NICKNAMES.has(nickname.toLowerCase())) {
    return 'Choose a respectful name.';
  }

  return null;
}

export function getPokemonDisplayName(pokemon: PokemonNameLike) {
  return pokemon.nickname ? `${pokemon.nickname} (${pokemon.name})` : pokemon.name;
}
