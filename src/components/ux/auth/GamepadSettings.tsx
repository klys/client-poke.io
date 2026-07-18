import {
  Badge,
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Select,
  Slider,
  SliderFilledTrack,
  SliderThumb,
  SliderTrack,
  Switch,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { isCapacitor, isElectron } from '../../../platform';
import {
  DEFAULT_GAMEPAD_SETTINGS,
  GAMEPAD_ACTION_OPTIONS,
  GamepadAction,
  STANDARD_BUTTONS,
  VirtualPadButton,
  VirtualPadVisibility,
  useGamepadSettings,
} from '../../../input/gamepadConfig';
import { useT, type Translator } from '../../../i18n';

/**
 * "Gamepad" tab of the Settings window (AccountMenu.tsx).
 *
 * Two halves:
 *   - Controller: enable switch, stick options, and the standard-mapping
 *     button -> game action table. While the window is open we poll the pad a
 *     few times a second so pressing a physical button highlights its row —
 *     that's how players identify which index their controller reports.
 *   - On-screen pad (mobile only): visibility mode, size, opacity, and the
 *     action bound to each A/B/X/Y face button.
 *
 * All values persist via gamepadConfig.ts and apply live — the input bridges
 * (GamepadControls.tsx, VirtualControls.tsx) subscribe to the same store.
 */

type PadStatus = { id: string; pressed: number[] } | null;

function usePadStatus() {
  const [status, setStatus] = useState<PadStatus>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;

    const read = () => {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (pad && pad.connected) {
          const pressed: number[] = [];
          pad.buttons.forEach((button, index) => {
            if (button.pressed || button.value > 0.5) pressed.push(index);
          });
          setStatus((current) =>
            current && current.id === pad.id && current.pressed.join() === pressed.join()
              ? current
              : { id: pad.id, pressed }
          );
          return;
        }
      }
      setStatus((current) => (current === null ? current : null));
    };

    read();
    const timer = window.setInterval(read, 150);
    return () => window.clearInterval(timer);
  }, []);

  return status;
}

function ActionSelect({
  value,
  onChange,
  t,
}: {
  value: GamepadAction;
  onChange: (action: GamepadAction) => void;
  t: Translator;
}) {
  return (
    <Select
      size="sm"
      maxW="220px"
      bg="whiteAlpha.100"
      borderColor="whiteAlpha.300"
      value={value}
      onChange={(event) => onChange(event.target.value as GamepadAction)}
    >
      {GAMEPAD_ACTION_OPTIONS.map((option) => (
        <option key={option.id} value={option.id} style={{ color: '#1a202c' }}>
          {t(`action.${option.id}`)}
        </option>
      ))}
    </Select>
  );
}

export function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <FormControl>
      <HStack justify="space-between">
        <FormLabel mb={1}>{label}</FormLabel>
        <Text fontSize="sm" color="gray.300">{format(value)}</Text>
      </HStack>
      <Slider value={value} min={min} max={max} step={step} onChange={onChange} colorScheme="teal">
        <SliderTrack bg="whiteAlpha.300">
          <SliderFilledTrack />
        </SliderTrack>
        <SliderThumb />
      </Slider>
    </FormControl>
  );
}

const VIRTUAL_BUTTON_LABEL_KEYS: Record<VirtualPadButton, string> = {
  a: 'gamepad.virtual.a',
  b: 'gamepad.virtual.b',
  x: 'gamepad.virtual.x',
  y: 'gamepad.virtual.y',
};

const GamepadSettings = () => {
  const [settings, update] = useGamepadSettings();
  const pad = usePadStatus();
  const t = useT();
  const onMobile = isCapacitor();
  const onElectron = isElectron();

  const setButtonAction = (index: number, action: GamepadAction) => {
    update({ buttonActions: { ...settings.buttonActions, [String(index)]: action } });
  };

  const setVirtual = (patch: Partial<typeof settings.virtual>) => {
    update({ virtual: { ...settings.virtual, ...patch } });
  };

  return (
    <VStack align="stretch" spacing={4}>
      <Box>
        <HStack spacing={2} flexWrap="wrap">
          {pad ? (
            <>
              <Badge colorScheme="green">{t('gamepad.connected')}</Badge>
              <Text fontSize="sm" color="gray.300" noOfLines={1}>{pad.id}</Text>
            </>
          ) : (
            <>
              <Badge colorScheme="yellow">{t('gamepad.none')}</Badge>
              <Text fontSize="xs" color="gray.400">
                {t('gamepad.wakeHint')}
              </Text>
            </>
          )}
        </HStack>
        {onElectron ? (
          <Text mt={2} fontSize="xs" color="yellow.200">
            {t('gamepad.electronNote')}
          </Text>
        ) : null}
      </Box>

      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('gamepad.enable')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.enabled}
          onChange={(event) => update({ enabled: event.target.checked })}
        />
      </FormControl>

      <FormControl display="flex" alignItems="center" justifyContent="space-between">
        <FormLabel mb={0}>{t('gamepad.leftStick')}</FormLabel>
        <Switch
          colorScheme="teal"
          isChecked={settings.leftStickMovement}
          onChange={(event) => update({ leftStickMovement: event.target.checked })}
        />
      </FormControl>

      <SettingSlider
        label={t('gamepad.deadZone')}
        value={settings.deadZone}
        min={0.1}
        max={0.9}
        step={0.05}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(deadZone) => update({ deadZone })}
      />

      <Box>
        <Text fontWeight="700">{t('gamepad.mapping')}</Text>
        <Text fontSize="xs" color="gray.400" mb={2}>
          {t('gamepad.mappingHint')}
        </Text>
        <VStack align="stretch" spacing={1}>
          {STANDARD_BUTTONS.map(({ index, label }) => {
            const isDown = !!pad && pad.pressed.includes(index);
            return (
              <HStack
                key={index}
                justify="space-between"
                px={2}
                py={1}
                borderRadius="6px"
                bg={isDown ? 'teal.600' : 'whiteAlpha.100'}
                border="1px solid"
                borderColor={isDown ? 'teal.300' : 'whiteAlpha.200'}
                transition="background 0.1s ease"
              >
                <Text fontSize="sm" fontWeight={isDown ? '800' : '400'}>{label}</Text>
                <ActionSelect
                  value={settings.buttonActions[String(index)] ?? 'none'}
                  onChange={(action) => setButtonAction(index, action)}
                  t={t}
                />
              </HStack>
            );
          })}
        </VStack>
        <Button
          mt={2}
          size="sm"
          variant="outline"
          color="white"
          borderColor="whiteAlpha.400"
          onClick={() => update({
            buttonActions: { ...DEFAULT_GAMEPAD_SETTINGS.buttonActions },
            deadZone: DEFAULT_GAMEPAD_SETTINGS.deadZone,
            leftStickMovement: DEFAULT_GAMEPAD_SETTINGS.leftStickMovement,
          })}
        >
          {t('gamepad.resetMapping')}
        </Button>
      </Box>

      <Divider borderColor="whiteAlpha.300" />
      <Box>
        <Text fontWeight="700" fontSize="lg">{t('gamepad.virtual.title')}</Text>
        <Text fontSize="xs" color="gray.400">
          {t('gamepad.virtual.hint')}
          {onMobile ? '' : ` ${t('gamepad.virtual.notMobile')}`}
        </Text>
      </Box>

      <FormControl>
        <FormLabel>{t('gamepad.virtual.visibility')}</FormLabel>
        <Select
          size="sm"
          bg="whiteAlpha.100"
          borderColor="whiteAlpha.300"
          value={settings.virtual.visibility}
          onChange={(event) => setVirtual({ visibility: event.target.value as VirtualPadVisibility })}
        >
          <option value="auto" style={{ color: '#1a202c' }}>{t('gamepad.virtual.visAuto')}</option>
          <option value="always" style={{ color: '#1a202c' }}>{t('gamepad.virtual.visAlways')}</option>
          <option value="hidden" style={{ color: '#1a202c' }}>{t('gamepad.virtual.visHidden')}</option>
        </Select>
        <FormHelperText color="gray.500">
          {t('gamepad.virtual.typingNote')}
        </FormHelperText>
      </FormControl>

      <SettingSlider
        label={t('gamepad.virtual.size')}
        value={settings.virtual.scale}
        min={0.6}
        max={1.6}
        step={0.05}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(scale) => setVirtual({ scale })}
      />

      <SettingSlider
        label={t('gamepad.virtual.opacity')}
        value={settings.virtual.opacity}
        min={0.2}
        max={1}
        step={0.05}
        format={(value) => `${Math.round(value * 100)}%`}
        onChange={(opacity) => setVirtual({ opacity })}
      />

      <Box>
        <Text fontWeight="700" mb={2}>{t('gamepad.virtual.actions')}</Text>
        <VStack align="stretch" spacing={1}>
          {(Object.keys(VIRTUAL_BUTTON_LABEL_KEYS) as VirtualPadButton[]).map((buttonId) => (
            <HStack
              key={buttonId}
              justify="space-between"
              px={2}
              py={1}
              borderRadius="6px"
              bg="whiteAlpha.100"
              border="1px solid"
              borderColor="whiteAlpha.200"
            >
              <Text fontSize="sm">{t(VIRTUAL_BUTTON_LABEL_KEYS[buttonId])}</Text>
              <ActionSelect
                value={settings.virtual.buttonActions[buttonId]}
                onChange={(action) => setVirtual({
                  buttonActions: { ...settings.virtual.buttonActions, [buttonId]: action },
                })}
                t={t}
              />
            </HStack>
          ))}
        </VStack>
        <Button
          mt={2}
          size="sm"
          variant="outline"
          color="white"
          borderColor="whiteAlpha.400"
          onClick={() => setVirtual({ ...DEFAULT_GAMEPAD_SETTINGS.virtual })}
        >
          {t('gamepad.virtual.reset')}
        </Button>
      </Box>
    </VStack>
  );
};

export default GamepadSettings;
