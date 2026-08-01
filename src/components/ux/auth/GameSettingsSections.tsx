import { useState } from 'react';
import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Select,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  CHAT_BUBBLE_DURATION_MAX,
  CHAT_BUBBLE_DURATION_MIN,
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  useGameSettings,
  type LanguageSetting,
} from '../../../settings/gameSettings';
import { detectSystemLanguage, useT } from '../../../i18n';
import { SettingSlider } from './GamepadSettings';
import { ensureNotificationPermission } from '../game/social/notify';

/**
 * "Audio", "Display", "Controls" and "Language" tabs of the Settings window
 * (AccountMenu.tsx). All values persist via settings/gameSettings.ts and apply
 * live: the audio managers re-read them on change, the scaled surfaces
 * (EventDialog, NpcInteractions, BattleScene, the interface windows) subscribe
 * through useGameSettings, and useT() re-renders translated components.
 */

const percent = (value: number) => `${Math.round(value * 100)}%`;

export const AudioSettingsSection = () => {
  const [settings, update] = useGameSettings();
  const t = useT();

  return (
    <VStack align="stretch" spacing={4}>
      <SettingSlider
        label={t('settings.audio.music')}
        value={settings.audio.musicVolume}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        onChange={(musicVolume) => update({ audio: { ...settings.audio, musicVolume } })}
      />
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.audio.musicMute')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.audio.musicMuted}
          onChange={(event) => update({ audio: { ...settings.audio, musicMuted: event.target.checked } })}
        />
      </FormControl>

      <SettingSlider
        label={t('settings.audio.sfx')}
        value={settings.audio.sfxVolume}
        min={0}
        max={1}
        step={0.05}
        format={percent}
        onChange={(sfxVolume) => update({ audio: { ...settings.audio, sfxVolume } })}
      />
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.audio.sfxMute')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.audio.sfxMuted}
          onChange={(event) => update({ audio: { ...settings.audio, sfxMuted: event.target.checked } })}
        />
      </FormControl>
    </VStack>
  );
};

export const DisplaySettingsSection = () => {
  const [settings, update] = useGameSettings();
  const t = useT();

  return (
    <VStack align="stretch" spacing={4}>
      <SettingSlider
        label={t('settings.display.dialogs')}
        value={settings.uiScale.dialogs}
        min={UI_SCALE_MIN}
        max={UI_SCALE_MAX}
        step={0.05}
        format={percent}
        onChange={(dialogs) => update({ uiScale: { ...settings.uiScale, dialogs } })}
      />
      <SettingSlider
        label={t('settings.display.interface')}
        value={settings.uiScale.interface}
        min={UI_SCALE_MIN}
        max={UI_SCALE_MAX}
        step={0.05}
        format={percent}
        onChange={(scale) => update({ uiScale: { ...settings.uiScale, interface: scale } })}
      />
      <SettingSlider
        label={t('settings.display.battle')}
        value={settings.uiScale.battle}
        min={UI_SCALE_MIN}
        max={UI_SCALE_MAX}
        step={0.05}
        format={percent}
        onChange={(battle) => update({ uiScale: { ...settings.uiScale, battle } })}
      />
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.display.showFps')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.hud.showFps}
          onChange={(event) => update({ hud: { ...settings.hud, showFps: event.target.checked } })}
        />
      </FormControl>
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.display.showLatency')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.hud.showLatency}
          onChange={(event) => update({ hud: { ...settings.hud, showLatency: event.target.checked } })}
        />
      </FormControl>
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.display.showPlayerNames')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.hud.showPlayerNames}
          onChange={(event) =>
            update({ hud: { ...settings.hud, showPlayerNames: event.target.checked } })
          }
        />
      </FormControl>
    </VStack>
  );
};

/** Friendly display for a stored KeyboardEvent.key ("` `" reads as "Space"). */
const describeKey = (key: string) => {
  if (key === ' ') return 'Space';
  return key.length === 1 ? key.toUpperCase() : key;
};

export const ControlsSettingsSection = () => {
  const [settings, update] = useGameSettings();
  const [capturingRunKey, setCapturingRunKey] = useState(false);
  const t = useT();

  return (
    <VStack align="stretch" spacing={4}>
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.controls.touchMove')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.controls.touchMoveEnabled}
          onChange={(event) => update({ controls: { ...settings.controls, touchMoveEnabled: event.target.checked } })}
        />
      </FormControl>
      <Text mt={-2} fontSize="sm" color="gray.500">
        {t('settings.controls.touchMoveHelp')}
      </Text>

      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.controls.runKey')}</FormLabel>
        <Button
          size="sm"
          variant="outline"
          colorScheme={capturingRunKey ? 'teal' : 'gray'}
          onClick={() => setCapturingRunKey(true)}
          onBlur={() => setCapturingRunKey(false)}
          onKeyDown={(event) => {
            if (!capturingRunKey) return;
            event.preventDefault();
            event.stopPropagation();
            // Modifier keys are valid run keys (Shift is the classic one);
            // Escape cancels the capture instead of binding it.
            if (event.key === 'Escape') {
              setCapturingRunKey(false);
              return;
            }
            update({ controls: { ...settings.controls, runKey: event.key } });
            setCapturingRunKey(false);
          }}
        >
          {capturingRunKey ? t('settings.controls.runKeyPress') : describeKey(settings.controls.runKey)}
        </Button>
      </FormControl>
      <Text mt={-2} fontSize="sm" color="gray.500">
        {t('settings.controls.runKeyHelp')}
      </Text>
    </VStack>
  );
};

export const ChatSettingsSection = () => {
  const [settings, update] = useGameSettings();
  const t = useT();

  return (
    <VStack align="stretch" spacing={4}>
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.chat.enabled')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.chat.enabled}
          onChange={(event) => update({ chat: { ...settings.chat, enabled: event.target.checked } })}
        />
      </FormControl>
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.chat.timestamps')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.chat.showTimestamps}
          onChange={(event) => update({ chat: { ...settings.chat, showTimestamps: event.target.checked } })}
        />
      </FormControl>
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.chat.bubbles')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.chat.bubblesEnabled}
          onChange={(event) => update({ chat: { ...settings.chat, bubblesEnabled: event.target.checked } })}
        />
      </FormControl>
      {settings.chat.bubblesEnabled ? (
        <SettingSlider
          label={t('settings.chat.bubbleDuration')}
          value={settings.chat.bubbleDurationSeconds}
          min={CHAT_BUBBLE_DURATION_MIN}
          max={CHAT_BUBBLE_DURATION_MAX}
          step={1}
          format={(value) => `${Math.round(value)}s`}
          onChange={(bubbleDurationSeconds) =>
            update({ chat: { ...settings.chat, bubbleDurationSeconds } })
          }
        />
      ) : null}
      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.chat.nativeNotifications')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.chat.nativeNotifications}
          onChange={(event) => {
            const enabled = event.target.checked;
            update({ chat: { ...settings.chat, nativeNotifications: enabled } });
            if (enabled) {
              // Prompt the platform permission right away so the first friend
              // request can actually surface a native notification.
              void ensureNotificationPermission();
            }
          }}
        />
      </FormControl>
      <Text mt={-2} fontSize="sm" color="gray.500">
        {t('settings.chat.help')}
      </Text>
    </VStack>
  );
};

export const LanguageSettingsSection = () => {
  const [settings, update] = useGameSettings();
  const t = useT();

  return (
    <FormControl>
      <Select
        size="sm"
        bg="whiteAlpha.100"
        borderColor="whiteAlpha.300"
        value={settings.language}
        onChange={(event) => update({ language: event.target.value as LanguageSetting })}
      >
        <option value="auto" style={{ color: '#1a202c' }}>{t('settings.language.auto')}</option>
        <option value="en" style={{ color: '#1a202c' }}>{t('settings.language.en')}</option>
        <option value="es" style={{ color: '#1a202c' }}>{t('settings.language.es')}</option>
      </Select>
      {settings.language === 'auto' ? (
        <FormHelperText color="gray.500">
          {t('settings.language.detected')}{' '}
          {detectSystemLanguage() === 'es' ? 'Español' : 'English'}
        </FormHelperText>
      ) : null}
    </FormControl>
  );
};
