import {
  Badge,
  Box,
  Button,
  Center,
  HStack,
  IconButton,
  Input,
  SimpleGrid,
  Spinner,
  Stack,
  Switch,
  Text,
  Tooltip
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import type { AdminEventState } from '../types';

type VariableRow = { key: string; value: string }
type SwitchRow = { key: string; on: boolean }

type EventStateEditorProps = {
  state: AdminEventState | null
  loading: boolean
  /** Bumps when the admin applies; used to re-seed after a save round-trip. */
  onDirty: () => void
  onApply: (next: { switches: Record<string, boolean>; variables: Record<string, number> }) => void
  isSaving: boolean
  applyDisabled: boolean
}

function toVariableRows(state: AdminEventState): VariableRow[] {
  return Object.entries(state.variables)
    .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
    .map(([key, value]) => ({ key, value: String(value) }));
}

function toSwitchRows(state: AdminEventState): SwitchRow[] {
  return Object.entries(state.switches)
    .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
    .map(([key, on]) => ({ key, on: on === true }));
}

export default function EventStateEditor({
  state,
  loading,
  onDirty,
  onApply,
  isSaving,
  applyDisabled
}: EventStateEditorProps) {
  const [variableRows, setVariableRows] = useState<VariableRow[]>([]);
  const [switchRows, setSwitchRows] = useState<SwitchRow[]>([]);
  const dirtyRef = useRef(false);

  // Seed drafts from the server snapshot; a fresh snapshot after an apply
  // replaces the drafts, but typing marks them dirty so background refreshes
  // never clobber unapplied edits.
  useEffect(() => {
    if (!state || dirtyRef.current) {
      return;
    }
    setVariableRows(toVariableRows(state));
    setSwitchRows(toSwitchRows(state));
  }, [state]);

  const markDirty = () => {
    dirtyRef.current = true;
    onDirty();
  };

  const apply = () => {
    const variables: Record<string, number> = {};
    for (const row of variableRows) {
      const key = row.key.trim();
      const value = Number(row.value);
      if (key && Number.isFinite(value)) {
        variables[key] = value;
      }
    }
    const switches: Record<string, boolean> = {};
    for (const row of switchRows) {
      const key = row.key.trim();
      if (key && row.on) {
        switches[key] = true;
      }
    }
    dirtyRef.current = false;
    onApply({ switches, variables });
  };

  if (loading && !state) {
    return (
      <Center py={10}>
        <Spinner color="green.400" />
      </Center>
    );
  }

  const selfSwitchCount = state ? Object.keys(state.selfSwitches).length : 0;

  return (
    <Stack spacing={5}>
      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="800" color="#1f2d22">Game Variables</Text>
          <Button
            size="xs"
            variant="outline"
            colorScheme="green"
            onClick={() => {
              markDirty();
              setVariableRows((rows) => [...rows, { key: '', value: '0' }]);
            }}
          >
            + Add variable
          </Button>
        </HStack>
        {variableRows.length === 0 ? (
          <Text fontSize="sm" color="#8a9782">No game variables set for this trainer.</Text>
        ) : (
          <Stack spacing={2}>
            {variableRows.map((row, index) => (
              <HStack key={index} spacing={2}>
                <Input
                  size="sm"
                  w="140px"
                  placeholder="Variable id"
                  value={row.key}
                  onChange={(event) => {
                    markDirty();
                    setVariableRows((rows) => rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)));
                  }}
                />
                <Input
                  size="sm"
                  flex="1"
                  placeholder="Value"
                  value={row.value}
                  onChange={(event) => {
                    markDirty();
                    setVariableRows((rows) => rows.map((r, i) => (i === index ? { ...r, value: event.target.value } : r)));
                  }}
                />
                <Tooltip label="Remove variable" openDelay={400}>
                  <IconButton
                    aria-label="Remove variable"
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => {
                      markDirty();
                      setVariableRows((rows) => rows.filter((_, i) => i !== index));
                    }}
                  >
                    ✕
                  </IconButton>
                </Tooltip>
              </HStack>
            ))}
          </Stack>
        )}
      </Box>

      <Box>
        <HStack justify="space-between" mb={2}>
          <Text fontWeight="800" color="#1f2d22">Game Switches</Text>
          <Button
            size="xs"
            variant="outline"
            colorScheme="green"
            onClick={() => {
              markDirty();
              setSwitchRows((rows) => [...rows, { key: '', on: true }]);
            }}
          >
            + Add switch
          </Button>
        </HStack>
        {switchRows.length === 0 ? (
          <Text fontSize="sm" color="#8a9782">No switches are on for this trainer.</Text>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2}>
            {switchRows.map((row, index) => (
              <HStack key={index} spacing={2}>
                <Input
                  size="sm"
                  flex="1"
                  placeholder="Switch id"
                  value={row.key}
                  onChange={(event) => {
                    markDirty();
                    setSwitchRows((rows) => rows.map((r, i) => (i === index ? { ...r, key: event.target.value } : r)));
                  }}
                />
                <Switch
                  colorScheme="green"
                  isChecked={row.on}
                  onChange={(event) => {
                    markDirty();
                    setSwitchRows((rows) => rows.map((r, i) => (i === index ? { ...r, on: event.target.checked } : r)));
                  }}
                />
                <Tooltip label="Remove switch" openDelay={400}>
                  <IconButton
                    aria-label="Remove switch"
                    size="sm"
                    variant="ghost"
                    colorScheme="red"
                    onClick={() => {
                      markDirty();
                      setSwitchRows((rows) => rows.filter((_, i) => i !== index));
                    }}
                  >
                    ✕
                  </IconButton>
                </Tooltip>
              </HStack>
            ))}
          </SimpleGrid>
        )}
        <Text fontSize="xs" color="#9aa694" mt={2}>
          Switches that are off are simply removed from the list. Applying replaces the trainer's
          variables and switches with what you see here.
        </Text>
      </Box>

      {selfSwitchCount > 0 ? (
        <HStack spacing={2}>
          <Badge colorScheme="gray" borderRadius="full">{selfSwitchCount} event self-switch{selfSwitchCount === 1 ? '' : 'es'}</Badge>
          <Text fontSize="xs" color="#9aa694">Self-switches are event internals and are not editable here.</Text>
        </HStack>
      ) : null}

      <HStack justify="flex-end" pt={2}>
        <Button colorScheme="green" onClick={apply} isLoading={isSaving} isDisabled={applyDisabled}>
          Apply
        </Button>
      </HStack>
    </Stack>
  );
}
