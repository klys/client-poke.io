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
  'menu.tradeHistory': { en: 'Trade History', es: 'Historial de Intercambios' },
  'menu.designer': { en: 'Designer', es: 'Diseñador' },
  'menu.moderator': { en: 'Moderator', es: 'Moderador' },
  'menu.admin': { en: 'Admin', es: 'Admin' },
  'menu.logout': { en: 'Log out', es: 'Cerrar sesión' },
  'menu.pokemonStats': { en: 'Venomon Stats', es: 'Estadísticas del Venomon' },
  'menu.statsSuffix': { en: 'Stats', es: 'Estadísticas' },

  // --- World map window / Volar (Fly) ---
  'map.regionTab': { en: 'Region', es: 'Región' },
  'map.currentMapTab': { en: 'Current map', es: 'Mapa actual' },
  'map.youAreHere': { en: 'You are here', es: 'Estás aquí' },
  'map.indoors': { en: 'indoors', es: 'interior' },
  'map.unknownLocation': { en: 'Unknown location', es: 'Ubicación desconocida' },
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
  'map.notVisited': { en: 'not visited yet', es: 'aún no visitada' },

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
  'settings.display.showFps': { en: 'Show FPS counter', es: 'Mostrar contador de FPS' },
  'settings.display.showLatency': {
    en: 'Show server latency (ms)',
    es: 'Mostrar latencia del servidor (ms)',
  },
  'settings.display.showPlayerNames': {
    en: 'Show player names over their heads',
    es: 'Mostrar nombres de jugadores sobre sus cabezas',
  },

  // --- Settings window: language ---
  'settings.controls.title': { en: 'Controls', es: 'Controles' },
  'settings.controls.touchMove': { en: 'Tap / click to move', es: 'Tocar / clic para moverse' },
  'settings.controls.touchMoveHelp': {
    en: 'When off, tapping or clicking the map no longer moves your character.',
    es: 'Si está desactivado, tocar o hacer clic en el mapa ya no mueve a tu personaje.',
  },
  'settings.controls.runKey': { en: 'Run key (hold to run)', es: 'Tecla de correr (mantener para correr)' },
  'settings.controls.runKeyPress': { en: 'Press a key…', es: 'Pulsa una tecla…' },
  'settings.controls.runKeyHelp': {
    en: 'Hold this key while walking to run. You need the Running Shoes in your bag.',
    es: 'Mantén esta tecla mientras caminas para correr. Necesitas los Zapatos Deportivos en tu mochila.',
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
  'account.cancel': { en: 'Cancel', es: 'Cancelar' },
  'account.dangerZone': { en: 'Danger zone', es: 'Zona de peligro' },
  'account.deleteAccount': { en: 'Delete account', es: 'Eliminar cuenta' },
  'account.deleteAccountHelp': {
    en: 'Permanently delete your account and all of your data. This cannot be undone.',
    es: 'Elimina permanentemente tu cuenta y todos tus datos. Esto no se puede deshacer.'
  },
  'account.deleteConfirmWarning': {
    en: 'This will permanently delete your account, Pokemon, items, money, and progress. This action cannot be undone.',
    es: 'Esto eliminará permanentemente tu cuenta, Pokemon, objetos, dinero y progreso. Esta acción no se puede deshacer.'
  },
  'account.deleteCodeIntro': {
    en: "We'll send a confirmation code to {email} to verify it's you.",
    es: 'Enviaremos un código de confirmación a {email} para verificar que eres tú.'
  },
  'account.deleteSendCode': { en: 'Send confirmation code', es: 'Enviar código de confirmación' },
  'account.deleteCodeSent': {
    en: 'We sent a confirmation code to {email}. Enter it below to permanently delete your account.',
    es: 'Enviamos un código de confirmación a {email}. Ingrésalo abajo para eliminar tu cuenta permanentemente.'
  },
  'account.deleteCodeLabel': { en: 'Confirmation code', es: 'Código de confirmación' },
  'account.deleteResendCode': { en: 'Resend code', es: 'Reenviar código' },
  'account.deleteConfirmButton': { en: 'Permanently delete account', es: 'Eliminar cuenta permanentemente' },

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
  'bag.cancel': { en: 'Cancel', es: 'Cancelar' },
  'bag.replaceMoveTitle': { en: 'Replace a move', es: 'Reemplazar un movimiento' },
  'bag.replaceMovePrompt': {
    en: 'This Venomon already knows four moves. Choose one to forget.',
    es: 'Este Venomon ya conoce cuatro movimientos. Elige cuál olvidar.'
  },

  // --- Venomons window ---
  'party.onHand': { en: 'Venomons on hand:', es: 'Venomons en el equipo:' },
  'party.orderHint': {
    en: 'The first Venomon in the list battles first. Use Move Up / Move Down to change the order.',
    es: 'El primer Venomon de la lista lucha primero. Usa Subir / Bajar para cambiar el orden.',
  },
  'party.empty': { en: 'No Venomons in your party yet.', es: 'Aún no tienes Venomons en tu equipo.' },
  'party.lead': { en: 'Lead', es: 'Líder' },
  'party.followerEnable': { en: 'Let it follow you', es: 'Que te siga en el mapa' },
  'party.followerDisable': { en: 'Return it to its Venoball', es: 'Que vuelva a su Venoball' },
  'party.moves': { en: 'Moves', es: 'Movimientos' },
  'party.noMoves': { en: 'No moves learned.', es: 'No ha aprendido movimientos.' },

  // --- Trainer card / battle history ---
  'trainer.battleHistory': { en: 'Battle History', es: 'Historial de Batallas' },
  'trainer.noDescription': { en: 'No description set.', es: 'Sin descripción.' },
  'trainer.gymMedals': { en: 'Gym Medals', es: 'Medallas de Gimnasio' },
  'trainer.team': { en: 'Team', es: 'Equipo' },
  'trainer.readyForChallenge': { en: 'Ready for a challenge.', es: 'Listo para un desafío.' },
  'trainer.loadingCard': { en: 'Loading trainer card…', es: 'Cargando tarjeta…' },
  'trainer.challenge': { en: 'Challenge to Battle', es: 'Retar a Combate' },
  'trainer.trade': { en: 'Trade Request', es: 'Solicitar Intercambio' },
  'trainer.close': { en: 'Close', es: 'Cerrar' },
  'history.empty': { en: 'No battles recorded yet.', es: 'Aún no hay batallas registradas.' },

  // --- Account tabs / skin shop / trainer card color ---
  'account.tab.profile': { en: 'Profile', es: 'Perfil' },
  'account.tab.skin': { en: 'Skin', es: 'Apariencia' },
  'account.tab.card': { en: 'Card', es: 'Tarjeta' },
  'skin.intro': { en: 'Change your trainer skin for ${price} each.', es: 'Cambia tu apariencia por ${price} cada vez.' },
  'skin.empty': { en: 'No skins are available yet.', es: 'Aún no hay apariencias disponibles.' },
  'skin.noPreview': { en: 'No preview', es: 'Sin vista previa' },
  'skin.wearing': { en: 'Wearing', es: 'En uso' },
  'skin.change': { en: 'Change – ${price}', es: 'Cambiar – ${price}' },
  'skin.notEnough': { en: 'You need ${price} to change your skin.', es: 'Necesitas ${price} para cambiar de apariencia.' },
  'card.intro': { en: 'Pick a background color for your Trainer Card.', es: 'Elige un color de fondo para tu Tarjeta de Entrenador.' },
  'card.preview': { en: 'Preview', es: 'Vista previa' },

  // --- Friends / social ---
  'menu.friends': { en: 'Friends', es: 'Amigos' },
  'friends.tab.friends': { en: 'Friends', es: 'Amigos' },
  'friends.tab.requests': { en: 'Requests', es: 'Solicitudes' },
  'friends.tab.add': { en: 'Add', es: 'Agregar' },
  'friends.tab.config': { en: 'Config', es: 'Configuración' },
  'friends.actions': { en: 'Actions', es: 'Acciones' },
  'friends.online': { en: 'Online', es: 'En línea' },
  'friends.offline': { en: 'Offline', es: 'Desconectado' },
  'friends.onSameMap': { en: 'Online — on your map', es: 'En línea — en tu mapa' },
  'friends.privateChat': { en: 'Private Chat', es: 'Chat privado' },
  'friends.teleportTo': { en: 'Teleport to friend', es: 'Teletransportarte a tu amigo' },
  'friends.challenge': { en: 'Challenge to Battle', es: 'Retar a batalla' },
  'friends.trade': { en: 'Trade Request', es: 'Solicitar intercambio' },
  'friends.sameMapOnly': { en: 'same map only', es: 'solo en el mismo mapa' },
  'friends.unfriend': { en: 'Unfriend', es: 'Eliminar amigo' },
  'friends.emptyList': {
    en: 'No friends yet. Use the Add tab to send a friend request.',
    es: 'Aún no tienes amigos. Usa la pestaña Agregar para enviar una solicitud.'
  },
  'friends.incomingRequests': { en: 'Incoming requests', es: 'Solicitudes recibidas' },
  'friends.outgoingRequests': { en: 'Sent requests', es: 'Solicitudes enviadas' },
  'friends.noIncoming': { en: 'No pending requests.', es: 'No hay solicitudes pendientes.' },
  'friends.noOutgoing': { en: 'You have not sent any requests.', es: 'No has enviado solicitudes.' },
  'friends.cancelRequest': { en: 'Cancel', es: 'Cancelar' },
  'friends.addHint': {
    en: 'Type the exact username of the trainer you want to befriend. They must accept your request.',
    es: 'Escribe el nombre de usuario exacto del entrenador que quieres agregar. Deberá aceptar tu solicitud.'
  },
  'friends.usernamePlaceholder': { en: 'Username', es: 'Nombre de usuario' },
  'friends.sendRequest': { en: 'Send', es: 'Enviar' },
  'friends.configHint': {
    en: 'Control what other trainers can send you.',
    es: 'Controla lo que otros entrenadores pueden enviarte.'
  },
  'friends.allowRequests': { en: 'Accept friend requests', es: 'Aceptar solicitudes de amistad' },
  'friends.allowTeleports': { en: 'Accept teleport requests', es: 'Aceptar teletransportes' },
  'friends.allowChatInvites': { en: 'Accept chat invitations', es: 'Aceptar invitaciones de chat' },

  // --- Notification center ---
  'social.notifications': { en: 'Notifications', es: 'Notificaciones' },
  'social.notificationTitle': { en: 'PokeCraft', es: 'PokeCraft' },
  'social.close': { en: 'Close', es: 'Cerrar' },
  'social.noNotifications': { en: 'Nothing new right now.', es: 'No hay nada nuevo por ahora.' },
  'social.accept': { en: 'Accept', es: 'Aceptar' },
  'social.decline': { en: 'Decline', es: 'Rechazar' },
  'social.dismiss': { en: 'Dismiss', es: 'Descartar' },
  'social.friendRequestFrom': { en: '{name} sent you a friend request.', es: '{name} te envió una solicitud de amistad.' },
  'social.friendAcceptedBy': { en: '{name} accepted your friend request.', es: '{name} aceptó tu solicitud de amistad.' },
  'social.teleportRequestFrom': { en: '{name} wants to teleport to you.', es: '{name} quiere teletransportarse hacia ti.' },
  'social.chatInviteFrom': { en: '{name} invited you to a private chat.', es: '{name} te invitó a un chat privado.' },
  'social.teleportAccepted': { en: '{name} accepted your teleport request.', es: '{name} aceptó tu teletransporte.' },
  'social.teleportDeclined': { en: '{name} declined your teleport request.', es: '{name} rechazó tu teletransporte.' },
  'social.teleportExpired': { en: 'Your teleport request expired.', es: 'Tu solicitud de teletransporte expiró.' },
  'social.chatInviteDeclined': { en: '{name} declined your chat invitation.', es: '{name} rechazó tu invitación de chat.' },
  'social.chatInviteExpired': { en: 'A chat invitation expired.', es: 'Una invitación de chat expiró.' },
  'social.genericError': { en: 'Something went wrong.', es: 'Algo salió mal.' },
  'social.native.friendRequest': { en: 'Friend request from {name}', es: 'Solicitud de amistad de {name}' },
  'social.native.friendAccepted': { en: '{name} accepted your friend request', es: '{name} aceptó tu solicitud de amistad' },
  'social.native.teleportRequest': { en: '{name} wants to teleport to you', es: '{name} quiere teletransportarse hacia ti' },
  'social.native.chatInvite': { en: '{name} invited you to a chat', es: '{name} te invitó a un chat' },
  'social.native.whisper': { en: 'Whisper from {name}', es: 'Susurro de {name}' },
  'social.native.privateMessage': { en: 'New message from {name}', es: 'Nuevo mensaje de {name}' },

  // --- Chat ---
  'chat.mapChat': { en: 'Map chat', es: 'Chat del mapa' },
  'chat.open': { en: 'Open chat', es: 'Abrir chat' },
  'chat.hide': { en: 'Hide', es: 'Ocultar' },
  'chat.empty': { en: 'No messages yet.', es: 'Aún no hay mensajes.' },
  'chat.placeholder': { en: 'Message or /command…', es: 'Mensaje o /comando…' },
  'chat.send': { en: 'Send', es: 'Enviar' },
  'chat.globalTag': { en: 'GLOBAL', es: 'GLOBAL' },
  'chat.whisperTag': { en: '[Whisper] {from} → {to}:', es: '[Susurro] {from} → {to}:' },
  'chat.privateChat': { en: 'Private Chat', es: 'Chat privado' },
  'chat.privateClosed': {
    en: 'This chat has ended. You can close this window.',
    es: 'Este chat terminó. Puedes cerrar esta ventana.'
  },
  'chat.withMembers': { en: 'With: {names}', es: 'Con: {names}' },
  'chat.waitingForMembers': {
    en: 'Waiting for others to accept the invitation…',
    es: 'Esperando a que acepten la invitación…'
  },
  'chat.pendingInvites': { en: 'Invited: {names}', es: 'Invitados: {names}' },
  'chat.invite': { en: 'Invite friend', es: 'Invitar amigo' },
  'chat.leave': { en: 'Leave chat', es: 'Salir del chat' },

  // --- Settings -> Chat tab ---
  'settings.chat.title': { en: 'Chat', es: 'Chat' },
  'settings.chat.enabled': { en: 'Show map chat', es: 'Mostrar chat del mapa' },
  'settings.chat.timestamps': { en: 'Show timestamps', es: 'Mostrar hora' },
  'settings.chat.nativeNotifications': { en: 'Native notifications', es: 'Notificaciones nativas' },
  'settings.chat.bubbles': { en: 'Same-map player chat bubbles', es: 'Burbujas de chat sobre los jugadores' },
  'settings.chat.bubbleDuration': { en: 'Bubble duration', es: 'Duración de la burbuja' },
  'settings.chat.help': {
    en: 'Commands: /w <user> <message> to whisper, /help to return to the last Venomon Center.',
    es: 'Comandos: /w <usuario> <mensaje> para susurrar, /ayuda para volver al último Centro Venomon.'
  },

  // --- Trainer card friendship ---
  'trainer.isFriend': { en: 'You are friends', es: 'Son amigos' },
  'trainer.addFriend': { en: 'Send friend request', es: 'Enviar solicitud de amistad' },
  'trainer.friendRequestPending': { en: 'Request pending', es: 'Solicitud pendiente' },
  'trainer.privateChat': { en: 'Private Chat', es: 'Chat privado' },
  // --- Player-to-player trading ---
  'trade.title': { en: 'Trade', es: 'Intercambio' },
  'trade.yourOffer': { en: 'Your Offer', es: 'Tu Oferta' },
  'trade.theirOffer': { en: 'Their Offer', es: 'Su Oferta' },
  'trade.addToOffer': { en: 'Add to your offer', es: 'Agregar a tu oferta' },
  'trade.venomons': { en: 'Venomons', es: 'Venomons' },
  'trade.items': { en: 'Items', es: 'Objetos' },
  'trade.money': { en: 'Money', es: 'Dinero' },
  'trade.none': { en: 'Nothing', es: 'Nada' },
  'trade.level': { en: 'Lv', es: 'Nv' },
  'trade.hp': { en: 'HP', es: 'PS' },
  'trade.egg': { en: 'Egg', es: 'Huevo' },
  'trade.shiny': { en: 'Shiny', es: 'Variocolor' },
  'trade.fromParty': { en: 'Party', es: 'Equipo' },
  'trade.fromStorage': { en: 'Storage', es: 'Almacenamiento' },
  'trade.party': { en: 'Party', es: 'Equipo' },
  'trade.restricted': { en: 'Restricted', es: 'Restringido' },
  'trade.remove': { en: 'Remove', es: 'Quitar' },
  'trade.increaseQuantity': { en: 'Increase quantity', es: 'Aumentar cantidad' },
  'trade.decreaseQuantity': { en: 'Decrease quantity', es: 'Reducir cantidad' },
  'trade.quantity': { en: 'Quantity', es: 'Cantidad' },
  'trade.owned': { en: 'Owned', es: 'Tienes' },
  'trade.searchItems': { en: 'Search items…', es: 'Buscar objetos…' },
  'trade.noItems': { en: 'No matching items.', es: 'Sin objetos coincidentes.' },
  'trade.tabVenomons': { en: 'Venomons', es: 'Venomons' },
  'trade.tabItems': { en: 'Items', es: 'Objetos' },
  'trade.tabMoney': { en: 'Money', es: 'Dinero' },
  'trade.yourBalance': { en: 'Your balance', es: 'Tu saldo' },
  'trade.setMoney': { en: 'Set', es: 'Fijar' },
  'trade.moneyHint': {
    en: 'Whole numbers only. The server checks your balance again before the trade completes.',
    es: 'Solo numeros enteros. El servidor verifica tu saldo otra vez antes de completar el intercambio.'
  },
  'trade.offeringNothing': { en: 'This side is offering nothing.', es: 'Este lado no ofrece nada.' },
  'trade.statusEditing': { en: 'Editing', es: 'Editando' },
  'trade.statusLocked': { en: 'Locked', es: 'Bloqueada' },
  'trade.statusConfirmed': { en: 'Confirmed', es: 'Confirmado' },
  'trade.statusDisconnected': { en: 'Disconnected', es: 'Desconectado' },
  'trade.newAccount': { en: 'New account', es: 'Cuenta nueva' },
  'trade.lockOffer': { en: 'Lock Offer', es: 'Bloquear Oferta' },
  'trade.unlockOffer': { en: 'Unlock Offer', es: 'Desbloquear Oferta' },
  'trade.cancelTrade': { en: 'Cancel Trade', es: 'Cancelar Intercambio' },
  'trade.lockHint': {
    en: 'Any change to either offer unlocks both sides again.',
    es: 'Cualquier cambio en una oferta desbloquea ambos lados de nuevo.'
  },
  'trade.reviewAgain': {
    en: 'The offer changed — review it and lock again.',
    es: 'La oferta cambio: revisala y bloquea de nuevo.'
  },
  'trade.partnerDisconnected': {
    en: 'The other trainer disconnected. The trade is paused.',
    es: 'El otro entrenador se desconecto. El intercambio esta en pausa.'
  },
  'trade.chatTitle': { en: 'Trade Chat', es: 'Chat del Intercambio' },
  'trade.chatEmpty': { en: 'No messages yet.', es: 'Aun no hay mensajes.' },
  'trade.chatPlaceholder': { en: 'Message…', es: 'Mensaje…' },
  'trade.send': { en: 'Send', es: 'Enviar' },
  'trade.you': { en: 'You', es: 'Tu' },
  'trade.requestFrom': {
    en: '{name} wants to trade with you.',
    es: '{name} quiere intercambiar contigo.'
  },
  'trade.accept': { en: 'Accept', es: 'Aceptar' },
  'trade.decline': { en: 'Decline', es: 'Rechazar' },
  'trade.close': { en: 'Close', es: 'Cerrar' },
  'trade.finalWarningTitle': { en: 'Final confirmation', es: 'Confirmacion final' },
  'trade.finalWarningBody': {
    en: 'Check every Venomon, item and amount below. Once both trainers confirm, this exchange is permanent and cannot be undone.',
    es: 'Revisa cada Venomon, objeto y cantidad. Cuando ambos entrenadores confirmen, el intercambio es permanente y no se puede deshacer.'
  },
  'trade.youGive': { en: 'You give', es: 'Tu entregas' },
  'trade.youReceive': { en: 'You receive', es: 'Tu recibes' },
  'trade.youGave': { en: 'You gave', es: 'Entregaste' },
  'trade.youReceived': { en: 'You received', es: 'Recibiste' },
  'trade.heldItemRule': {
    en: 'Held items travel with their Venomon.',
    es: 'Los objetos equipados viajan con su Venomon.'
  },
  'trade.warningsTitle': { en: 'Things to double-check', es: 'Cosas para revisar' },
  'trade.warningsAdvisory': {
    en: 'These are advisory only — gifts and uneven trades are allowed.',
    es: 'Son solo avisos: los regalos e intercambios desiguales estan permitidos.'
  },
  'trade.snapshotId': { en: 'Trade', es: 'Intercambio' },
  'trade.snapshotHash': { en: 'Hash', es: 'Hash' },
  'trade.confirmFinal': { en: 'Confirm Trade', es: 'Confirmar Intercambio' },
  'trade.confirmed': { en: 'Confirmed', es: 'Confirmado' },
  'trade.confirmIn': { en: 'Confirm in {seconds}s', es: 'Confirmar en {seconds}s' },
  'trade.backToEditing': { en: 'Back to editing', es: 'Volver a editar' },
  'trade.youConfirmed': { en: 'You confirmed', es: 'Confirmaste' },
  'trade.youNotConfirmed': { en: 'Waiting for your confirmation', es: 'Esperando tu confirmacion' },
  'trade.theyConfirmed': { en: '{name} confirmed', es: '{name} confirmo' },
  'trade.theyNotConfirmed': { en: 'Waiting for {name}', es: 'Esperando a {name}' },
  'trade.nicknameWarning': {
    en: 'Nickname differs from species — this is a {species}.',
    es: 'El apodo no coincide con la especie: es un {species}.'
  },
  'trade.holdingItem': { en: 'Holding {item} (transfers with it)', es: 'Lleva {item} (se transfiere)' },
  'trade.outcomeCompleted': { en: 'Trade completed.', es: 'Intercambio completado.' },
  'trade.outcomeCancelled': { en: 'Trade cancelled.', es: 'Intercambio cancelado.' },
  'trade.outcomeFailed': {
    en: 'The trade could not be completed. Nothing was exchanged.',
    es: 'No se pudo completar el intercambio. No se intercambio nada.'
  },
  'trade.report': { en: 'Report this trade', es: 'Reportar este intercambio' },
  'trade.historyEmpty': { en: 'No completed trades yet.', es: 'Aun no hay intercambios completados.' },
  'trade.historyCount': { en: '{total} completed trades', es: '{total} intercambios completados' },
  'trade.completed': { en: 'Completed', es: 'Completado' },
  'trade.failed': { en: 'Failed', es: 'Fallido' },
  'trade.loading': { en: 'Loading…', es: 'Cargando…' },
  'trade.refresh': { en: 'Refresh', es: 'Actualizar' },
  'trade.rarity.common': { en: 'Common', es: 'Comun' },
  'trade.rarity.uncommon': { en: 'Uncommon', es: 'Poco comun' },
  'trade.rarity.rare': { en: 'Rare', es: 'Raro' },
  'trade.rarity.epic': { en: 'Very rare', es: 'Muy raro' },
  'trade.state.REQUESTED': { en: 'Request sent', es: 'Solicitud enviada' },
  'trade.state.OPEN': { en: 'Building offers', es: 'Armando ofertas' },
  'trade.state.PLAYER_A_LOCKED': { en: 'One offer locked', es: 'Una oferta bloqueada' },
  'trade.state.PLAYER_B_LOCKED': { en: 'One offer locked', es: 'Una oferta bloqueada' },
  'trade.state.BOTH_LOCKED': { en: 'Both offers locked', es: 'Ambas ofertas bloqueadas' },
  'trade.state.FINAL_CONFIRMATION': { en: 'Final confirmation', es: 'Confirmacion final' },
  'trade.state.PROCESSING': { en: 'Completing…', es: 'Completando…' },
  'trade.state.COMPLETED': { en: 'Completed', es: 'Completado' },
  'trade.state.DECLINED': { en: 'Declined', es: 'Rechazado' },
  'trade.state.CANCELLED': { en: 'Cancelled', es: 'Cancelado' },
  'trade.state.EXPIRED': { en: 'Expired', es: 'Expirado' },
  'trade.state.FAILED': { en: 'Failed', es: 'Fallido' },
  'trade.warning.ONE_SIDED': { en: 'One side is offering nothing.', es: 'Un lado no ofrece nada.' },
  'trade.warning.UNBALANCED': { en: 'This trade looks very uneven.', es: 'Este intercambio se ve muy desigual.' },
  'trade.warning.RARE_ASSET': { en: 'A rare asset is included.', es: 'Se incluye algo raro.' },
  'trade.warning.NICKNAMED_VENOMON': { en: 'A nickname hides the species.', es: 'Un apodo oculta la especie.' },
  'trade.warning.EGG_INCLUDED': { en: 'An unhatched egg is included.', es: 'Se incluye un huevo sin eclosionar.' },
  'trade.warning.HELD_ITEM_TRANSFERS': { en: 'A held item transfers too.', es: 'Un objeto equipado tambien se transfiere.' },
  'trade.warning.NEW_ACCOUNT': { en: 'One account is very new.', es: 'Una cuenta es muy nueva.' },
  'trade.warning.SIMILAR_ITEM_NAMES': { en: 'Two items have nearly identical names.', es: 'Dos objetos tienen nombres casi identicos.' },
  'trade.warning.LARGE_CURRENCY': { en: 'A large amount of money is involved.', es: 'Hay una gran cantidad de dinero.' },

  // --- Account characters (account = @handle owning up to 6 characters) ---
  'menu.characters': { en: 'Characters', es: 'Personajes' },
  'characters.slots': { en: 'Characters: {count}/{max}', es: 'Personajes: {count}/{max}' },
  'characters.active': { en: 'Active', es: 'Activo' },
  'characters.deleted': { en: 'Deleted', es: 'Eliminado' },
  'characters.play': { en: 'Play', es: 'Jugar' },
  'characters.playConfirm': {
    en: 'Switch to {name}? The game will reload as that character.',
    es: '¿Cambiar a {name}? El juego se recargará con ese personaje.'
  },
  'characters.delete': { en: 'Delete', es: 'Eliminar' },
  'characters.deleteConfirm': {
    en: 'Delete {name}? You can restore it within 30 days.',
    es: '¿Eliminar a {name}? Podrás restaurarlo durante 30 días.'
  },
  'characters.restore': { en: 'Restore', es: 'Restaurar' },
  'characters.badges': { en: 'Medals', es: 'Medallas' },
  'characters.money': { en: 'Money', es: 'Dinero' },
  'characters.party': { en: 'Party', es: 'Equipo' },
  'characters.lastPlayed': { en: 'Last played', es: 'Última vez' },
  'characters.createTitle': { en: 'Create a new character', es: 'Crear un personaje nuevo' },
  'characters.namePlaceholder': { en: 'Character name', es: 'Nombre del personaje' },
  'characters.nameHint': {
    en: 'Letters only, 2 to 30 characters.',
    es: 'Solo letras, de 2 a 30 caracteres.'
  },
  'characters.create': { en: 'Create', es: 'Crear' },
  'characters.maxReached': {
    en: 'Character limit reached ({max}).',
    es: 'Límite de personajes alcanzado ({max}).'
  },

  // --- Friends: presence details / blocked accounts / privacy prefs ---
  'friends.playing': { en: 'Playing: {name}', es: 'Jugando: {name}' },
  'friends.lastSeen': { en: 'Last seen: {when}', es: 'Visto por última vez: {when}' },
  'friends.lastCharacter': { en: 'Last character: {name}', es: 'Último personaje: {name}' },
  'friends.tab.blocked': { en: 'Blocked', es: 'Bloqueados' },
  'friends.unblock': { en: 'Unblock', es: 'Desbloquear' },
  'friends.noBlocked': {
    en: 'You have not blocked any account.',
    es: 'No has bloqueado ninguna cuenta.'
  },
  'friends.blockedHint': {
    en: 'Blocking an account blocks all of its characters.',
    es: 'Bloquear una cuenta bloquea a todos sus personajes.'
  },
  'friends.showOnlineStatus': { en: 'Show my online status', es: 'Mostrar cuando estoy en línea' },
  'friends.showActiveCharacter': { en: 'Show my active character', es: 'Mostrar mi personaje activo' },
  'friends.showCurrentMap': { en: 'Show my current map', es: 'Mostrar mi mapa actual' },
  'friends.showLastSeen': { en: 'Show my last seen time', es: 'Mostrar mi última conexión' },

  // --- Trainer card: block account ---
  'trainer.block': { en: 'Block account', es: 'Bloquear' },
  'trainer.blockConfirm': {
    en: 'Block @{name}? None of their characters will be able to contact you.',
    es: '¿Bloquear a @{name}? Ninguno de sus personajes podrá contactarte.'
  },
  'trainer.blocked': { en: 'Account blocked', es: 'Cuenta bloqueada' },

  // --- PC bank: shared per-character deposits ---
  'pc.deposits': { en: 'Deposits by character', es: 'Depósitos por personaje' },
  'pc.you': { en: '(you)', es: '(tú)' },
  'pc.withdraw': { en: 'Withdraw', es: 'Retirar' },
  'pc.medalHint': {
    en: "Withdrawing another character's deposit requires gym medals.",
    es: 'Retirar el depósito de otro personaje requiere medallas de gimnasio.'
  },
  'pc.ownerBadge': { en: 'From: {name}', es: 'De: {name}' },
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
