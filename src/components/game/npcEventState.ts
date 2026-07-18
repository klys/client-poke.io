// Client-side mirror of the server's RPG Maker page selection, so imported
// events only render when their active page's conditions are met (switches /
// self-switches / variables). Without this, conditionally-hidden events (e.g. a
// town's later invasion NPCs) would show at the wrong time.

export type EventPlayerState = {
  switches: Record<string, boolean>;
  variables: Record<string, number>;
  selfSwitches: Record<string, boolean>;
};

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

function pageConditionsMet(
  conditions: PageConditions,
  state: EventPlayerState,
  essentialsMapId: number,
  eventId: number
): boolean {
  if (conditions.switch1 && !state.switches[String(conditions.switch1)]) {
    return false;
  }
  if (conditions.switch2 && !state.switches[String(conditions.switch2)]) {
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

export function selectActiveEventPage(
  event: EssentialsEvent,
  state: EventPlayerState
): EssentialsEventPage | null {
  for (let index = event.pages.length - 1; index >= 0; index -= 1) {
    if (pageConditionsMet(event.pages[index].conditions, state, event.essentialsMapId, event.eventId)) {
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
