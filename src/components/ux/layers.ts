/**
 * Shared stacking order for the in-game overlays.
 *
 * Every one of these overlays is `position: fixed` and most portal to <body>,
 * so they all compete in the root stacking context and the numbers below are
 * what actually decides who covers whom. Note that a fixed element with a
 * z-index creates its own stacking context: the children of such a root only
 * order among themselves, so raising a subtree above another overlay means
 * changing the *root* value, not the child's.
 *
 * Bottom to top:
 *
 *   0-1250   world (tilemap planes, players, NPC sprites) — inside #camera-world
 *   3400     HUD_BACKDROP  chat bar, map loading overlay
 *   3500     HUD           map name banner, FPS/latency metrics
 *   3900     PLAYER_CARD   other-player trainer card popup
 *   4200     NPC_DIALOG    NPC dialog panels, store/heal menus, battle prompts
 *   4300     NPC_DIALOG_TOP  event dialog text box + choices, water action menu
 *   4400     VIRTUAL_PAD   on-screen touch gamepad (value mirrored in
 *                          VirtualControls.css — keep both in sync)
 *   4500     SYSTEM_UX     game system interface: account menu and its windows
 *   4600     TAKEOVER      full-screen takeovers: battle, PC box, trade
 *   4700     TAKEOVER_PROMPT  incoming trade/battle requests (must stay clickable)
 *
 * The game system UX sits above the NPC dialog layers on purpose: bag, party,
 * map and settings have to be reachable and readable while an NPC
 * conversation is on screen.
 *
 * The touch pad sits between the two: above the dialogs so A/B stay tappable
 * to advance a conversation, below the system UX so an open menu or window is
 * never covered by the pad.
 *
 * IMPORTANT: these numbers only work because the Game root <div> (Game.tsx)
 * is position:absolute with z-index auto — it creates NO stacking context, so
 * inline overlays and body-portaled ones really do compete in the root
 * context. Making that root position:fixed (or giving it a z-index/transform)
 * would trap every inline overlay below anything portaled to <body>.
 */
export const UX_LAYER = {
  HUD_BACKDROP: 3400,
  HUD: 3500,
  PLAYER_CARD: 3900,
  NPC_DIALOG: 4200,
  NPC_DIALOG_TOP: 4300,
  VIRTUAL_PAD: 4400,
  SYSTEM_UX: 4500,
  TAKEOVER: 4600,
  TAKEOVER_PROMPT: 4700,
} as const;

export default UX_LAYER;
