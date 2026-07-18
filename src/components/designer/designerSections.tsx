import React from "react";
import { Icon, type IconProps } from "@chakra-ui/react";
import type { DesignerTilesetProfile } from "../tilemap/tileMapTypes";

export type { DesignerTilesetProfile } from "../tilemap/tileMapTypes";

export type DesignerIconName =
  | "playableMaps"
  | "skillGfx"
  | "pokemons"
  | "mapObjects"
  | "items"
  | "pokemonSkills"
  | "passiveStates"
  | "players"
  | "regions"
  | "npcs"
  | "levelingCurve"
  | "database";

export type DesignerSectionKey =
  | "mapsEditor"
  | "skillsGfx"
  | "pokemons"
  | "objects"
  | "items"
  | "skills"
  | "passiveStates"
  | "players"
  | "regions"
  | "npcs"
  | "levelingCurve"
  | "abilities"
  | "types"
  | "trainers"
  | "trainerTypes"
  | "encounters"
  | "berries"
  | "ribbons"
  | "assets"
  | "battleBackgrounds"
  | "audio"
  | "fonts"
  | "tilesets"
  | "battleInterface";

export interface DesignerItemDetail {
  label: string;
  value: string;
}

export type DesignerMapObjectType = "obstacle" | "mob area" | "floor" | "water";

export type PlayableMapConnectionDirection = "north" | "south" | "east" | "west";

export interface PlayableMapConnection {
  direction: PlayableMapConnectionDirection;
  targetMapId: string;
  /** Neighbor map's top-left cell relative to this map's top-left cell. */
  offsetXCells: number;
  offsetYCells: number;
}

export type DesignerMapSizePreset = "small" | "medium" | "large" | "custom";

export type DesignerPlayableMapType =
  | "grassland"
  | "sea"
  | "undersea"
  | "cave"
  | "interior"
  | "desert"
  | "forest"
  | "snow"
  | "island"
  | "mountain"
  | "swamp"
  | "volcanic"
  | "ruins"
  | "city";

export type DesignerPlayableMapBackgroundImageMode =
  | "repeat"
  | "centered"
  | "stretched";

export interface DesignerMapObjectAsset {
  imageSrc: string;
  width: number;
  height: number;
  objectType: DesignerMapObjectType;
}

export interface DesignerPokemonProfile {
  essentialsId?: string;
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
  isInitialPokemon: boolean;
  elements: string[];
  skills: DesignerPokemonSkillAssignment[];
  frontImageSrc: string;
  backImageSrc: string;
  iconImageSrc: string;
  genderRatio?: string;
  growthRate?: string;
  baseExp?: number;
  evs?: DesignerPokemonEvYield[];
  catchRate?: number;
  happiness?: number;
  abilities?: string[];
  hiddenAbilities?: string[];
  tutorMoves?: string[];
  eggMoves?: string[];
  eggGroups?: string[];
  hatchSteps?: number;
  height?: number;
  weight?: number;
  color?: string;
  shape?: string;
  habitat?: string;
  pokedex?: string;
  generation?: number;
  evolutions?: DesignerPokemonEvolution[];
  forms?: DesignerPokemonFormProfile[];
  metrics?: DesignerPokemonMetricsProfile;
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerPokemonSkillAssignment {
  skillId: string;
  skillName: string;
  level: number;
  sourceMoveId?: string;
}

export interface DesignerPokemonEvYield {
  stat: string;
  value: number;
}

export interface DesignerPokemonEvolution {
  targetId: string;
  method: string;
  parameter?: string | number | boolean | null;
}

export interface DesignerPokemonFormProfile {
  formId: string;
  formName?: string;
  properties: Record<string, unknown>;
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerPokemonMetricsProfile {
  backSprite?: [number, number];
  frontSprite?: [number, number];
  frontSpriteAltitude?: number;
  shadowX?: number;
  shadowSize?: number;
  raw?: Record<string, unknown>;
  source?: DesignerEssentialsSourceProfile;
}

export type DesignerWeatherEffect =
  | "None"
  | "Sunny Day"
  | "Rain"
  | "Sandstorm"
  | "Snow"
  | "Strong Winds";

export interface DesignerPokemonSkillProfile {
  essentialsId?: string;
  elements: string[];
  power: number;
  powerPoint: number;
  accuracy: number;
  category?: string;
  target?: string;
  functionCode?: string;
  flags?: string[];
  priority?: number;
  description: string;
  effectText?: string;
  skillGfxId: string;
  skillGfxName: string;
  animationId?: string;
  animationName?: string;
  weatherEffect: DesignerWeatherEffect;
  inflictStateId: string;
  inflictStateName: string;
  cooldown: number;
  stateConditionId: string;
  stateConditionName: string;
  source?: DesignerEssentialsSourceProfile;
}

export type DesignerSkillGfxApplyTo =
  | "caster"
  | "selected foe"
  | "multiple foes"
  | "all combatants"
  | "selectable friend";

export interface DesignerSkillGfxProfile {
  mediaSrc: string;
  applyTo: DesignerSkillGfxApplyTo;
  appear: number;
  essentialsAnimationId?: number;
  essentialsAnimationIndex?: number;
  essentialsAnimationName?: string;
  animationKind?: "sheet" | "record" | "battle-animation" | "other";
  graphic?: string;
  sourcePath?: string;
  outputPath?: string;
  sheetSourcePath?: string;
  sheetOutputPath?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  cellSize?: number;
  columns?: number;
  rows?: number;
  frameCount?: number;
  fps?: number;
  durationMs?: number;
  hue?: number;
  position?: number;
  speed?: number;
  warnings?: string[];
  linkedMoveIds?: string[];
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerLevelingCurveProfile {
  startExpForNextLevel: number;
  expGainedPerBattle: number;
  bonusDefeatingHigherLevelFormula: string;
  debonusDefeatingLowerLevelFormula: string;
  percentageExpIncreaseNextLevel: number;
}

export type DesignerItemType =
  | "usable"
  | "medicine"
  | "battle items"
  | "pokeball"
  | "hold items"
  | "skill item"
  | "machines"
  | "general items"
  | "berries"
  | "quest item";

export interface DesignerItemStatModifiers {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  speed: number;
}

export interface DesignerGameItemProfile {
  essentialsId?: string;
  iconSrc: string;
  description: string;
  namePlural?: string;
  pocket?: string;
  price?: number;
  fieldUse?: string;
  flags?: string[];
  pokemonDbCategory: string;
  effectText: string;
  effectKind: "none" | "heal-hp" | "stat-modifier" | "teach-move" | "catch-modifier" | "hold-effect" | "key-item";
  useCondition: "none" | "target-missing-hp" | "target-can-learn-move" | "battle-only";
  type: DesignerItemType;
  statModifiers: DesignerItemStatModifiers;
  skillId: string;
  skillName: string;
  pokeballBonusElements: string[];
  pokeballBonusRatio: number;
  source?: DesignerEssentialsSourceProfile;
}

export type DesignerNpcAiType = "standing" | "moving" | "scriptable";

// "pc" is a runtime-only type used by synthetic placements the event runtime
// creates for Pokemon Center / bedroom computers (pbPokeCenterPC); it is not
// offered in the designer NPC palette.
export type DesignerNpcType = "healer" | "trainer" | "store" | "chest" | "sign" | "pc";

export type DesignerNpcGraphicsSource = "custom" | "characterSkin";

export interface DesignerNpcGraphicsProfile {
  standingUpSrc: string;
  standingDownSrc: string;
  standingLeftSrc: string;
  standingRightSrc: string;
  walkingUpSrc: string;
  walkingDownSrc: string;
  walkingLeftSrc: string;
  walkingRightSrc: string;
  chestImageSrc: string;
  trainerFrontImageSrc: string;
}

export interface DesignerCharacterSkinProfile {
  standingUpSrc: string;
  standingDownSrc: string;
  standingLeftSrc: string;
  standingRightSrc: string;
  walkingUpSrc: string;
  walkingDownSrc: string;
  walkingLeftSrc: string;
  walkingRightSrc: string;
  frontImageSrc: string;
  backImageSrc: string;
}

export interface DesignerNpcTrainerPokemon {
  pokemonId: string;
  pokemonName: string;
  level: number;
  moves?: string[];
  ability?: string;
  itemId?: string;
}

export interface DesignerNpcStoreItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
}

export interface DesignerNpcChestItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface DesignerNpcProfile {
  essentialsId?: string;
  aiType: DesignerNpcAiType;
  npcType: DesignerNpcType;
  trainerTypeId?: string;
  trainerTypeName?: string;
  loseText?: string;
  eventCommands?: DesignerMapEventCommandProfile[];
  graphicsSource: DesignerNpcGraphicsSource;
  characterSkinId: string;
  characterSkinName: string;
  movementIntervalMinSeconds: number;
  movementIntervalMaxSeconds: number;
  movementStepMin: number;
  movementStepMax: number;
  scriptSource: string;
  healPrice: number;
  trainerPokemons: DesignerNpcTrainerPokemon[];
  storeMoney: number;
  storeItems: DesignerNpcStoreItem[];
  chestSlotCapacity: number;
  chestItems: DesignerNpcChestItem[];
  graphics: DesignerNpcGraphicsProfile;
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerEssentialsSourceProfile {
  project: "Pokemon Essentials v21.1";
  sourcePath: string;
  sectionId?: string;
  lineNumber?: number;
  originalId?: string;
  originalName?: string;
}

export interface DesignerMapEventCommandProfile {
  code: number;
  parameters: unknown[];
  indent?: number;
}

export interface DesignerAbilityProfile {
  essentialsId: string;
  name: string;
  description: string;
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerTypeProfile {
  essentialsId: string;
  name: string;
  iconPosition?: number;
  weaknesses: string[];
  resistances?: string[];
  immunities: string[];
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerTrainerTypeProfile {
  essentialsId: string;
  name: string;
  baseMoney?: number;
  battleBgm?: string;
  victoryMe?: string;
  gender?: string;
  skillLevel?: number;
  flags?: string[];
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerTrainerPokemonProfile {
  pokemonId: string;
  level: number;
  name?: string;
  form?: number;
  gender?: string;
  ability?: string;
  itemId?: string;
  moves?: string[];
  nature?: string;
  ivs?: Record<string, number>;
  evs?: Record<string, number>;
}

export interface DesignerTrainerProfile {
  essentialsId: string;
  trainerTypeId: string;
  trainerTypeName?: string;
  version?: number;
  name: string;
  party: DesignerTrainerPokemonProfile[];
  items?: string[];
  loseText?: string;
  battleBgm?: string;
  victoryMe?: string;
  sourceEventIds?: string[];
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerEncounterRowProfile {
  weight: number;
  pokemonId: string;
  minLevel: number;
  maxLevel: number;
}

export interface DesignerEncounterTableProfile {
  method: string;
  density?: number;
  rows: DesignerEncounterRowProfile[];
}

export interface DesignerEncounterProfile {
  mapId: string;
  mapVersion?: number;
  mapName?: string;
  tables: DesignerEncounterTableProfile[];
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerBerryPlantProfile {
  essentialsId: string;
  hoursPerStage?: number;
  dryRatePerHour?: number;
  minimumYield?: number;
  maximumYield?: number;
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerRibbonProfile {
  essentialsId: string;
  name: string;
  description: string;
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerAssetFrameProfile {
  index: number;
  x?: number;
  y?: number;
  width: number;
  height: number;
  durationMs?: number;
  outputPath?: string;
}

export interface DesignerAssetProfile {
  assetId: string;
  sourcePath: string;
  dataUri?: string;
  imageSrc?: string;
  kind: "image" | "gif" | "sprite-sheet" | "tileset" | "battleback" | "animation" | "ui" | "audio" | "font" | "other";
  width?: number;
  height?: number;
  mimeType?: string;
  frameCount?: number;
  loop?: boolean;
  frames?: DesignerAssetFrameProfile[];
  relatedRecordIds?: string[];
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerBattleBackgroundProfile extends DesignerAssetProfile {
  kind: "battleback";
  environment?: string;
  mapIds?: string[];
  componentAssetIds?: string[];
  componentAssets?: Array<DesignerAssetProfile & {
    role?: string;
    filename?: string;
    byteSize?: number;
  }>;
}

export interface DesignerAudioProfile {
  assetId: string;
  sourcePath: string;
  kind: "BGM" | "ME" | "SE";
  loop?: boolean;
  volume?: number;
  pitch?: number;
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerFontProfile {
  assetId: string;
  sourcePath: string;
  familyName?: string;
  source?: DesignerEssentialsSourceProfile;
}

/**
 * Battle scene customization. Read by the game runtime through the designer
 * cache (see ux/game/battle/battleInterfaceConfig.ts for defaults/sanitizing).
 */
export interface DesignerBattleInterfaceProfile {
  battleBackgroundId?: string;
  backgroundImageSrc?: string;
  playerBaseImageSrc?: string;
  enemyBaseImageSrc?: string;
  databoxPlayerColor?: string;
  databoxEnemyColor?: string;
  databoxTextColor?: string;
  messageBoxColor?: string;
  messageBoxTextColor?: string;
  messageBoxBorderColor?: string;
  messageRows?: number;
  textSpeedMsPerChar?: number;
  battleBgmSrc?: string;
  victoryMeSrc?: string;
  wildIntroSeSrc?: string;
  trainerIntroSeSrc?: string;
  bgmVolume?: number;
  seVolume?: number;
  muteBgm?: boolean;
  muteSe?: boolean;
  introTransition?:
    | "random"
    | "flash-wipe"
    | "fade"
    | "iris"
    | "blinds"
    | "checker"
    | "shutter"
    | "none";
  animationSpeed?: number;
  showBattleLog?: boolean;
  logRows?: number;
}

export interface DesignerItemCreateOptions {
  mapObjectAsset?: DesignerMapObjectAsset;
  playableMapConfig?: DesignerPlayableMapConfig;
  pokemonProfile?: DesignerPokemonProfile;
  pokemonSkillProfile?: DesignerPokemonSkillProfile;
  skillGfxProfile?: DesignerSkillGfxProfile;
  levelingCurveProfile?: DesignerLevelingCurveProfile;
  itemProfile?: DesignerGameItemProfile;
  npcProfile?: DesignerNpcProfile;
  characterSkinProfile?: DesignerCharacterSkinProfile;
  abilityProfile?: DesignerAbilityProfile;
  typeProfile?: DesignerTypeProfile;
  trainerProfile?: DesignerTrainerProfile;
  trainerTypeProfile?: DesignerTrainerTypeProfile;
  encounterProfile?: DesignerEncounterProfile;
  berryPlantProfile?: DesignerBerryPlantProfile;
  ribbonProfile?: DesignerRibbonProfile;
  assetProfile?: DesignerAssetProfile;
  battleBackgroundProfile?: DesignerBattleBackgroundProfile;
  audioProfile?: DesignerAudioProfile;
  fontProfile?: DesignerFontProfile;
  tilesetProfile?: DesignerTilesetProfile;
  battleInterfaceProfile?: DesignerBattleInterfaceProfile;
}

export interface DesignerItemSeed {
  id: string;
  name: string;
  category: string;
  details: DesignerItemDetail[];
  mapObjectAsset?: DesignerMapObjectAsset;
  playableMapConfig?: DesignerPlayableMapConfig;
  pokemonProfile?: DesignerPokemonProfile;
  pokemonSkillProfile?: DesignerPokemonSkillProfile;
  skillGfxProfile?: DesignerSkillGfxProfile;
  levelingCurveProfile?: DesignerLevelingCurveProfile;
  itemProfile?: DesignerGameItemProfile;
  npcProfile?: DesignerNpcProfile;
  characterSkinProfile?: DesignerCharacterSkinProfile;
  abilityProfile?: DesignerAbilityProfile;
  typeProfile?: DesignerTypeProfile;
  trainerProfile?: DesignerTrainerProfile;
  trainerTypeProfile?: DesignerTrainerTypeProfile;
  encounterProfile?: DesignerEncounterProfile;
  berryPlantProfile?: DesignerBerryPlantProfile;
  ribbonProfile?: DesignerRibbonProfile;
  assetProfile?: DesignerAssetProfile;
  battleBackgroundProfile?: DesignerBattleBackgroundProfile;
  audioProfile?: DesignerAudioProfile;
  fontProfile?: DesignerFontProfile;
  tilesetProfile?: DesignerTilesetProfile;
  battleInterfaceProfile?: DesignerBattleInterfaceProfile;
}

export interface DesignerPlayableMapConfig {
  cellSize: number;
  sizePreset: DesignerMapSizePreset;
  width: number;
  height: number;
  isInitialMap: boolean;
  initialPositionX: number | null;
  initialPositionY: number | null;
  regionName: string;
  regionX: number;
  regionY: number;
  mapType: DesignerPlayableMapType;
  backgroundColor: string;
  backgroundImageSrc: string;
  backgroundImageMode: DesignerPlayableMapBackgroundImageMode;
  essentialsMapId?: string;
  essentialsMapName?: string;
  rxdataPath?: string;
  mapInfoId?: number;
  tilesetId?: number;
  tilesetName?: string;
  tilesetAssetId?: string;
  battleBack?: string;
  environment?: string;
  flags?: string[];
  outdoor?: boolean;
  showArea?: boolean;
  mapPosition?: {
    regionId?: number;
    x: number;
    y: number;
  };
  healingSpot?: {
    mapId: string;
    x: number;
    y: number;
    direction?: number;
  };
  bgm?: string;
  bgs?: string;
  connections?: PlayableMapConnection[];
  source?: DesignerEssentialsSourceProfile;
}

export interface DesignerSectionDefinition {
  key: DesignerSectionKey;
  title: string;
  description: string;
  path: string;
  itemLabel: string;
  itemLabelPlural: string;
  categoryLabel: string;
  icon: DesignerIconName;
  defaultCategories: string[];
  demoItems: DesignerItemSeed[];
  createDetails: (
    name: string,
    category: string,
    index: number,
    options?: DesignerItemCreateOptions
  ) => DesignerItemDetail[];
}

export function DesignerIcon(props: IconProps & { icon: DesignerIconName }) {
  const { icon, ...iconProps } = props;

  switch (icon) {
    case "playableMaps":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="M4 6.5 9 4l6 2.5L20 4v13.5L15 20l-6-2.5L4 20V6.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M9 4v13.5M15 6.5V20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </Icon>
      );
    case "skillGfx":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="m12 3 2.2 4.8L19 10l-4.8 2.2L12 17l-2.2-4.8L5 10l4.8-2.2L12 3Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M18 16.5 19.2 19 22 20.2 19.2 21.4 18 24l-1.2-2.6L14 20.2l2.8-1.2L18 16.5Z"
            transform="scale(.75) translate(8 -1)"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Icon>
      );
    case "pokemons":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <circle
            cx="12"
            cy="12"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M4 12h16M12 4a4.2 4.2 0 0 1 0 8 4.2 4.2 0 0 0 0 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="1.8" fill="currentColor" />
        </Icon>
      );
    case "mapObjects":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="M12 4 5 8v8l7 4 7-4V8l-7-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M5 8l7 4 7-4M12 12v8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Icon>
      );
    case "items":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="M8 6h8l2 4-6 9-6-9 2-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M10 6 9 10h6l-1-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </Icon>
      );
    case "pokemonSkills":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="M12 4v5M12 15v5M4 12h5M15 12h5M6.3 6.3l3.5 3.5M14.2 14.2l3.5 3.5M17.7 6.3l-3.5 3.5M9.8 14.2l-3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle
            cx="12"
            cy="12"
            r="3.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </Icon>
      );
    case "passiveStates":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="M12 4 5 7.5v5.2c0 4.4 3 6.8 7 8.1 4-1.3 7-3.7 7-8.1V7.5L12 4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 12.2 11.1 14.3 15.5 9.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Icon>
      );
    case "players":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <circle
            cx="12"
            cy="8"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M6 18a6 6 0 0 1 12 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M4 10.5a2.5 2.5 0 1 0 0-5M20 10.5a2.5 2.5 0 1 1 0-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </Icon>
      );
    case "regions":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="M12 3 4 7v5c0 5 3.5 7.7 8 9 4.5-1.3 8-4 8-9V7l-8-4Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 12.5 11 14.5 15.5 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Icon>
      );
    case "npcs":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <circle
            cx="9"
            cy="9"
            r="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <circle
            cx="16.5"
            cy="10.5"
            r="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M4.5 18a4.5 4.5 0 0 1 9 0M13 18a3.5 3.5 0 0 1 7 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </Icon>
      );
    case "levelingCurve":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <path
            d="M4 18h16M6 15.5l3.5-3.5 3 2.5 5-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="6" cy="15.5" r="1.2" fill="currentColor" />
          <circle cx="9.5" cy="12" r="1.2" fill="currentColor" />
          <circle cx="12.5" cy="14.5" r="1.2" fill="currentColor" />
          <circle cx="17.5" cy="8.5" r="1.2" fill="currentColor" />
        </Icon>
      );
    case "database":
      return (
        <Icon viewBox="0 0 24 24" {...iconProps}>
          <ellipse
            cx="12"
            cy="6"
            rx="7"
            ry="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </Icon>
      );
  }
}

const detail = (label: string, value: string): DesignerItemDetail => ({ label, value });

const pokemonDetailValue = (
  options: DesignerItemCreateOptions | undefined,
  key: keyof DesignerPokemonProfile,
  fallback: string | number
) => String(options?.pokemonProfile?.[key] ?? fallback);

const skillDetailValue = (
  options: DesignerItemCreateOptions | undefined,
  key: keyof DesignerPokemonSkillProfile,
  fallback: string | number
) => String(options?.pokemonSkillProfile?.[key] ?? fallback);

const skillGfxDetailValue = (
  options: DesignerItemCreateOptions | undefined,
  key: keyof DesignerSkillGfxProfile,
  fallback: string | number
) => String(options?.skillGfxProfile?.[key] ?? fallback);

function formatNpcMoney(value: number | undefined) {
  return `$${(value ?? 0).toLocaleString()}`;
}

function getNpcGraphicsSummary(profile?: DesignerNpcProfile) {
  if (!profile) {
    return "Missing";
  }

  if (profile.npcType === "chest") {
    return profile.graphics.chestImageSrc ? "Chest image ready" : "Chest image required";
  }

  if (profile.graphicsSource === "characterSkin") {
    return profile.characterSkinName
      ? `Using skin: ${profile.characterSkinName}`
      : "Character skin required";
  }

  const directionalImages = [
    profile.graphics.standingUpSrc,
    profile.graphics.standingDownSrc,
    profile.graphics.standingLeftSrc,
    profile.graphics.standingRightSrc,
    profile.graphics.walkingUpSrc,
    profile.graphics.walkingDownSrc,
    profile.graphics.walkingLeftSrc,
    profile.graphics.walkingRightSrc,
  ];
  const hasDirectionalSet = directionalImages.every((value) => value.length > 0);

  if (profile.npcType === "trainer") {
    return hasDirectionalSet && profile.graphics.trainerFrontImageSrc
      ? "World + battle images ready"
      : "Battle/world images missing";
  }

  return hasDirectionalSet ? "World images ready" : "World images missing";
}

function getCharacterSkinGraphicsSummary(profile?: DesignerCharacterSkinProfile) {
  if (!profile) {
    return "0 / 8 uploaded";
  }

  const directionalImages = [
    profile.standingUpSrc,
    profile.standingDownSrc,
    profile.standingLeftSrc,
    profile.standingRightSrc,
    profile.walkingUpSrc,
    profile.walkingDownSrc,
    profile.walkingLeftSrc,
    profile.walkingRightSrc,
  ];
  const readyCount = directionalImages.filter((value) => value.length > 0).length;

  return `${readyCount} / 8 uploaded`;
}

function formatItemStatModifiers(modifiers?: DesignerItemStatModifiers) {
  if (!modifiers) {
    return "None";
  }

  const entries: Array<[keyof DesignerItemStatModifiers, string]> = [
    ["hp", "HP"],
    ["attack", "Attack"],
    ["defense", "Defense"],
    ["specialAttack", "Special Attack"],
    ["specialDefense", "Special Defense"],
    ["speed", "Speed"],
  ];
  const formatted = entries
    .filter(([key]) => modifiers[key] !== 0)
    .map(([key, label]) => `${label} ${modifiers[key] > 0 ? "+" : ""}${modifiers[key]}`);

  return formatted.length > 0 ? formatted.join(", ") : "None";
}

export const designerSections: DesignerSectionDefinition[] = [
  {
    key: "mapsEditor",
    title: "Playable Maps",
    description: "Edit the explorable maps that players can walk through and connect together.",
    path: "/designer/maps-editor",
    itemLabel: "map",
    itemLabelPlural: "maps",
    categoryLabel: "zone",
    icon: "playableMaps",
    defaultCategories: ["Starter Routes", "Dungeons", "Cities"],
    demoItems: [
      {
        id: "map-sungrass-plains",
        name: "Sungrass Plains",
        category: "Starter Routes",
        details: [
          detail("Cell Size", "32 px"),
          detail("Map Size", "500 x 500"),
          detail("Initial Game Map", "Yes"),
          detail("Initial Position", "Center"),
          detail("Region", "Ash Coast"),
          detail("Region Position", "0, 0"),
          detail("Map Type", "grassland"),
        ],
        playableMapConfig: {
          cellSize: 32,
          sizePreset: "medium",
          width: 500,
          height: 500,
          isInitialMap: true,
          initialPositionX: null,
          initialPositionY: null,
          regionName: "Ash Coast",
          regionX: 0,
          regionY: 0,
          mapType: "grassland",
          backgroundColor: "#8bc17f",
          backgroundImageSrc: "",
          backgroundImageMode: "repeat",
        },
      },
      {
        id: "map-amber-cavern",
        name: "Amber Cavern",
        category: "Dungeons",
        details: [
          detail("Cell Size", "16 px"),
          detail("Map Size", "30 x 30"),
          detail("Initial Game Map", "No"),
          detail("Initial Position", "Center"),
          detail("Region", "Fernwild"),
          detail("Region Position", "1, 2"),
          detail("Map Type", "cave"),
        ],
        playableMapConfig: {
          cellSize: 16,
          sizePreset: "small",
          width: 30,
          height: 30,
          isInitialMap: false,
          initialPositionX: null,
          initialPositionY: null,
          regionName: "Fernwild",
          regionX: 1,
          regionY: 2,
          mapType: "cave",
          backgroundColor: "#8f8169",
          backgroundImageSrc: "",
          backgroundImageMode: "repeat",
        },
      },
      {
        id: "map-bloomharbor",
        name: "Bloomharbor",
        category: "Cities",
        details: [
          detail("Cell Size", "64 px"),
          detail("Map Size", "500 x 500"),
          detail("Initial Game Map", "No"),
          detail("Initial Position", "Center"),
          detail("Region", "Moon Bay"),
          detail("Region Position", "3, 1"),
          detail("Map Type", "city"),
        ],
        playableMapConfig: {
          cellSize: 64,
          sizePreset: "medium",
          width: 500,
          height: 500,
          isInitialMap: false,
          initialPositionX: null,
          initialPositionY: null,
          regionName: "Moon Bay",
          regionX: 3,
          regionY: 1,
          mapType: "city",
          backgroundColor: "#c8d0db",
          backgroundImageSrc: "",
          backgroundImageMode: "repeat",
        },
      },
    ],
    createDetails: (_name, _category, _index, options) => [
      detail("Cell Size", `${options?.playableMapConfig?.cellSize ?? 32} px`),
      detail(
        "Map Size",
        `${options?.playableMapConfig?.width ?? 500} x ${options?.playableMapConfig?.height ?? 500}`
      ),
      detail(
        "Initial Game Map",
        options?.playableMapConfig?.isInitialMap ? "Yes" : "No"
      ),
      detail(
        "Initial Position",
        typeof options?.playableMapConfig?.initialPositionX === "number" &&
          typeof options?.playableMapConfig?.initialPositionY === "number"
          ? `${options.playableMapConfig.initialPositionX}, ${options.playableMapConfig.initialPositionY}`
          : "Center"
      ),
      detail("Region", options?.playableMapConfig?.regionName ?? "Ash Coast"),
      detail(
        "Region Position",
        `${options?.playableMapConfig?.regionX ?? 0}, ${options?.playableMapConfig?.regionY ?? 0}`
      ),
      detail("Map Type", options?.playableMapConfig?.mapType ?? "grassland"),
      detail("Background Color", options?.playableMapConfig?.backgroundColor ?? "#8bc17f"),
      detail(
        "Background Image",
        options?.playableMapConfig?.backgroundImageSrc
          ? options?.playableMapConfig?.backgroundImageMode ?? "repeat"
          : "None"
      ),
    ],
  },
  {
    key: "skillsGfx",
    title: "Move Animations",
    description: "Organize animation and impact assets used by moves across battles and world effects.",
    path: "/designer/skills-gfx",
    itemLabel: "animation",
    itemLabelPlural: "animations",
    categoryLabel: "style",
    icon: "skillGfx",
    defaultCategories: ["Fire", "Water", "Support"],
    demoItems: [
      {
        id: "gfx-ember-burst",
        name: "Ember Burst",
        category: "Fire",
        details: [
          detail("Media", "Required"),
          detail("Apply To", "selected foe"),
          detail("Appear", "1"),
        ],
      },
      {
        id: "gfx-tidal-ring",
        name: "Tidal Ring",
        category: "Water",
        details: [
          detail("Media", "Required"),
          detail("Apply To", "multiple foes"),
          detail("Appear", "1"),
        ],
      },
      {
        id: "gfx-healing-spark",
        name: "Healing Spark",
        category: "Support",
        details: [
          detail("Media", "Required"),
          detail("Apply To", "selectable friend"),
          detail("Appear", "1"),
        ],
      },
    ],
    createDetails: (_name, _category, _index, options) => [
      detail("Media", options?.skillGfxProfile?.mediaSrc ? "Uploaded" : "Required"),
      detail("Apply To", skillGfxDetailValue(options, "applyTo", "selected foe")),
      detail("Appear", skillGfxDetailValue(options, "appear", 1)),
      detail("Animation Kind", options?.skillGfxProfile?.animationKind || "other"),
      detail("Essentials Name", options?.skillGfxProfile?.essentialsAnimationName || "None"),
      detail("Graphic", options?.skillGfxProfile?.graphic || "None"),
      detail("Frames", skillGfxDetailValue(options, "frameCount", 0)),
      detail("Duration", `${skillGfxDetailValue(options, "durationMs", 0)} ms`),
    ],
  },
  {
    key: "pokemons",
    title: "Pokemons",
    description: "Manage pokemon definitions, evolution lines, rarity, and regional placement.",
    path: "/designer/pokemons",
    itemLabel: "pokemon",
    itemLabelPlural: "pokemons",
    categoryLabel: "primary element",
    icon: "pokemons",
    defaultCategories: [
      "Fire",
      "Water",
      "Grass",
      "Electricity",
      "Ice",
      "Fight",
      "Poison",
      "Ground",
      "Normal",
      "Psychic",
      "Rock",
      "Steel",
      "Dragon",
      "Fairy",
      "Bug",
      "Dark",
      "Flying",
      "Ghost",
    ],
    demoItems: [
      {
        id: "pokemon-flameling",
        name: "Flameling",
        category: "Fire",
        details: [
          detail("Elements", "Fire"),
          detail("HP", "45"),
          detail("Attack", "58"),
          detail("Defense", "42"),
          detail("Special Attack", "70"),
          detail("Special Defense", "45"),
          detail("Speed", "64"),
        ],
      },
      {
        id: "pokemon-ripplet",
        name: "Ripplet",
        category: "Water",
        details: [
          detail("Elements", "Water"),
          detail("HP", "50"),
          detail("Attack", "45"),
          detail("Defense", "52"),
          detail("Special Attack", "62"),
          detail("Special Defense", "58"),
          detail("Speed", "45"),
        ],
      },
      {
        id: "pokemon-bramblit",
        name: "Bramblit",
        category: "Grass",
        details: [
          detail("Elements", "Grass"),
          detail("HP", "55"),
          detail("Attack", "52"),
          detail("Defense", "60"),
          detail("Special Attack", "48"),
          detail("Special Defense", "58"),
          detail("Speed", "40"),
        ],
      },
    ],
    createDetails: (_name, category, _index, options) => [
      detail(
        "Elements",
        options?.pokemonProfile?.elements.length
          ? options.pokemonProfile.elements.join(", ")
          : category
      ),
      detail("HP", pokemonDetailValue(options, "hp", 1)),
      detail("Attack", pokemonDetailValue(options, "attack", 1)),
      detail("Defense", pokemonDetailValue(options, "defense", 1)),
      detail("Special Attack", pokemonDetailValue(options, "specialAttack", 1)),
      detail("Special Defense", pokemonDetailValue(options, "specialDefense", 1)),
      detail("Speed", pokemonDetailValue(options, "speed", 1)),
      detail("Initial Pokemon", options?.pokemonProfile?.isInitialPokemon ? "Yes" : "No"),
      detail(
        "Skills",
        options?.pokemonProfile?.skills.length
          ? options.pokemonProfile.skills
              .map((skill) => `${skill.skillName} (Lv. ${skill.level})`)
              .join(", ")
          : "None"
      ),
    ],
  },
  {
    key: "objects",
    title: "Map Objects",
    description: "Track world objects, props, and interactables that can be placed inside maps.",
    path: "/designer/objects",
    itemLabel: "object",
    itemLabelPlural: "objects",
    categoryLabel: "folder",
    icon: "mapObjects",
    defaultCategories: ["Nature", "Buildings", "Interactables"],
    demoItems: [
      {
        id: "object-ancient-oak",
        name: "Ancient Oak",
        category: "Nature",
        details: [detail("Type", "obstacle"), detail("Width", "96 px"), detail("Height", "144 px")],
      },
      {
        id: "object-market-stall",
        name: "Market Stall",
        category: "Buildings",
        details: [detail("Type", "floor"), detail("Width", "144 px"), detail("Height", "96 px")],
      },
      {
        id: "object-crystal-switch",
        name: "Crystal Switch",
        category: "Interactables",
        details: [detail("Type", "mob area"), detail("Width", "48 px"), detail("Height", "48 px")],
      },
    ],
    createDetails: (_name, _category, index, options) => [
      detail("Type", options?.mapObjectAsset?.objectType || "obstacle"),
      detail("Width", `${options?.mapObjectAsset?.width || 32 + index * 16} px`),
      detail("Height", `${options?.mapObjectAsset?.height || 32 + index * 16} px`),
    ],
  },
  {
    key: "items",
    title: "Items",
    description: "Organize items that players can loot, buy, equip, or consume in the game.",
    path: "/designer/items",
    itemLabel: "item",
    itemLabelPlural: "items",
    categoryLabel: "type",
    icon: "items",
    defaultCategories: ["medicine", "berries", "machines", "pokeball", "hold items", "general items", "quest item"],
    demoItems: [
      {
        id: "item-potion-plus",
        name: "Potion Plus",
        category: "usable",
        details: [detail("Type", "usable"), detail("Description", "Recover HP"), detail("Effect", "HP +20")],
      },
      {
        id: "item-ancient-seal",
        name: "Ancient Seal",
        category: "quest item",
        details: [detail("Type", "quest item"), detail("Description", "Story key"), detail("Effect", "None")],
      },
      {
        id: "item-ranger-boots",
        name: "Ranger Boots",
        category: "berries",
        details: [detail("Type", "berries"), detail("Description", "Speed boost"), detail("Effect", "Speed +5")],
      },
    ],
    createDetails: (_name, category, _index, options) => [
      detail("Type", options?.itemProfile?.type ?? category),
      detail("PokemonDB Category", options?.itemProfile?.pokemonDbCategory || category),
      detail("Icon", options?.itemProfile?.iconSrc ? "Uploaded" : "Required"),
      detail("Description", options?.itemProfile?.description || "None"),
      detail("Use Condition", options?.itemProfile?.useCondition || "none"),
      detail(
        "Effect",
        options?.itemProfile?.effectText ||
        (options?.itemProfile?.type === "skill item" || options?.itemProfile?.type === "machines"
          ? `Learn ${options.itemProfile.skillName || "None"}`
          : options?.itemProfile?.type === "pokeball"
            ? `${options.itemProfile.pokeballBonusElements.join(", ") || "Any"} +${options.itemProfile.pokeballBonusRatio}% catch`
            : options?.itemProfile?.type === "usable" || options?.itemProfile?.type === "medicine" || options?.itemProfile?.type === "berries"
              ? formatItemStatModifiers(options.itemProfile.statModifiers)
              : "None")
      ),
    ],
  },
  {
    key: "skills",
    title: "Moves",
    description: "Configure Pokemon moves, support techniques, and progression-ready learnsets.",
    path: "/designer/skills",
    itemLabel: "move",
    itemLabelPlural: "moves",
    categoryLabel: "type",
    icon: "pokemonSkills",
    defaultCategories: ["Fire", "Water", "Support"],
    demoItems: [
      {
        id: "skill-flame-wheel",
        name: "Flame Wheel",
        category: "Fire",
        details: [
          detail("Elements", "Fire"),
          detail("Power", "60"),
          detail("Power Point", "15"),
          detail("Accuracy", "90"),
          detail("Cooldown", "1 turn"),
        ],
      },
      {
        id: "skill-rain-lance",
        name: "Rain Lance",
        category: "Water",
        details: [
          detail("Elements", "Water"),
          detail("Power", "54"),
          detail("Power Point", "20"),
          detail("Accuracy", "95"),
          detail("Cooldown", "1 turn"),
        ],
      },
      {
        id: "skill-guard-song",
        name: "Guard Song",
        category: "Support",
        details: [
          detail("Elements", "Normal"),
          detail("Power", "1"),
          detail("Power Point", "10"),
          detail("Accuracy", "100"),
          detail("Cooldown", "2 turns"),
        ],
      },
    ],
    createDetails: (_name, category, _index, options) => [
      detail(
        "Elements",
        options?.pokemonSkillProfile?.elements.length
          ? options.pokemonSkillProfile.elements.join(", ")
          : category
      ),
      detail("Power", skillDetailValue(options, "power", 0)),
      detail("Power Point", skillDetailValue(options, "powerPoint", 1)),
      detail("Accuracy", skillDetailValue(options, "accuracy", 100)),
      detail("Damage Class", options?.pokemonSkillProfile?.category || "Physical"),
      detail("Target", options?.pokemonSkillProfile?.target || "NearOther"),
      detail("Function Code", options?.pokemonSkillProfile?.functionCode || "None"),
      detail("Flags", options?.pokemonSkillProfile?.flags?.join(", ") || "None"),
      detail("Priority", skillDetailValue(options, "priority", 0)),
      detail("Move Animation", options?.pokemonSkillProfile?.skillGfxName || "None"),
      detail("Weather", options?.pokemonSkillProfile?.weatherEffect || "None"),
      detail("Inflict State", options?.pokemonSkillProfile?.inflictStateName || "None"),
      detail("Cooldown", `${skillDetailValue(options, "cooldown", 0)} turns`),
      detail("State Condition", options?.pokemonSkillProfile?.stateConditionName || "None"),
    ],
  },
  {
    key: "passiveStates",
    title: "Passive States",
    description: "Manage reusable battle states that moves can inflict or require.",
    path: "/designer/passive-states",
    itemLabel: "passive state",
    itemLabelPlural: "passive states",
    categoryLabel: "group",
    icon: "passiveStates",
    defaultCategories: ["Status", "Buff", "Debuff"],
    demoItems: [
      {
        id: "state-burn",
        name: "Burn",
        category: "Status",
        details: [detail("Effect", "Takes damage each turn"), detail("Stacking", "No")],
      },
      {
        id: "state-focused",
        name: "Focused",
        category: "Buff",
        details: [detail("Effect", "Improves accuracy"), detail("Stacking", "No")],
      },
      {
        id: "state-slowed",
        name: "Slowed",
        category: "Debuff",
        details: [detail("Effect", "Reduces speed"), detail("Stacking", "No")],
      },
    ],
    createDetails: (_name, category, _index) => [
      detail("Effect", `${category} effect`),
      detail("Stacking", "No"),
    ],
  },
  {
    key: "players",
    title: "Character Skins",
    description: "Manage reusable player sprite sets with directional movement frames and optional front/back portraits.",
    path: "/designer/players",
    itemLabel: "character skin",
    itemLabelPlural: "character skins",
    categoryLabel: "group",
    icon: "players",
    defaultCategories: ["Base", "Variants", "Special"],
    demoItems: [
      {
        id: "skin-ranger-lyra",
        name: "Ranger Lyra",
        category: "Base",
        details: [
          detail("Directional Sprites", "8 / 8 uploaded"),
          detail("Front Image", "Uploaded"),
          detail("Back Image", "Uploaded"),
        ],
      },
      {
        id: "skin-ace-doran",
        name: "Ace Doran",
        category: "Variants",
        details: [
          detail("Directional Sprites", "8 / 8 uploaded"),
          detail("Front Image", "Optional"),
          detail("Back Image", "Uploaded"),
        ],
      },
      {
        id: "skin-mod-kite",
        name: "Mod Kite",
        category: "Special",
        details: [
          detail("Directional Sprites", "0 / 8 uploaded"),
          detail("Front Image", "Optional"),
          detail("Back Image", "Optional"),
        ],
      },
    ],
    createDetails: (_name, _category, _index, options) => [
      detail(
        "Directional Sprites",
        getCharacterSkinGraphicsSummary(options?.characterSkinProfile)
      ),
      detail(
        "Front Image",
        options?.characterSkinProfile?.frontImageSrc ? "Uploaded" : "Optional"
      ),
      detail(
        "Back Image",
        options?.characterSkinProfile?.backImageSrc ? "Uploaded" : "Optional"
      ),
    ],
  },
  {
    key: "regions",
    title: "Regions",
    description: "Maintain world regions, their climates, and the map groupings that belong to each.",
    path: "/designer/regions",
    itemLabel: "region",
    itemLabelPlural: "regions",
    categoryLabel: "continent",
    icon: "regions",
    defaultCategories: ["Mainland", "Archipelago", "Frontier"],
    demoItems: [
      {
        id: "region-ash-coast",
        name: "Ash Coast",
        category: "Mainland",
        details: [detail("Climate", "Temperate"), detail("Maps", "8"), detail("Settlements", "3")],
      },
      {
        id: "region-moon-bay",
        name: "Moon Bay",
        category: "Archipelago",
        details: [detail("Climate", "Marine"), detail("Maps", "6"), detail("Settlements", "2")],
      },
      {
        id: "region-fernwild",
        name: "Fernwild",
        category: "Frontier",
        details: [detail("Climate", "Humid"), detail("Maps", "9"), detail("Settlements", "1")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Climate", ["Temperate", "Marine", "Humid"][index % 3]),
      detail("Maps", `${5 + index}`),
      detail("Settlements", `${(index % 3) + 1}`),
    ],
  },
  {
    key: "abilities",
    title: "Abilities",
    description: "Store Pokemon Essentials ability records with names, descriptions, and future battle behavior metadata.",
    path: "/designer/abilities",
    itemLabel: "ability",
    itemLabelPlural: "abilities",
    categoryLabel: "group",
    icon: "database",
    defaultCategories: ["Pokemon Essentials"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Source", category),
      detail("Schema", "PBS abilities"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "types",
    title: "Types",
    description: "Store Pokemon Essentials type records, icon positions, weaknesses, resistances, and immunities.",
    path: "/designer/types",
    itemLabel: "type",
    itemLabelPlural: "types",
    categoryLabel: "group",
    icon: "database",
    defaultCategories: ["Battle Types"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Source", category),
      detail("Schema", "PBS types"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "trainers",
    title: "Trainers",
    description: "Store Pokemon Essentials trainer parties, lose text, trainer classes, and source event links.",
    path: "/designer/trainers",
    itemLabel: "trainer",
    itemLabelPlural: "trainers",
    categoryLabel: "trainer class",
    icon: "database",
    defaultCategories: ["Pokemon Essentials"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Trainer Class", category),
      detail("Schema", "PBS trainers"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "trainerTypes",
    title: "Trainer Types",
    description: "Store Pokemon Essentials trainer type definitions, music, money rules, and battle metadata.",
    path: "/designer/trainer-types",
    itemLabel: "trainer type",
    itemLabelPlural: "trainer types",
    categoryLabel: "group",
    icon: "database",
    defaultCategories: ["Pokemon Essentials"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Source", category),
      detail("Schema", "PBS trainer_types"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "encounters",
    title: "Encounters",
    description: "Store Pokemon Essentials encounter tables before they are projected into playable map grass data.",
    path: "/designer/encounters",
    itemLabel: "encounter table",
    itemLabelPlural: "encounter tables",
    categoryLabel: "map",
    icon: "database",
    defaultCategories: ["Maps"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Map", category),
      detail("Schema", "PBS encounters"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "berries",
    title: "Berry Plants",
    description: "Store Pokemon Essentials berry plant growth and yield data.",
    path: "/designer/berries",
    itemLabel: "berry plant",
    itemLabelPlural: "berry plants",
    categoryLabel: "group",
    icon: "database",
    defaultCategories: ["Berry Plants"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Source", category),
      detail("Schema", "PBS berry_plants"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "ribbons",
    title: "Ribbons",
    description: "Store Pokemon Essentials ribbon names, descriptions, and achievement metadata.",
    path: "/designer/ribbons",
    itemLabel: "ribbon",
    itemLabelPlural: "ribbons",
    categoryLabel: "group",
    icon: "database",
    defaultCategories: ["Ribbons"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Source", category),
      detail("Schema", "PBS ribbons"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "assets",
    title: "Asset Manifest",
    description: "Store normalized source-path metadata for graphics, sprite sheets, GIF frames, tilesets, UI, and other assets.",
    path: "/designer/assets",
    itemLabel: "asset",
    itemLabelPlural: "assets",
    categoryLabel: "asset type",
    icon: "database",
    defaultCategories: ["Pokemon", "Characters", "Tilesets", "UI", "Animations"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Asset Type", category),
      detail("Schema", "Graphics manifest"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "battleBackgrounds",
    title: "Battle Backgrounds",
    description: "Store battleback assets and links from map metadata or battle contexts.",
    path: "/designer/battle-backgrounds",
    itemLabel: "battle background",
    itemLabelPlural: "battle backgrounds",
    categoryLabel: "environment",
    icon: "database",
    defaultCategories: ["Field", "Indoor", "Cave", "Water"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Environment", category),
      detail("Schema", "Graphics/Battlebacks"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "audio",
    title: "Audio",
    description: "Store BGM, ME, and SE assets with source paths and runtime playback metadata.",
    path: "/designer/audio",
    itemLabel: "audio asset",
    itemLabelPlural: "audio assets",
    categoryLabel: "audio type",
    icon: "database",
    defaultCategories: ["BGM", "ME", "SE"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Audio Type", category),
      detail("Schema", "Audio manifest"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "tilesets",
    title: "Tilesets",
    description: "RPG Maker XP style tilesets: tileset image, autotile slots, passability, priority, and terrain tags used by the tile map editor.",
    path: "/designer/tilesets",
    itemLabel: "tileset",
    itemLabelPlural: "tilesets",
    categoryLabel: "group",
    icon: "database",
    defaultCategories: ["Outdoor", "Interior", "Cave"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Group", category),
      detail("Schema", "RMXP tileset profile"),
      detail("Tile Size", "32 px"),
    ],
  },
  {
    key: "fonts",
    title: "Fonts",
    description: "Store runtime font assets and family names for the migrated client.",
    path: "/designer/fonts",
    itemLabel: "font",
    itemLabelPlural: "fonts",
    categoryLabel: "group",
    icon: "database",
    defaultCategories: ["Runtime Fonts"],
    demoItems: [],
    createDetails: (_name, category) => [
      detail("Source", category),
      detail("Schema", "Fonts manifest"),
      detail("Migration", "Ready"),
    ],
  },
  {
    key: "levelingCurve",
    title: "Leveling Curve",
    description: "Configure battle experience rewards, next-level growth, and progression formulas.",
    path: "/designer/leveling-curve",
    itemLabel: "curve",
    itemLabelPlural: "curves",
    categoryLabel: "group",
    icon: "levelingCurve",
    defaultCategories: ["Progression"],
    demoItems: [],
    createDetails: () => [],
  },
  {
    key: "battleInterface",
    title: "Battle Interface",
    description: "Customize the battle scene: backgrounds, databoxes, message window, sounds, transitions, and log size.",
    path: "/designer/battle-interface",
    itemLabel: "config",
    itemLabelPlural: "configs",
    categoryLabel: "group",
    icon: "levelingCurve",
    defaultCategories: ["Battle UI"],
    demoItems: [],
    createDetails: () => [],
  },
  {
    key: "npcs",
    title: "NPCs",
    description: "Create non-player characters, their roles, dialog groups, and map placement metadata.",
    path: "/designer/npcs",
    itemLabel: "NPC",
    itemLabelPlural: "NPCs",
    categoryLabel: "group",
    icon: "npcs",
    defaultCategories: ["Quest Givers", "Vendors", "Trainers"],
    demoItems: [
      {
        id: "npc-prof-cedar",
        name: "Prof. Cedar",
        category: "Quest Givers",
        details: [
          detail("AI", "standing"),
          detail("Type", "healer"),
          detail("Behavior", "Heals for $20"),
          detail("Graphics", "World images ready"),
        ],
        npcProfile: {
          aiType: "standing",
          npcType: "healer",
          graphicsSource: "custom",
          characterSkinId: "",
          characterSkinName: "",
          movementIntervalMinSeconds: 5,
          movementIntervalMaxSeconds: 60,
          movementStepMin: 1,
          movementStepMax: 5,
          scriptSource: "",
          healPrice: 20,
          trainerPokemons: [],
          storeMoney: 10000000,
          storeItems: [],
          chestSlotCapacity: 10,
          chestItems: [],
          graphics: {
            standingUpSrc: "",
            standingDownSrc: "",
            standingLeftSrc: "",
            standingRightSrc: "",
            walkingUpSrc: "",
            walkingDownSrc: "",
            walkingLeftSrc: "",
            walkingRightSrc: "",
            chestImageSrc: "",
            trainerFrontImageSrc: "",
          },
        },
      },
      {
        id: "npc-mira-merchant",
        name: "Mira Merchant",
        category: "Vendors",
        details: [
          detail("AI", "standing"),
          detail("Type", "store"),
          detail("Behavior", "0 store items"),
          detail("Graphics", "World images ready"),
        ],
        npcProfile: {
          aiType: "standing",
          npcType: "store",
          graphicsSource: "custom",
          characterSkinId: "",
          characterSkinName: "",
          movementIntervalMinSeconds: 5,
          movementIntervalMaxSeconds: 60,
          movementStepMin: 1,
          movementStepMax: 5,
          scriptSource: "",
          healPrice: 20,
          trainerPokemons: [],
          storeMoney: 10000000,
          storeItems: [],
          chestSlotCapacity: 10,
          chestItems: [],
          graphics: {
            standingUpSrc: "",
            standingDownSrc: "",
            standingLeftSrc: "",
            standingRightSrc: "",
            walkingUpSrc: "",
            walkingDownSrc: "",
            walkingLeftSrc: "",
            walkingRightSrc: "",
            chestImageSrc: "",
            trainerFrontImageSrc: "",
          },
        },
      },
      {
        id: "npc-korin",
        name: "Korin",
        category: "Trainers",
        details: [
          detail("AI", "moving"),
          detail("Type", "trainer"),
          detail("Behavior", "1 battle pokemon"),
          detail("Graphics", "Battle/world images missing"),
        ],
        npcProfile: {
          aiType: "moving",
          npcType: "trainer",
          graphicsSource: "custom",
          characterSkinId: "",
          characterSkinName: "",
          movementIntervalMinSeconds: 5,
          movementIntervalMaxSeconds: 60,
          movementStepMin: 1,
          movementStepMax: 5,
          scriptSource: "",
          healPrice: 20,
          trainerPokemons: [{ pokemonId: "pokemon-flameling", pokemonName: "Flameling", level: 12 }],
          storeMoney: 10000000,
          storeItems: [],
          chestSlotCapacity: 10,
          chestItems: [],
          graphics: {
            standingUpSrc: "",
            standingDownSrc: "",
            standingLeftSrc: "",
            standingRightSrc: "",
            walkingUpSrc: "",
            walkingDownSrc: "",
            walkingLeftSrc: "",
            walkingRightSrc: "",
            chestImageSrc: "",
            trainerFrontImageSrc: "",
          },
        },
      },
    ],
    createDetails: (_name, category, index, options) => [
      detail("AI", options?.npcProfile?.aiType ?? (index % 2 === 0 ? "moving" : "standing")),
      detail("Type", options?.npcProfile?.npcType ?? (category === "Trainers" ? "trainer" : "healer")),
      detail(
        "Behavior",
        options?.npcProfile?.npcType === "healer"
          ? `Heals for ${formatNpcMoney(options.npcProfile.healPrice)}`
          : options?.npcProfile?.npcType === "trainer"
            ? `${options.npcProfile.trainerPokemons.length} battle pokemon`
            : options?.npcProfile?.npcType === "store"
              ? `${options.npcProfile.storeItems.length} store items`
              : options?.npcProfile?.npcType === "chest"
                ? `${options.npcProfile.chestSlotCapacity} slots`
                : options?.npcProfile?.aiType === "scriptable"
                  ? "Custom script"
                  : "Configured",
      ),
      detail("Graphics", getNpcGraphicsSummary(options?.npcProfile)),
    ],
  },
];

export const designerSectionsByKey = designerSections.reduce(
  (acc, section) => {
    acc[section.key] = section;
    return acc;
  },
  {} as Record<DesignerSectionKey, DesignerSectionDefinition>
);
