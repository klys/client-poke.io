/**
 * Cross-platform "native" notification helper for social events (friend
 * requests, teleport requests, chat invites, whispers).
 *
 * - Browser + Electron: the HTML5 Notification API. Electron routes it to the
 *   OS notification center automatically (the app:// scheme is a secure
 *   context and Electron auto-grants permission).
 * - Capacitor (Android): the WebView has no window.Notification, so we call
 *   the LocalNotifications plugin through the injected window.Capacitor
 *   bridge. When the plugin is not installed in the shell this silently
 *   no-ops, so the web bundle carries no Capacitor dependency.
 */

import { isCapacitor } from '../../../../platform';

type LocalNotificationsPlugin = {
  requestPermissions?: () => Promise<{ display?: string }>;
  checkPermissions?: () => Promise<{ display?: string }>;
  schedule: (options: {
    notifications: Array<{ id: number; title: string; body: string }>;
  }) => Promise<unknown>;
};

function getLocalNotificationsPlugin(): LocalNotificationsPlugin | null {
  const w = window as unknown as {
    Capacitor?: { Plugins?: { LocalNotifications?: LocalNotificationsPlugin } };
    top?: { Capacitor?: { Plugins?: { LocalNotifications?: LocalNotificationsPlugin } } } | null;
  };
  const plugin =
    w.Capacitor?.Plugins?.LocalNotifications ?? w.top?.Capacitor?.Plugins?.LocalNotifications;
  return plugin && typeof plugin.schedule === 'function' ? plugin : null;
}

/**
 * Asks the platform for notification permission. Safe to call repeatedly;
 * resolves true when notifications can be shown.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    if (isCapacitor()) {
      const plugin = getLocalNotificationsPlugin();
      if (!plugin) return false;
      const status = await plugin.requestPermissions?.();
      return status?.display !== 'denied';
    }
    if (typeof Notification === 'undefined') {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission === 'denied') {
      return false;
    }
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/**
 * Shows a native notification. Browser/Electron notifications are skipped
 * while the game window is focused (the in-game notification center already
 * shows the entry); Capacitor always schedules — Android decides whether to
 * present a heads-up.
 */
export function notifyNative(title: string, body: string) {
  try {
    if (isCapacitor()) {
      const plugin = getLocalNotificationsPlugin();
      if (!plugin) return;
      void plugin.schedule({
        notifications: [
          {
            // LocalNotifications ids must fit in a Java int.
            id: Math.floor(Date.now() % 2147483647),
            title,
            body
          }
        ]
      });
      return;
    }
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
      return;
    }
    if (typeof document !== 'undefined' && document.hasFocus()) {
      return;
    }
    const notification = new Notification(title, { body, tag: 'pokecraft-social' });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Notifications are best-effort; never break gameplay over them.
  }
}
