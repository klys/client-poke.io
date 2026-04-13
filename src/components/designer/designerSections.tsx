import React from "react";
import { Icon, type IconProps } from "@chakra-ui/react";

export type DesignerIconName =
  | "playableMaps"
  | "skillGfx"
  | "pokemons"
  | "mapObjects"
  | "items"
  | "pokemonSkills"
  | "players"
  | "regions"
  | "npcs";

export type DesignerSectionKey =
  | "mapsEditor"
  | "skillsGfx"
  | "pokemons"
  | "objects"
  | "items"
  | "skills"
  | "players"
  | "regions"
  | "npcs";

export interface DesignerItemDetail {
  label: string;
  value: string;
}

export interface DesignerItemSeed {
  id: string;
  name: string;
  category: string;
  details: DesignerItemDetail[];
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
  createDetails: (name: string, category: string, index: number) => DesignerItemDetail[];
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
  }
}

const detail = (label: string, value: string): DesignerItemDetail => ({ label, value });

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
        details: [detail("Size", "128 x 128"), detail("Biome", "Grassland"), detail("Portals", "3")],
      },
      {
        id: "map-amber-cavern",
        name: "Amber Cavern",
        category: "Dungeons",
        details: [detail("Size", "96 x 96"), detail("Biome", "Cave"), detail("Portals", "1")],
      },
      {
        id: "map-bloomharbor",
        name: "Bloomharbor",
        category: "Cities",
        details: [detail("Size", "144 x 144"), detail("Biome", "Town"), detail("Portals", "5")],
      },
    ],
    createDetails: (name, category, index) => [
      detail("Size", `${96 + index * 16} x ${96 + index * 16}`),
      detail("Biome", category),
      detail("Portals", `${(index % 4) + 1}`),
    ],
  },
  {
    key: "skillsGfx",
    title: "Skill GFX",
    description: "Organize animation and impact assets used by skills across battles and world effects.",
    path: "/designer/skills-gfx",
    itemLabel: "effect",
    itemLabelPlural: "effects",
    categoryLabel: "style",
    icon: "skillGfx",
    defaultCategories: ["Fire", "Water", "Support"],
    demoItems: [
      {
        id: "gfx-ember-burst",
        name: "Ember Burst",
        category: "Fire",
        details: [detail("Frames", "12"), detail("Palette", "Warm"), detail("Loop", "No")],
      },
      {
        id: "gfx-tidal-ring",
        name: "Tidal Ring",
        category: "Water",
        details: [detail("Frames", "18"), detail("Palette", "Cool"), detail("Loop", "Yes")],
      },
      {
        id: "gfx-healing-spark",
        name: "Healing Spark",
        category: "Support",
        details: [detail("Frames", "10"), detail("Palette", "Mint"), detail("Loop", "No")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Frames", `${10 + index * 2}`),
      detail("Palette", category),
      detail("Loop", index % 2 === 0 ? "Yes" : "No"),
    ],
  },
  {
    key: "pokemons",
    title: "Pokemons",
    description: "Manage pokemon definitions, evolution lines, rarity, and regional placement.",
    path: "/designer/pokemons",
    itemLabel: "pokemon",
    itemLabelPlural: "pokemons",
    categoryLabel: "type",
    icon: "pokemons",
    defaultCategories: ["Fire", "Water", "Grass"],
    demoItems: [
      {
        id: "pokemon-flameling",
        name: "Flameling",
        category: "Fire",
        details: [detail("Region", "Ash Coast"), detail("Rarity", "Common"), detail("Stage", "Basic")],
      },
      {
        id: "pokemon-ripplet",
        name: "Ripplet",
        category: "Water",
        details: [detail("Region", "Moon Bay"), detail("Rarity", "Uncommon"), detail("Stage", "Basic")],
      },
      {
        id: "pokemon-bramblit",
        name: "Bramblit",
        category: "Grass",
        details: [detail("Region", "Fernwild"), detail("Rarity", "Rare"), detail("Stage", "Stage 1")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Region", ["Ash Coast", "Moon Bay", "Fernwild"][index % 3]),
      detail("Rarity", ["Common", "Uncommon", "Rare"][index % 3]),
      detail("Stage", category === "Fire" ? "Basic" : "Stage 1"),
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
        details: [detail("Tiles", "2 x 3"), detail("Layer", "Front"), detail("Solid", "Yes")],
      },
      {
        id: "object-market-stall",
        name: "Market Stall",
        category: "Buildings",
        details: [detail("Tiles", "3 x 2"), detail("Layer", "Middle"), detail("Solid", "Yes")],
      },
      {
        id: "object-crystal-switch",
        name: "Crystal Switch",
        category: "Interactables",
        details: [detail("Tiles", "1 x 1"), detail("Layer", "Front"), detail("Solid", "No")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Tiles", `${(index % 3) + 1} x ${(index % 2) + 1}`),
      detail("Layer", ["Back", "Middle", "Front"][index % 3]),
      detail("Solid", category === "Interactables" ? "No" : "Yes"),
    ],
  },
  {
    key: "items",
    title: "Items",
    description: "Organize items that players can loot, buy, equip, or consume in the game.",
    path: "/designer/items",
    itemLabel: "item",
    itemLabelPlural: "items",
    categoryLabel: "folder",
    icon: "items",
    defaultCategories: ["Healing", "Quest", "Equipment"],
    demoItems: [
      {
        id: "item-potion-plus",
        name: "Potion Plus",
        category: "Healing",
        details: [detail("Stack", "99"), detail("Rarity", "Common"), detail("Use", "Recover HP")],
      },
      {
        id: "item-ancient-seal",
        name: "Ancient Seal",
        category: "Quest",
        details: [detail("Stack", "1"), detail("Rarity", "Epic"), detail("Use", "Story Key")],
      },
      {
        id: "item-ranger-boots",
        name: "Ranger Boots",
        category: "Equipment",
        details: [detail("Stack", "1"), detail("Rarity", "Rare"), detail("Use", "Movement Buff")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Stack", category === "Healing" ? "99" : "1"),
      detail("Rarity", ["Common", "Rare", "Epic"][index % 3]),
      detail("Use", `${category} utility`),
    ],
  },
  {
    key: "skills",
    title: "Pokemon Skills",
    description: "Configure learned attacks, support moves, and progression-ready skill sets.",
    path: "/designer/skills",
    itemLabel: "skill",
    itemLabelPlural: "skills",
    categoryLabel: "type",
    icon: "pokemonSkills",
    defaultCategories: ["Fire", "Water", "Support"],
    demoItems: [
      {
        id: "skill-flame-wheel",
        name: "Flame Wheel",
        category: "Fire",
        details: [detail("Power", "60"), detail("Cooldown", "8s"), detail("Range", "Melee")],
      },
      {
        id: "skill-rain-lance",
        name: "Rain Lance",
        category: "Water",
        details: [detail("Power", "54"), detail("Cooldown", "7s"), detail("Range", "Long")],
      },
      {
        id: "skill-guard-song",
        name: "Guard Song",
        category: "Support",
        details: [detail("Power", "Buff"), detail("Cooldown", "12s"), detail("Range", "Party")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Power", `${48 + index * 6}`),
      detail("Cooldown", `${6 + index}s`),
      detail("Range", category === "Support" ? "Party" : index % 2 === 0 ? "Mid" : "Long"),
    ],
  },
  {
    key: "players",
    title: "Players",
    description: "Prepare player presets, avatars, and role-based templates for testing flows.",
    path: "/designer/players",
    itemLabel: "player",
    itemLabelPlural: "players",
    categoryLabel: "team",
    icon: "players",
    defaultCategories: ["Heroes", "Rivals", "Admins"],
    demoItems: [
      {
        id: "player-ranger-lyra",
        name: "Ranger Lyra",
        category: "Heroes",
        details: [detail("Class", "Scout"), detail("Spawn", "Bloomharbor"), detail("Status", "Active")],
      },
      {
        id: "player-ace-doran",
        name: "Ace Doran",
        category: "Rivals",
        details: [detail("Class", "Striker"), detail("Spawn", "Sungrass Plains"), detail("Status", "Active")],
      },
      {
        id: "player-mod-kite",
        name: "Mod Kite",
        category: "Admins",
        details: [detail("Class", "Moderator"), detail("Spawn", "Control Room"), detail("Status", "Hidden")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Class", ["Scout", "Striker", "Moderator"][index % 3]),
      detail("Spawn", ["Bloomharbor", "Sungrass Plains", "Control Room"][index % 3]),
      detail("Status", category === "Admins" ? "Hidden" : "Active"),
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
        details: [detail("Role", "Mentor"), detail("Map", "Bloomharbor"), detail("Mood", "Calm")],
      },
      {
        id: "npc-mira-merchant",
        name: "Mira Merchant",
        category: "Vendors",
        details: [detail("Role", "Shopkeeper"), detail("Map", "Bloomharbor"), detail("Mood", "Busy")],
      },
      {
        id: "npc-korin",
        name: "Korin",
        category: "Trainers",
        details: [detail("Role", "Duelist"), detail("Map", "Sungrass Plains"), detail("Mood", "Focused")],
      },
    ],
    createDetails: (_name, category, index) => [
      detail("Role", ["Mentor", "Shopkeeper", "Duelist"][index % 3]),
      detail("Map", ["Bloomharbor", "Sungrass Plains", "Amber Cavern"][index % 3]),
      detail("Mood", category === "Vendors" ? "Busy" : "Calm"),
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
