import {
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  Stack,
  Text,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/authContext';

type MaintenanceAction = {
  id: string;
  name: string;
  description: string;
  dangerous: boolean;
  supportsDryRun: boolean;
  available: boolean;
  unavailableReason: string | null;
  lastRun: {
    at: string;
    ok: boolean;
    dryRun: boolean;
    exitCode: number | null;
    summary: string;
    by: string;
  } | null;
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

/**
 * Admin "Maintenance" tab: runs the server's whitelisted repair/diagnostic
 * tools (event repair, ball reset, terrain tags, migration report) without
 * SSH access — output streams live into the panel.
 */
export default function MaintenancePanel() {
  const toast = useToast();
  const { socket } = useAuth();
  const [actions, setActions] = useState<MaintenanceAction[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [dryRunById, setDryRunById] = useState<Record<string, boolean>>({});
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logActionId, setLogActionId] = useState<string | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  const loadActions = useCallback(() => {
    socket?.emit('admin:maintenance:list');
  }, [socket]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleList = ({ actions: next, running }: { actions: MaintenanceAction[]; running: string | null }) => {
      setActions(next);
      setRunningId(running);
      setDryRunById((current) => {
        const draft = { ...current };
        for (const action of next) {
          // Dangerous actions default to a dry run so the first click is safe.
          if (!(action.id in draft)) {
            draft[action.id] = action.supportsDryRun && action.dangerous;
          }
        }
        return draft;
      });
    };

    const handleLog = ({ id, line }: { id: string; line: string }) => {
      setLogActionId(id);
      setLogLines((current) => [...current.slice(-499), line]);
    };

    const handleDone = ({ id, ok, exitCode }: { id: string; ok: boolean; exitCode: number | null }) => {
      setRunningId(null);
      toast({
        title: ok ? 'Maintenance action finished.' : `Maintenance action failed (exit ${exitCode ?? '?'}).`,
        description: id,
        status: ok ? 'success' : 'error',
        duration: 6000,
        isClosable: true,
        position: 'top'
      });
    };

    socket.on('admin:maintenance:list', handleList);
    socket.on('admin:maintenance:log', handleLog);
    socket.on('admin:maintenance:done', handleDone);
    socket.on('connect', loadActions);

    return () => {
      socket.off('admin:maintenance:list', handleList);
      socket.off('admin:maintenance:log', handleLog);
      socket.off('admin:maintenance:done', handleDone);
      socket.off('connect', loadActions);
    };
  }, [socket, toast, loadActions]);

  useEffect(() => {
    loadActions();
  }, [loadActions]);

  useEffect(() => {
    logBoxRef.current?.scrollTo({ top: logBoxRef.current.scrollHeight });
  }, [logLines]);

  const runAction = (action: MaintenanceAction) => {
    const dryRun = action.supportsDryRun && (dryRunById[action.id] ?? false);
    if (action.dangerous && !dryRun) {
      const confirmed = window.confirm(
        `"${action.name}" will modify live game data for every player. Run it for real?`
      );
      if (!confirmed) {
        return;
      }
    }
    setLogLines([]);
    setLogActionId(action.id);
    setRunningId(action.id);
    socket?.emit('admin:maintenance:run', { id: action.id, dryRun });
  };

  return (
    <Stack spacing={5}>
      <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
        <HStack justify="space-between" flexWrap="wrap" spacing={4}>
          <Box>
            <Text fontSize="2xl" fontWeight="800" color="#1f2d22">Maintenance</Text>
            <Text color="#68776b">
              Run the server repair and diagnostic tools directly from here — no console access needed.
              One action runs at a time.
            </Text>
          </Box>
          <Button colorScheme="green" variant="outline" onClick={loadActions}>Refresh</Button>
        </HStack>
      </Box>

      {actions.map((action) => {
        const isRunning = runningId === action.id;
        const anotherRunning = runningId !== null && !isRunning;
        const dryRun = dryRunById[action.id] ?? false;

        return (
          <Box key={action.id} borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
            <Stack spacing={3}>
              <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={4}>
                <Box>
                  <HStack spacing={3}>
                    <Text fontSize="xl" fontWeight="800" color="#1f2d22">{action.name}</Text>
                    <Badge colorScheme={action.dangerous ? 'orange' : 'blue'}>
                      {action.dangerous ? 'writes data' : 'read-only'}
                    </Badge>
                    {!action.available ? <Badge colorScheme="red">unavailable</Badge> : null}
                  </HStack>
                  <Text color="#68776b" maxW="720px">{action.description}</Text>
                  {action.unavailableReason ? (
                    <Text color="#b04a3a" fontSize="sm">{action.unavailableReason}</Text>
                  ) : null}
                </Box>

                <Stack spacing={2} align="flex-end">
                  {action.supportsDryRun ? (
                    <Checkbox
                      isChecked={dryRun}
                      onChange={(event) => setDryRunById((current) => ({
                        ...current,
                        [action.id]: event.target.checked
                      }))}
                      isDisabled={isRunning || anotherRunning}
                    >
                      Dry run (preview only)
                    </Checkbox>
                  ) : null}
                  <Button
                    colorScheme={action.dangerous && !dryRun ? 'orange' : 'green'}
                    onClick={() => runAction(action)}
                    isLoading={isRunning}
                    loadingText="Running…"
                    isDisabled={!action.available || anotherRunning}
                  >
                    {action.supportsDryRun && dryRun ? 'Preview' : 'Run'}
                  </Button>
                </Stack>
              </HStack>

              {action.lastRun ? (
                <Text fontSize="sm" color={action.lastRun.ok ? '#4a7a52' : '#b04a3a'}>
                  Last {action.lastRun.dryRun ? 'preview' : 'run'} {action.lastRun.ok ? 'succeeded' : 'failed'} · {formatDate(action.lastRun.at)} · {action.lastRun.by}
                  {action.lastRun.summary ? ` — ${action.lastRun.summary}` : ''}
                </Text>
              ) : (
                <Text fontSize="sm" color="#8a958c">Never run on this server.</Text>
              )}
            </Stack>
          </Box>
        );
      })}

      {logActionId ? (
        <Box borderRadius="28px" bg="#101712" p={{ base: 4, lg: 5 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
          <Stack spacing={3}>
            <HStack justify="space-between">
              <Text fontWeight="700" color="#9fc9a6">Output — {logActionId}</Text>
              <Button size="xs" variant="outline" colorScheme="green" onClick={() => { setLogLines([]); setLogActionId(null); }}>
                Clear
              </Button>
            </HStack>
            <Box
              ref={logBoxRef}
              maxH="360px"
              overflowY="auto"
              fontFamily="mono"
              fontSize="sm"
              color="#d7e8d9"
              whiteSpace="pre-wrap"
            >
              {logLines.length > 0 ? logLines.join('\n') : 'Waiting for output…'}
            </Box>
          </Stack>
        </Box>
      ) : null}
    </Stack>
  );
}
