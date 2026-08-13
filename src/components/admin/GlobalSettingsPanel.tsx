import {
  Badge,
  Box,
  Button,
  HStack,
  Input,
  Stack,
  Switch,
  Text,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/authContext';

/** Mirror of the server's GlobalGameSettings (Server/ServerToClientEvents.ts). */
type GlobalGameSettings = {
  maxCharactersPerAccount: number;
  crossCharacterStorageMinMedals: number;
  characterRecoveryDays: number;
  skinChangePrice: number;
  startingMoney: number;
  allowMultipleBeachBalls: boolean;
};

type SettingsPayload = {
  settings: GlobalGameSettings;
  defaults: GlobalGameSettings;
};

type FieldSpec =
  | {
      key: keyof GlobalGameSettings;
      type: 'number';
      label: string;
      help: string;
      min: number;
      max: number;
    }
  | {
      key: keyof GlobalGameSettings;
      type: 'boolean';
      label: string;
      help: string;
    };

const FIELDS: FieldSpec[] = [
  {
    key: 'maxCharactersPerAccount',
    type: 'number',
    label: 'Max characters per account',
    help: 'How many non-deleted characters one account may own.',
    min: 1,
    max: 20
  },
  {
    key: 'crossCharacterStorageMinMedals',
    type: 'number',
    label: 'Cross-character storage medal requirement',
    help: 'Gym medals the active character needs before it can use shared-box assets (venomons, items, money) owned by the account’s other characters.',
    min: 0,
    max: 64
  },
  {
    key: 'characterRecoveryDays',
    type: 'number',
    label: 'Character recovery window (days)',
    help: 'How long a soft-deleted character stays restorable before it is purged (its frozen money becomes an unclaimed box deposit).',
    min: 0,
    max: 365
  },
  {
    key: 'skinChangePrice',
    type: 'number',
    label: 'Skin change price ($)',
    help: 'Cost of a paid character-skin change in the skin shop.',
    min: 0,
    max: 999999999
  },
  {
    key: 'startingMoney',
    type: 'number',
    label: 'Starting money ($)',
    help: 'Wallet money a brand-new account or freshly created character starts with.',
    min: 0,
    max: 999999999
  },
  {
    key: 'allowMultipleBeachBalls',
    type: 'boolean',
    label: 'Allow multiple beach balls per map',
    help: 'Bypasses the one-/pelota-ball-per-map rule: with this on, every /pelota spawns a ball even when the map already has one.'
  }
];

/**
 * Admin "Global Settings" tab: operator-tunable game-wide values stored in
 * Redis (`settings:global`). Values apply live (no redeploy); the server
 * sanitizes and clamps everything, so this panel only edits and re-renders
 * whatever the server confirms back.
 */
export default function GlobalSettingsPanel() {
  const toast = useToast();
  const { socket } = useAuth();
  const [payload, setPayload] = useState<SettingsPayload | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    socket?.emit('admin:settings:get');
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handleData = (data: SettingsPayload) => {
      setPayload(data);
      setDrafts(
        FIELDS.reduce<Record<string, string>>((accumulator, field) => {
          accumulator[field.key] = String(data.settings[field.key]);
          return accumulator;
        }, {})
      );
      setSaving(false);
    };
    socket.on('admin:settings-data', handleData);
    load();
    return () => {
      socket.off('admin:settings-data', handleData);
    };
  }, [socket, load]);

  const dirty =
    payload !== null &&
    FIELDS.some((field) => drafts[field.key] !== String(payload.settings[field.key]));

  const save = () => {
    if (!socket || !payload) {
      return;
    }
    const updates: Partial<GlobalGameSettings> = {};
    for (const field of FIELDS) {
      if (field.type === 'boolean') {
        const value = drafts[field.key] === 'true';
        if (value !== payload.settings[field.key]) {
          (updates as Record<string, boolean>)[field.key] = value;
        }
        continue;
      }
      const parsed = Number(drafts[field.key]);
      if (!Number.isFinite(parsed)) {
        toast({ title: `${field.label}: enter a number.`, status: 'error', duration: 4000 });
        return;
      }
      if (parsed !== payload.settings[field.key]) {
        (updates as Record<string, number>)[field.key] = parsed;
      }
    }
    setSaving(true);
    socket.emit('admin:settings:update', updates);
    toast({ title: 'Saving global settings…', status: 'info', duration: 2000 });
  };

  if (!payload) {
    return (
      <Box p={4}>
        <Text color="gray.600">Loading global settings…</Text>
      </Box>
    );
  }

  return (
    <Stack spacing={4} maxW="640px">
      <Text color="gray.600">
        Game-wide values applied live to every player. Out-of-range values are
        clamped by the server.
      </Text>
      {FIELDS.map((field) => {
        const isDefault = payload.settings[field.key] === payload.defaults[field.key];
        return (
          <Box key={field.key} borderWidth="1px" borderColor="gray.200" borderRadius="md" p={3}>
            <HStack justify="space-between" align="start" mb={1}>
              <Text fontWeight="600">{field.label}</Text>
              {!isDefault ? (
                <Badge colorScheme="purple">custom (default: {String(payload.defaults[field.key])})</Badge>
              ) : (
                <Badge colorScheme="gray">default</Badge>
              )}
            </HStack>
            <Text fontSize="sm" color="gray.600" mb={2}>
              {field.help}
            </Text>
            {field.type === 'boolean' ? (
              <Switch
                isChecked={drafts[field.key] === 'true'}
                onChange={(event) =>
                  setDrafts((previous) => ({
                    ...previous,
                    [field.key]: event.target.checked ? 'true' : 'false'
                  }))
                }
              />
            ) : (
              <Input
                type="number"
                size="sm"
                maxW="200px"
                min={field.min}
                max={field.max}
                value={drafts[field.key] ?? ''}
                onChange={(event) =>
                  setDrafts((previous) => ({ ...previous, [field.key]: event.target.value }))
                }
              />
            )}
          </Box>
        );
      })}
      <HStack>
        <Button colorScheme="green" onClick={save} isDisabled={!dirty} isLoading={saving}>
          Save settings
        </Button>
        <Button variant="outline" onClick={load} isDisabled={saving}>
          Reload
        </Button>
      </HStack>
    </Stack>
  );
}
