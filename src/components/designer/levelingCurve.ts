import type {
  DesignerItemDetail,
  DesignerItemSeed,
  DesignerLevelingCurveProfile,
} from "./designerSections";

export type LevelingCurveConfig = DesignerLevelingCurveProfile;

export const LEVELING_CURVE_SECTION_KEY = "levelingCurve";
export const LEVELING_CURVE_SECTION_ITEM_ID = "leveling-curve-config";
export const LEVELING_CURVE_SECTION_ITEM_NAME = "Global Leveling Curve";
export const LEVELING_CURVE_CATEGORY = "Progression";

export const DEFAULT_LEVELING_CURVE_CONFIG: LevelingCurveConfig = {
  startExpForNextLevel: 100,
  expGainedPerBattle: 50,
  bonusDefeatingHigherLevelFormula: "5% * (Blvl - Alvl)",
  debonusDefeatingLowerLevelFormula: "1% * (Alvl - Blvl)",
  percentageExpIncreaseNextLevel: 10,
};

type FormulaVariables = {
  Alvl: number;
  Blvl: number;
};

type FormulaToken =
  | { type: "number"; value: number }
  | { type: "identifier"; value: keyof FormulaVariables }
  | { type: "operator"; value: "+" | "-" | "*" | "/" | "(" | ")" };

function clampLevel(value: number) {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function sanitizeNonNegativeNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback;
}

function sanitizePositiveInteger(value: unknown, fallback: number) {
  return Math.max(1, Math.round(sanitizeNonNegativeNumber(value, fallback)));
}

function sanitizeFormula(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function buildDetail(label: string, value: string): DesignerItemDetail {
  return { label, value };
}

function normalizeFormulaExpression(expression: string) {
  return expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\b[xX]\b/g, "*")
    .replace(/(\d+(?:\.\d+)?)\s*%/g, "($1 / 100)");
}

function tokenizeFormula(expression: string): FormulaToken[] | null {
  const tokens: FormulaToken[] = [];
  const normalized = normalizeFormulaExpression(expression);
  let index = 0;

  while (index < normalized.length) {
    const character = normalized[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(character)) {
      let end = index + 1;
      while (end < normalized.length && /[0-9.]/.test(normalized[end])) {
        end += 1;
      }

      const value = Number.parseFloat(normalized.slice(index, end));
      if (!Number.isFinite(value)) {
        return null;
      }

      tokens.push({ type: "number", value });
      index = end;
      continue;
    }

    if (/[A-Za-z]/.test(character)) {
      let end = index + 1;
      while (end < normalized.length && /[A-Za-z]/.test(normalized[end])) {
        end += 1;
      }

      const rawIdentifier = normalized.slice(index, end).toLowerCase();
      const identifier =
        rawIdentifier === "alvl"
          ? "Alvl"
          : rawIdentifier === "blvl"
            ? "Blvl"
            : null;

      if (!identifier) {
        return null;
      }

      tokens.push({ type: "identifier", value: identifier });
      index = end;
      continue;
    }

    if (character === "+" || character === "-" || character === "*" || character === "/" || character === "(" || character === ")") {
      tokens.push({ type: "operator", value: character });
      index += 1;
      continue;
    }

    return null;
  }

  return tokens;
}

function evaluateTokens(tokens: FormulaToken[], variables: FormulaVariables) {
  let index = 0;

  const parseExpression = (): number | null => {
    let value = parseTerm();
    if (value === null) {
      return null;
    }

    while (index < tokens.length) {
      const operator = tokens[index];
      if (operator.type !== "operator" || (operator.value !== "+" && operator.value !== "-")) {
        break;
      }

      index += 1;
      const nextValue = parseTerm();
      if (nextValue === null) {
        return null;
      }

      value = operator.value === "+" ? value + nextValue : value - nextValue;
    }

    return value;
  };

  const parseTerm = (): number | null => {
    let value = parseFactor();
    if (value === null) {
      return null;
    }

    while (index < tokens.length) {
      const operator = tokens[index];
      if (operator.type !== "operator" || (operator.value !== "*" && operator.value !== "/")) {
        break;
      }

      index += 1;
      const nextValue = parseFactor();
      if (nextValue === null) {
        return null;
      }

      if (operator.value === "*") {
        value *= nextValue;
        continue;
      }

      if (nextValue === 0) {
        return null;
      }

      value /= nextValue;
    }

    return value;
  };

  const parseFactor = (): number | null => {
    const token = tokens[index];
    if (!token) {
      return null;
    }

    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      index += 1;
      const value = parseFactor();
      if (value === null) {
        return null;
      }
      return token.value === "-" ? -value : value;
    }

    if (token.type === "number") {
      index += 1;
      return token.value;
    }

    if (token.type === "identifier") {
      index += 1;
      return variables[token.value];
    }

    if (token.type === "operator" && token.value === "(") {
      index += 1;
      const value = parseExpression();
      const closingToken = tokens[index];
      if (value === null || !closingToken || closingToken.type !== "operator" || closingToken.value !== ")") {
        return null;
      }
      index += 1;
      return value;
    }

    return null;
  };

  const value = parseExpression();
  if (value === null || index !== tokens.length || !Number.isFinite(value)) {
    return null;
  }

  return value;
}

export function sanitizeLevelingCurveConfig(value: unknown): LevelingCurveConfig {
  if (!value || typeof value !== "object") {
    return DEFAULT_LEVELING_CURVE_CONFIG;
  }

  const candidate = value as Partial<LevelingCurveConfig>;

  return {
    startExpForNextLevel: sanitizePositiveInteger(
      candidate.startExpForNextLevel,
      DEFAULT_LEVELING_CURVE_CONFIG.startExpForNextLevel
    ),
    expGainedPerBattle: Math.round(
      sanitizeNonNegativeNumber(
        candidate.expGainedPerBattle,
        DEFAULT_LEVELING_CURVE_CONFIG.expGainedPerBattle
      )
    ),
    bonusDefeatingHigherLevelFormula: sanitizeFormula(
      candidate.bonusDefeatingHigherLevelFormula,
      DEFAULT_LEVELING_CURVE_CONFIG.bonusDefeatingHigherLevelFormula
    ),
    debonusDefeatingLowerLevelFormula: sanitizeFormula(
      candidate.debonusDefeatingLowerLevelFormula,
      DEFAULT_LEVELING_CURVE_CONFIG.debonusDefeatingLowerLevelFormula
    ),
    percentageExpIncreaseNextLevel: sanitizeNonNegativeNumber(
      candidate.percentageExpIncreaseNextLevel,
      DEFAULT_LEVELING_CURVE_CONFIG.percentageExpIncreaseNextLevel
    ),
  };
}

export function evaluateLevelingCurveFormula(
  formula: string,
  variables: FormulaVariables
) {
  const tokens = tokenizeFormula(formula);
  if (!tokens) {
    return null;
  }

  return evaluateTokens(tokens, {
    Alvl: clampLevel(variables.Alvl),
    Blvl: clampLevel(variables.Blvl),
  });
}

export function getExperienceForNextLevel(level: number, config: LevelingCurveConfig) {
  const clampedLevel = clampLevel(level);
  if (clampedLevel >= 100) {
    return 0;
  }

  let required = sanitizePositiveInteger(
    config.startExpForNextLevel,
    DEFAULT_LEVELING_CURVE_CONFIG.startExpForNextLevel
  );

  for (let currentLevel = 1; currentLevel < clampedLevel; currentLevel += 1) {
    required = Math.max(
      1,
      Math.round(required * (1 + config.percentageExpIncreaseNextLevel / 100))
    );
  }

  return required;
}

export function getTotalExperienceToReachLevel(level: number, config: LevelingCurveConfig) {
  const clampedLevel = clampLevel(level);
  let total = 0;

  for (let currentLevel = 1; currentLevel < clampedLevel; currentLevel += 1) {
    total += getExperienceForNextLevel(currentLevel, config);
  }

  return total;
}

export function computeBattleExperience(
  config: LevelingCurveConfig,
  attackerLevel: number,
  foeLevel: number
) {
  const Alvl = clampLevel(attackerLevel);
  const Blvl = clampLevel(foeLevel);
  let modifier = 0;

  if (Blvl > Alvl) {
    modifier +=
      evaluateLevelingCurveFormula(config.bonusDefeatingHigherLevelFormula, { Alvl, Blvl }) ?? 0;
  } else if (Alvl > Blvl) {
    modifier -=
      evaluateLevelingCurveFormula(config.debonusDefeatingLowerLevelFormula, { Alvl, Blvl }) ?? 0;
  }

  return Math.max(0, Math.round(config.expGainedPerBattle * (1 + modifier)));
}

export function buildLevelingCurveDetails(config: LevelingCurveConfig) {
  return [
    buildDetail("Start EXP", `${config.startExpForNextLevel}`),
    buildDetail("Battle EXP", `${config.expGainedPerBattle}`),
    buildDetail("Higher-Level Bonus", config.bonusDefeatingHigherLevelFormula),
    buildDetail("Lower-Level Debonus", config.debonusDefeatingLowerLevelFormula),
    buildDetail("Next Level Increase", `${config.percentageExpIncreaseNextLevel}%`),
  ];
}

export function buildLevelingCurveItem(config: LevelingCurveConfig): DesignerItemSeed {
  return {
    id: LEVELING_CURVE_SECTION_ITEM_ID,
    name: LEVELING_CURVE_SECTION_ITEM_NAME,
    category: LEVELING_CURVE_CATEGORY,
    details: buildLevelingCurveDetails(config),
    levelingCurveProfile: config,
  };
}

export function buildLevelingCurveSectionState(config: LevelingCurveConfig) {
  return {
    categories: [LEVELING_CURVE_CATEGORY],
    items: [buildLevelingCurveItem(config)],
  };
}

export function readLevelingCurveConfigFromItems(items: DesignerItemSeed[]) {
  const item = items.find((candidate) => candidate.id === LEVELING_CURVE_SECTION_ITEM_ID) ?? items[0];
  return sanitizeLevelingCurveConfig(item?.levelingCurveProfile);
}
