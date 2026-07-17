import {
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  Select,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react';
import {
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  useGameSettings,
  type LanguageSetting,
} from '../../../settings/gameSettings';
import { detectSystemLanguage, useT } from '../../../i18n';
import { SettingSlider } from './GamepadSettings';

/**
 * "Audio", "Display" and "Language" sections of the Settings window
 * (AccountMenu.tsx). All values persist via settings/gameSettings.ts and apply
 * live: the audio managers re-read them on change, the scaled surfaces
 * (EventDialog, NpcInteractions, BattleScene, the interface windows) subscribe
 * through useGameSettings, and useT() re-renders translated components.
 */

const percent = (value: number) => `${Math.round(value * 100)}%`;

const GameSettingsSections = () => {
  const [settings, update] = useGameSettings();
  const t = useT();

  return (
    <VStack align="stretch" spacing={4}>
      <Divider borderColor="whiteAlpha.300" />
      <Text fontWeight="700" fontSize="lg">{t('settings.audio.title')}</Text>

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

      <Divider borderColor="whiteAlpha.300" />
      <Text fontWeight="700" fontSize="lg">{t('settings.display.title')}</Text>

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

      <Divider borderColor="whiteAlpha.300" />
      <Text fontWeight="700" fontSize="lg">{t('settings.controls.title')}</Text>

      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('settings.controls.touchMove')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.controls.touchMoveEnabled}
          onChange={(event) => update({ controls: { touchMoveEnabled: event.target.checked } })}
        />
      </FormControl>
      <Text mt={-2} fontSize="sm" color="gray.500">
        {t('settings.controls.touchMoveHelp')}
      </Text>

      <Divider borderColor="whiteAlpha.300" />
      <Text fontWeight="700" fontSize="lg">{t('settings.language.title')}</Text>

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
    </VStack>
  );
};

export default GameSettingsSections;
