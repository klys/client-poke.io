// Client-side mirror of the server's RPG Maker page selection, so imported
// events only render when their active page's conditions are met (switches /
// self-switches / variables). Without this, conditionally-hidden events (e.g. a
// town's later invasion NPCs) would show at the wrong time.
//
// The server remains the authority: this mirror only decides what to RENDER
// and whether an interact is worth emitting. Essentials "script switches"
// (System switch names starting with `s:`) are evaluated here with the same
// rules as the server, using the temp switches and clock env the server ships
// in `event:state` plus the script-switch table in the maps payload.

export type EventPlayerState = {
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  selfSwitches: Record<string, boolean>;
  /** Essentials session temp switches, keyed `essMapId:eventId:CH`. */
  tempSwitches?: Record<string, boolean>;
  /** Server clock for day/night & weekday script switches. */
  env?: { hour: number; weekday: number };
};

/** Switch id -> the `s:` expression from the imported System data. */
export type ScriptSwitchTable = Record<string, string>;

export const EMPTY_EVENT_STATE: EventPlayerState = {
  switches: {},
  variables: {},
  selfSwitches: {}
};

type PageConditions = {
  switch1?: number;
  switch2?: number;
  selfSwitch?: string;
  variable?: { id: number; value: number };
};

export type EssentialsEventPage = {
  conditions: PageConditions;
  graphic: { characterName: string; direction: number; pattern: number };
  trigger: number;
  move?: {
    type?: number;
    speed?: number;
    frequency?: number;
    route?: { list?: Array<{ code: number }>; repeat?: boolean } | null;
    walkAnime?: boolean;
    stepAnime?: boolean;
    directionFix?: boolean;
    alwaysOnTop?: boolean;
  };
  commands: Array<{ code: number }>;
};

export type EssentialsEvent = {
  eventId: number;
  essentialsMapId: number;
  pages: EssentialsEventPage[];
};

const INTERACTABLE_CODES = new Set([101, 102, 355, 111, 125, 126]);

// -- Essentials script switches (mirrors the server's evaluator) -------------

const RE_TS_ON = /^(?:Kernel\.)?(?:tsOn\?|isTempSwitchOn\?)\(\s*"(\w+)"\s*\)$/;
const RE_TS_OFF = /^(?:Kernel\.)?(?:tsOff\?|isTempSwitchOff\?)\(\s*"(\w+)"\s*\)$/;
const RE_DAY_NIGHT = /^PBDayNight\.is(Day|Night|Morning|Afternoon|Evening)\?$/;
const RE_WEEKDAY = /^(?:Kernel\.)?pbIsWeekday\(\s*-?\d+\s*((?:,\s*\d+\s*)+)\)$/;
const RE_COOLDOWN = /^(?:Kernel\.)?(?:cooledDown\?|cooledDownDays\?)\(\s*\d+\s*\)$/;

function evaluateScriptSwitch(
  expression: string,
  essentialsMapId: number,
  eventId: number,
  state: EventPlayerState
): boolean {
  const trimmed = expression.trim();
  if (trimmed.startsWith('!')) {
    return !evaluateScriptSwitch(trimmed.slice(1), essentialsMapId, eventId, state);
  }
  const tsOn = trimmed.match(RE_TS_ON);
  if (tsOn) {
    return state.tempSwitches?.[`${essentialsMapId}:${eventId}:${tsOn[1]}`] === true;
  }
  const tsOff = trimmed.match(RE_TS_OFF);
  if (tsOff) {
    return state.tempSwitches?.[`${essentialsMapId}:${eventId}:${tsOff[1]}`] !== true;
  }
  const hour = state.env?.hour ?? new Date().getHours();
  const dayNight = trimmed.match(RE_DAY_NIGHT);
  if (dayNight) {
    switch (dayNight[1]) {
      case 'Day': return hour >= 6 && hour < 20;
      case 'Night': return hour >= 20 || hour < 6;
      case 'Morning': return hour >= 6 && hour < 12;
      case 'Afternoon': return hour >= 12 && hour < 17;
      case 'Evening': return hour >= 17 && hour < 20;
    }
  }
  const weekday = trimmed.match(RE_WEEKDAY);
  if (weekday) {
    const today = state.env?.weekday ?? new Date().getDay();
    return weekday[1]
      .split(',')
      .map((part) => Number(part.trim()))
      .includes(today);
  }
  if (RE_COOLDOWN.test(trimmed)) {
    return state.tempSwitches?.[`${essentialsMapId}:${eventId}:A`] !== true;
  }
  // Unknown expression: hidden, matching the server's fail-closed rule.
  return false;
}

function switchConditionMet(
  switchId: number,
  state: EventPlayerState,
  essentialsMapId: number,
  eventId: number,
  scriptSwitches?: ScriptSwitchTable
): boolean {
  const expression = scriptSwitches?.[String(switchId)];
  if (typeof expression === 'string' && expression.length > 0) {
    return evaluateScriptSwitch(expression, essentialsMapId, eventId, state);
  }
  return Boolean(state.switches[String(switchId)]);
}

function pageConditionsMet(
  conditions: PageConditions,
  state: EventPlayerState,
  essentialsMapId: number,
  eventId: number,
  scriptSwitches?: ScriptSwitchTable
): boolean {
  if (
    conditions.switch1 &&
    !switchConditionMet(conditions.switch1, state, essentialsMapId, eventId, scriptSwitches)
  ) {
    return false;
  }
  if (
    conditions.switch2 &&
    !switchConditionMet(conditions.switch2, state, essentialsMapId, eventId, scriptSwitches)
  ) {
    return false;
  }
  if (conditions.selfSwitch) {
    const key = `${essentialsMapId}:${eventId}:${conditions.selfSwitch}`;
    if (!state.selfSwitches[key]) {
      return false;
    }
  }
  if (conditions.variable) {
    const current = Number(state.variables[String(conditions.variable.id)] ?? 0);
    if (current < conditions.variable.value) {
      return false;
    }
  }
  return true;
}

// Reserved self-switch set by pbEraseThisEvent (Cut trees, Rock Smash rocks).
// Mirrors the server (eventPageSelection.ts): an erased event renders nothing.
export const ERASED_SELF_SWITCH = 'ERASED';

export function isEventErased(event: EssentialsEvent, state: EventPlayerState): boolean {
  return Boolean(state.selfSwitches[`${event.essentialsMapId}:${event.eventId}:${ERASED_SELF_SWITCH}`]);
}

export function selectActiveEventPage(
  event: EssentialsEvent,
  state: EventPlayerState,
  scriptSwitches?: ScriptSwitchTable
): EssentialsEventPage | null {
  if (isEventErased(event, state)) {
    return null;
  }
  for (let index = event.pages.length - 1; index >= 0; index -= 1) {
    if (
      pageConditionsMet(
        event.pages[index].conditions,
        state,
        event.essentialsMapId,
        event.eventId,
        scriptSwitches
      )
    ) {
      return event.pages[index];
    }
  }
  return null;
}

export function pageIsInteractable(page: EssentialsEventPage): boolean {
  return (
    (page.trigger === 0 || page.trigger === 1 || page.trigger === 2) &&
    page.commands.some((command) => INTERACTABLE_CODES.has(command.code))
  );
}
