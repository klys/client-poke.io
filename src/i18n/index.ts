/**
 * Lightweight i18n for the player-facing UI. English and Spanish.
 *
 * The active language comes from the Language setting (Settings window):
 * 'auto' (default) follows the system/browser language — Spanish when
 * navigator.language starts with "es", English otherwise. Server-authored
 * content (event dialog text, item names/descriptions) arrives already
 * localized from the game data and is not translated here.
 *
 * Usage in components:
 *   const t = useT();            // re-renders on language change
 *   <Button>{t('battle.fight')}</Button>
 *
 * Outside React use translate('key') for a one-shot lookup.
 */

import { useEffect, useState } from 'react';
import { loadGameSettings, subscribeGameSettings, type LanguageSetting } from '../settings/gameSettings';

export type Language = 'en' | 'es';

export function detectSystemLanguage(): Language {
  if (typeof navigator !== 'undefined') {
    const candidates = [navigator.language, ...(navigator.languages ?? [])];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.toLowerCase().startsWith('es')) return 'es';
      if (typeof candidate === 'string' && candidate.toLowerCase().startsWith('en')) return 'en';
    }
  }
  return 'en';
}

export function resolveLanguage(setting: LanguageSetting): Language {
  return setting === 'auto' ? detectSystemLanguage() : setting;
}

type Entry = { en: string; es: string };

const STRINGS: Record<string, Entry> = {
  // --- Account menu / window titles ---
  'menu.menu': { en: 'Menu', es: 'Menú' },
  'menu.account': { en: 'Account', es: 'Cuenta' },
  'menu.settings': { en: 'Settings', es: 'Ajustes' },
  'menu.bag': { en: 'Bag', es: 'Mochila' },
  'menu.pokemons': { en: 'Venomons', es: 'Venomons' },
  'menu.map': { en: 'Map', es: 'Mapa' },
  'menu.trainerCard': { en: 'Trainer Card', es: 'Tarjeta de Entrenador' },
  'menu.battleHistory': { en: 'Battle History', es: 'Historial de Batallas' },
  'menu.designer': { en: 'Designer', es: 'Diseñador' },
  'menu.moderator': { en: 'Moderator', es: 'Moderador' },
  'menu.admin': { en: 'Admin', es: 'Admin' },
  'menu.logout': { en: 'Log out', es: 'Cerrar sesión' },
  'menu.pokemonStats': { en: 'Venomon Stats', es: 'Estadísticas del Venomon' },
  'menu.statsSuffix': { en: 'Stats', es: 'Estadísticas' },

  // --- World map window / Volar (Fly) ---
  'map.youAreHere': { en: 'You are here', es: 'Estás aquí' },
  'map.indoors': { en: 'indoors', es: 'interior' },
  'map.unknownLocation': { en: 'Unknown location', es: 'Ubicación desconocida' },
  'map.towns': { en: 'Towns', es: 'Ciudades' },
  'map.routes': { en: 'Routes', es: 'Rutas' },
  'map.flyHint': {
    en: 'Select a town to fly there with Volar.',
    es: 'Selecciona una ciudad para viajar con Volar.',
  },
  'map.noFly': {
    en: 'A party venomon that knows Volar can fly you to any town.',
    es: 'Un venomon del equipo que sepa Volar puede llevarte volando a cualquier ciudad.',
  },
  'map.flyTo': { en: 'Fly to', es: 'Volar a' },
  'map.fly': { en: 'Fly', es: 'Volar' },
  'map.cancel': { en: 'Cancel', es: 'Cancelar' },
  'map.flyFailed': { en: 'Could not fly there.', es: 'No se pudo volar hasta allí.' },
  'map.empty': {
    en: 'The world map has not loaded yet.',
    es: 'El mapa del mundo todavía no se ha cargado.',
  },

  // --- Settings window: general ---
  'settings.enableDrag': { en: 'Enable draggable screen', es: 'Activar ventanas arrastrables' },
  'settings.disableDrag': { en: 'Disable draggable screen', es: 'Desactivar ventanas arrastrables' },
  'settings.resetPositions': { en: 'Reset screen positions', es: 'Restablecer posiciones de ventanas' },
  'settings.positionsReset': { en: 'Window positions reset.', es: 'Posiciones de ventanas restablecidas.' },

  // --- Settings window: audio ---
  'settings.audio.title': { en: 'Audio', es: 'Audio' },
  'settings.audio.music': { en: 'Music volume', es: 'Volumen de la música' },
  'settings.audio.musicMute': { en: 'Mute music', es: 'Silenciar música' },
  'settings.audio.sfx': { en: 'Sound effects volume', es: 'Volumen de los efectos de sonido' },
  'settings.audio.sfxMute': { en: 'Mute sound effects', es: 'Silenciar efectos de sonido' },

  // --- Settings window: display / UI scale ---
  'settings.display.title': { en: 'Display', es: 'Pantalla' },
  'settings.display.dialogs': { en: 'NPC dialog size', es: 'Tamaño de los diálogos de NPC' },
  'settings.display.interface': { en: 'Interface windows size', es: 'Tamaño de las ventanas de interfaz' },
  'settings.display.battle': { en: 'Battle interface size', es: 'Tamaño de la interfaz de batalla' },

  // --- Settings window: language ---
  'settings.controls.title': { en: 'Controls', es: 'Controles' },
  'settings.controls.touchMove': { en: 'Tap / click to move', es: 'Tocar / clic para moverse' },
  'settings.controls.touchMoveHelp': {
    en: 'When off, tapping or clicking the map no longer moves your character.',
    es: 'Si está desactivado, tocar o hacer clic en el mapa ya no mueve a tu personaje.',
  },
  'settings.language.title': { en: 'Language', es: 'Idioma' },
  'settings.language.auto': { en: 'Auto (system language)', es: 'Automático (idioma del sistema)' },
  'settings.language.en': { en: 'English', es: 'English' },
  'settings.language.es': { en: 'Español', es: 'Español' },
  'settings.language.detected': { en: 'System language detected:', es: 'Idioma del sistema detectado:' },

  // --- Gamepad settings ---
  'gamepad.title': { en: 'Gamepad', es: 'Mando' },
  'gamepad.connected': { en: 'Connected', es: 'Conectado' },
  'gamepad.none': { en: 'No controller detected', es: 'No se detectó ningún mando' },
  'gamepad.wakeHint': {
    en: 'Connect a controller and press any button on it to wake it up.',
    es: 'Conecta un mando y pulsa cualquier botón para activarlo.',
  },
  'gamepad.electronNote': {
    en: 'The desktop app maps the controller natively; these bindings apply to the web and mobile builds.',
    es: 'La aplicación de escritorio asigna el mando de forma nativa; estas asignaciones aplican a las versiones web y móvil.',
  },
  'gamepad.enable': { en: 'Enable gamepad controls', es: 'Activar controles de mando' },
  'gamepad.leftStick': { en: 'Left stick moves the player', es: 'El stick izquierdo mueve al jugador' },
  'gamepad.deadZone': { en: 'Stick dead zone', es: 'Zona muerta del stick' },
  'gamepad.mapping': { en: 'Button mapping', es: 'Asignación de botones' },
  'gamepad.mappingHint': {
    en: 'Press a button on your controller to highlight its row, then pick the action it should trigger.',
    es: 'Pulsa un botón del mando para resaltar su fila y elige la acción que debe ejecutar.',
  },
  'gamepad.resetMapping': { en: 'Reset controller mapping', es: 'Restablecer asignación del mando' },
  'gamepad.virtual.title': { en: 'On-screen pad', es: 'Controles táctiles' },
  'gamepad.virtual.hint': {
    en: 'The touch d-pad and A/B/X/Y buttons shown in the mobile app.',
    es: 'La cruceta táctil y los botones A/B/X/Y que se muestran en la aplicación móvil.',
  },
  'gamepad.virtual.notMobile': {
    en: '(You are not on the mobile app; these apply when you play there.)',
    es: '(No estás en la aplicación móvil; estos ajustes aplican cuando juegues allí.)',
  },
  'gamepad.virtual.visibility': { en: 'Visibility', es: 'Visibilidad' },
  'gamepad.virtual.visAuto': {
    en: 'Auto — hide while a controller is connected',
    es: 'Automático — ocultar mientras haya un mando conectado',
  },
  'gamepad.virtual.visAlways': { en: 'Always visible', es: 'Siempre visible' },
  'gamepad.virtual.visHidden': { en: 'Hidden', es: 'Oculto' },
  'gamepad.virtual.typingNote': {
    en: 'The pad always hides while you are typing in a text field.',
    es: 'Los controles siempre se ocultan mientras escribes en un campo de texto.',
  },
  'gamepad.virtual.size': { en: 'Size', es: 'Tamaño' },
  'gamepad.virtual.opacity': { en: 'Opacity', es: 'Opacidad' },
  'gamepad.virtual.actions': { en: 'On-screen button actions', es: 'Acciones de los botones táctiles' },
  'gamepad.virtual.reset': { en: 'Reset on-screen pad', es: 'Restablecer controles táctiles' },
  'gamepad.virtual.a': { en: 'A button (green)', es: 'Botón A (verde)' },
  'gamepad.virtual.b': { en: 'B button (red)', es: 'Botón B (rojo)' },
  'gamepad.virtual.x': { en: 'X button (blue)', es: 'Botón X (azul)' },
  'gamepad.virtual.y': { en: 'Y button (yellow)', es: 'Botón Y (amarillo)' },

  // --- Gamepad actions ---
  'action.none': { en: 'Unassigned', es: 'Sin asignar' },
  'action.moveUp': { en: 'Move Up', es: 'Mover arriba' },
  'action.moveDown': { en: 'Move Down', es: 'Mover abajo' },
  'action.moveLeft': { en: 'Move Left', es: 'Mover a la izquierda' },
  'action.moveRight': { en: 'Move Right', es: 'Mover a la derecha' },
  'action.confirm': { en: 'Confirm / Advance dialog', es: 'Confirmar / Avanzar diálogo' },
  'action.cancel': { en: 'Cancel / Close', es: 'Cancelar / Cerrar' },
  'action.interact': { en: 'Interact (facing tile)', es: 'Interactuar (casilla de enfrente)' },
  'action.menu': { en: 'Open Menu', es: 'Abrir menú' },
  'action.shoot': { en: 'Action / Shoot', es: 'Acción / Disparar' },

  // --- Battle scene ---
  'battle.fight': { en: 'FIGHT', es: 'LUCHAR' },
  'battle.bag': { en: 'BAG', es: 'MOCHILA' },
  'battle.pokemon': { en: 'VENOMONS', es: 'VENOMONS' },
  'battle.run': { en: 'RUN', es: 'HUIR' },
  'battle.giveUp': { en: 'GIVE UP', es: 'RENDIRSE' },
  'battle.log': { en: 'LOG', es: 'REGISTRO' },
  'battle.ok': { en: 'OK', es: 'OK' },
  'battle.back': { en: 'Back', es: 'Volver' },
  'battle.noMoves': { en: 'No battle moves available.', es: 'No hay movimientos de batalla disponibles.' },
  'battle.noItems': { en: 'No usable items.', es: 'No hay objetos utilizables.' },
  'battle.itemLocked': {
    en: "This item can't be used right now.",
    es: 'Este objeto no se puede usar ahora mismo.',
  },
  'battle.useOn': { en: 'Use {name} on:', es: 'Usar {name} en:' },
  'battle.chooseNext': { en: 'Choose your next Venomon:', es: 'Elige tu próximo Venomon:' },
  'battle.result': { en: 'BATTLE RESULT', es: 'RESULTADO DE LA BATALLA' },
  'battle.winner': { en: 'Winner', es: 'Ganador' },
  'battle.loser': { en: 'Loser', es: 'Perdedor' },

  // --- Account window ---
  'account.emailStatus': { en: 'Email status', es: 'Estado del correo' },
  'account.verified': { en: 'Verified', es: 'Verificado' },
  'account.pending': { en: 'Pending', es: 'Pendiente' },
  'account.userId': { en: 'User ID', es: 'ID de usuario' },
  'account.profileImage': { en: 'Profile image URL', es: 'URL de la imagen de perfil' },
  'account.description': { en: 'Short description', es: 'Descripción corta' },
  'account.saveProfile': { en: 'Save profile', es: 'Guardar perfil' },
  'account.currentPassword': { en: 'Current password', es: 'Contraseña actual' },
  'account.newPassword': { en: 'New password', es: 'Contraseña nueva' },
  'account.changePassword': { en: 'Change password', es: 'Cambiar contraseña' },
  'account.reportBug': { en: 'Report bug', es: 'Reportar un error' },

  // --- Bag window ---
  'bag.all': { en: 'All', es: 'Todo' },
  'bag.usable': { en: 'Usable', es: 'Utilizables' },
  'bag.berries': { en: 'Berries', es: 'Bayas' },
  'bag.moves': { en: 'Moves', es: 'Movimientos' },
  'bag.quest': { en: 'Quest Items', es: 'Objetos de misión' },
  'bag.use': { en: 'Use', es: 'Usar' },
  'bag.teach': { en: 'Teach', es: 'Enseñar' },
  'bag.throwAway': { en: 'Throw Away', es: 'Tirar' },
  'bag.empty': { en: 'No items in this pocket.', es: 'No hay objetos en este bolsillo.' },

  // --- Venomons window ---
  'party.onHand': { en: 'Venomons on hand:', es: 'Venomons en el equipo:' },
  'party.orderHint': {
    en: 'The first Venomon in the list battles first. Use Move Up / Move Down to change the order.',
    es: 'El primer Venomon de la lista lucha primero. Usa Subir / Bajar para cambiar el orden.',
  },
  'party.empty': { en: 'No Venomons in your party yet.', es: 'Aún no tienes Venomons en tu equipo.' },
  'party.lead': { en: 'Lead', es: 'Líder' },
  'party.moves': { en: 'Moves', es: 'Movimientos' },
  'party.noMoves': { en: 'No moves learned.', es: 'No ha aprendido movimientos.' },

  // --- Trainer card / battle history ---
  'trainer.battleHistory': { en: 'Battle History', es: 'Historial de Batallas' },
  'trainer.noDescription': { en: 'No description set.', es: 'Sin descripción.' },
  'history.empty': { en: 'No battles recorded yet.', es: 'Aún no hay batallas registradas.' },
};

export function translate(key: string, language: Language, params?: Record<string, string>): string {
  const entry = STRINGS[key];
  let text = entry ? entry[language] ?? entry.en : key;
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.replace(`{${name}}`, value);
    }
  }
  return text;
}

export function getActiveLanguage(): Language {
  return resolveLanguage(loadGameSettings().language);
}

export type Translator = (key: string, params?: Record<string, string>) => string;

/** Translation hook; consumers re-render when the language setting changes. */
export function useT(): Translator {
  const [language, setLanguage] = useState<Language>(() => getActiveLanguage());

  useEffect(
    () => subscribeGameSettings((settings) => setLanguage(resolveLanguage(settings.language))),
    []
  );

  return (key, params) => translate(key, language, params);
}
