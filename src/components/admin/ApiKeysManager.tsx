import {
  Badge,
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Code,
  FormControl,
  FormLabel,
  HStack,
  Input,
  SimpleGrid,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useClipboard,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/authContext';
import type { ApiKeyScope, ApiKeySummary, CreatedApiKey } from './types';

const SCOPE_OPTIONS: Array<{ value: ApiKeyScope; label: string; hint: string }> = [
  { value: 'read', label: 'Read', hint: 'GET data endpoints' },
  { value: 'write', label: 'Write', hint: 'Uploads & mutations' },
  { value: 'admin', label: 'Admin', hint: 'Manage API keys' }
];

const STATUS_COLOR: Record<ApiKeySummary['status'], string> = {
  active: 'green',
  revoked: 'red',
  disabled: 'gray',
  expired: 'orange'
};

function formatDate(value: string | null) {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

/** One-time reveal panel for a freshly created key's plaintext secret. */
function RevealedKey({ created, onDismiss }: { created: CreatedApiKey; onDismiss: () => void }) {
  const { hasCopied, onCopy } = useClipboard(created.key);

  return (
    <Box borderRadius="20px" bg="#fff8e6" border="1px solid #f0d67a" p={5}>
      <Stack spacing={3}>
        <Text fontWeight="800" color="#7a5b12">
          Copy this key now — it is shown only once.
        </Text>
        <Text fontSize="sm" color="#8a6d24">
          “{created.meta.name}” ({created.meta.scopes.join(', ')}). Store it in the consuming
          service’s secret config; it cannot be retrieved again after you leave this page.
        </Text>
        <HStack>
          <Code p={3} borderRadius="12px" fontSize="sm" wordBreak="break-all" flex="1" bg="white">
            {created.key}
          </Code>
          <Button colorScheme="yellow" onClick={onCopy} minW="90px">
            {hasCopied ? 'Copied' : 'Copy'}
          </Button>
        </HStack>
        <Button alignSelf="flex-start" variant="ghost" onClick={onDismiss}>
          I’ve stored it safely
        </Button>
      </Stack>
    </Box>
  );
}

export default function ApiKeysManager() {
  const toast = useToast();
  const { socket } = useAuth();
  const [keys, setKeys] = useState<ApiKeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiKeyScope[]>(['read']);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revealed, setRevealed] = useState<CreatedApiKey | null>(null);

  const loadKeys = useCallback(() => {
    socket?.emit('admin:apikeys:list');
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleList = (payload: { keys: ApiKeySummary[] }) => {
      setKeys(payload.keys);
      setLoading(false);
      setIsCreating(false);
      setRevokingId(null);
    };

    const handleCreated = (payload: CreatedApiKey) => {
      setRevealed(payload);
      setName('');
      setScopes(['read']);
      setExpiresInDays('');
    };

    const handleError = ({ message }: { message: string }) => {
      setLoading(false);
      setIsCreating(false);
      setRevokingId(null);
      toast({ title: message, status: 'error', duration: 4000, isClosable: true, position: 'top' });
    };

    socket.on('admin:apikeys:list', handleList);
    socket.on('admin:apikeys:created', handleCreated);
    socket.on('admin:error', handleError);
    loadKeys();

    return () => {
      socket.off('admin:apikeys:list', handleList);
      socket.off('admin:apikeys:created', handleCreated);
      socket.off('admin:error', handleError);
    };
  }, [socket, toast, loadKeys]);

  const canCreate = useMemo(() => name.trim().length > 0 && scopes.length > 0, [name, scopes]);

  const createKey = () => {
    if (!canCreate) {
      return;
    }
    const trimmedDays = expiresInDays.trim();
    let days: number | undefined;
    if (trimmedDays) {
      const parsed = Number(trimmedDays);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast({ title: 'Expiry (days) must be a positive number.', status: 'error', duration: 4000, isClosable: true, position: 'top' });
        return;
      }
      days = Math.floor(parsed);
    }
    setIsCreating(true);
    socket?.emit('admin:apikeys:create', { name: name.trim(), scopes, expiresInDays: days });
  };

  const revokeKey = (key: ApiKeySummary) => {
    if (key.status === 'revoked') {
      return;
    }
    if (!window.confirm(`Revoke “${key.name}” (pck_${key.keyPrefix}…)? Any service using it will immediately lose access.`)) {
      return;
    }
    setRevokingId(key.id);
    socket?.emit('admin:apikeys:revoke', { id: key.id });
  };

  return (
    <Stack spacing={6}>
      <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
        <Stack spacing={5}>
          <Box>
            <Text fontSize="2xl" fontWeight="800" color="#1f2d22">Create API Key</Text>
            <Text color="#68776b">
              Keys authenticate services (e.g. the game server, migration tool) to the pokecraft-api.
              Grant the least scope needed — access is hierarchical (admin ⊃ write ⊃ read).
            </Text>
          </Box>

          {revealed ? (
            <RevealedKey created={revealed} onDismiss={() => setRevealed(null)} />
          ) : null}

          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel>Name</FormLabel>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. server-poke.io (read)"
                bg="#f5f7f2"
              />
            </FormControl>
            <FormControl>
              <FormLabel>Expires In (days, optional)</FormLabel>
              <Input
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                placeholder="never"
                bg="#f5f7f2"
              />
            </FormControl>
          </SimpleGrid>

          <FormControl>
            <FormLabel>Scopes</FormLabel>
            <CheckboxGroup
              value={scopes}
              onChange={(next) => setScopes(next as ApiKeyScope[])}
            >
              <HStack spacing={6} flexWrap="wrap">
                {SCOPE_OPTIONS.map((option) => (
                  <Checkbox key={option.value} value={option.value} colorScheme="green">
                    <Text as="span" fontWeight="700">{option.label}</Text>
                    <Text as="span" color="#809083" fontSize="sm">&nbsp;— {option.hint}</Text>
                  </Checkbox>
                ))}
              </HStack>
            </CheckboxGroup>
          </FormControl>

          <Button
            alignSelf="flex-start"
            colorScheme="green"
            onClick={createKey}
            isLoading={isCreating}
            isDisabled={!canCreate}
          >
            Generate Key
          </Button>
        </Stack>
      </Box>

      <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
        <Stack spacing={4}>
          <HStack justify="space-between" flexWrap="wrap" spacing={4}>
            <Box>
              <Text fontSize="2xl" fontWeight="800" color="#1f2d22">Existing Keys</Text>
              <Text color="#68776b">Only the prefix is stored — the full secret is never recoverable.</Text>
            </Box>
            <Button variant="outline" colorScheme="green" onClick={loadKeys} isLoading={loading}>
              Refresh
            </Button>
          </HStack>

          <Box overflowX="auto">
            <Table size="sm">
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Prefix</Th>
                  <Th>Scopes</Th>
                  <Th>Status</Th>
                  <Th>Created By</Th>
                  <Th>Last Used</Th>
                  <Th>Expires</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {keys.map((key) => (
                  <Tr key={key.id}>
                    <Td fontWeight="700">{key.name}</Td>
                    <Td><Code fontSize="xs">pck_{key.keyPrefix}…</Code></Td>
                    <Td>
                      <HStack spacing={1}>
                        {key.scopes.map((scope) => (
                          <Badge key={scope} colorScheme={scope === 'admin' ? 'red' : scope === 'write' ? 'orange' : 'green'}>
                            {scope}
                          </Badge>
                        ))}
                      </HStack>
                    </Td>
                    <Td><Badge colorScheme={STATUS_COLOR[key.status]}>{key.status}</Badge></Td>
                    <Td fontSize="xs" color="#69776b">{key.createdBy ?? '—'}</Td>
                    <Td fontSize="xs" color="#69776b">{formatDate(key.lastUsedAt)}</Td>
                    <Td fontSize="xs" color="#69776b">{formatDate(key.expiresAt)}</Td>
                    <Td>
                      <Button
                        size="xs"
                        colorScheme="red"
                        variant="outline"
                        onClick={() => revokeKey(key)}
                        isDisabled={key.status === 'revoked'}
                        isLoading={revokingId === key.id}
                      >
                        Revoke
                      </Button>
                    </Td>
                  </Tr>
                ))}
                {!loading && keys.length === 0 ? (
                  <Tr>
                    <Td colSpan={8}>
                      <Text color="#69776b" py={4} textAlign="center">No API keys yet. Create one above.</Text>
                    </Td>
                  </Tr>
                ) : null}
              </Tbody>
            </Table>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
