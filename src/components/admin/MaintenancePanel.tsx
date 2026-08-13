import {
  Badge,
  Box,
  Button,
  Checkbox,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  Textarea,
  useToast
} from '@chakra-ui/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/authContext';
import { getBackendBaseUrl } from '../game/backendConfig';

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
  hasReport: boolean;
  dataSource: {
    source: 'uploaded' | 'bundled';
    uploadedAt?: string;
    uploadedBy?: string;
    mapCount?: number;
  } | null;
};

type ReportMeta = {
  actionName: string;
  at: string;
  ok: boolean;
  dryRun: boolean;
  exitCode: number | null;
  by: string;
};

const RESET_ALL_ACTION_ID = 'reset-all-adventures';
const REPAIR_ACTION_ID = 'repair-essentials-events';

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be unavailable (non-secure origins) — fall back to a
    // hidden textarea + execCommand copy.
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

/**
 * Admin "Maintenance" tab: runs the server's whitelisted repair/diagnostic
 * tools without SSH access. Output streams live into an on-page console that
 * can be copied, downloaded, opened as an HTML report, or emailed. Also hosts
 * the rxdata zip upload for the event repair, the everyone-back-to-zero
 * adventure reset, and the global message broadcast.
 */
export default function MaintenancePanel() {
  const toast = useToast();
  const { socket, user, token } = useAuth();
  const [actions, setActions] = useState<MaintenanceAction[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [dryRunById, setDryRunById] = useState<Record<string, boolean>>({});
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logActionId, setLogActionId] = useState<string | null>(null);
  const logBoxRef = useRef<HTMLDivElement | null>(null);

  // Email send bar (console header + report modal share it).
  const [emailTarget, setEmailTarget] = useState('');
  const [emailFormOpenFor, setEmailFormOpenFor] = useState<string | null>(null);
  const [emailSendingFor, setEmailSendingFor] = useState<string | null>(null);

  // HTML report modal.
  const [reportActionId, setReportActionId] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportMeta, setReportMeta] = useState<ReportMeta | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // rxdata zip upload (repair-essentials-events card).
  const [uploadingZip, setUploadingZip] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  // Global message card.
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

  const loadActions = useCallback(() => {
    socket?.emit('admin:maintenance:list');
  }, [socket]);

  useEffect(() => {
    if (user?.email) {
      setEmailTarget((current) => current || user.email);
    }
  }, [user?.email]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleList = ({
      actions: next,
      running,
      emailEnabled: nextEmailEnabled
    }: {
      actions: MaintenanceAction[];
      running: string | null;
      emailEnabled?: boolean;
    }) => {
      setActions(next);
      setRunningId(running);
      setEmailEnabled(nextEmailEnabled === true);
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
      setLogLines((current) => [...current.slice(-1999), line]);
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

    const handleReport = ({
      id,
      available,
      html,
      meta
    }: {
      id: string;
      available: boolean;
      html: string | null;
      meta: ReportMeta | null;
    }) => {
      setReportLoading(false);
      if (!available || !html) {
        setReportActionId(null);
        toast({
          title: 'No stored report for this action yet — run it first.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
          position: 'top'
        });
        return;
      }
      setReportActionId(id);
      setReportHtml(html);
      setReportMeta(meta);
    };

    const handleEmailResult = ({ ok, to, message }: { id: string; ok: boolean; to: string; message: string }) => {
      setEmailSendingFor(null);
      if (ok) {
        setEmailFormOpenFor(null);
      }
      toast({
        title: ok ? `Report sent to ${to}.` : 'Unable to send the report.',
        description: ok ? undefined : message,
        status: ok ? 'success' : 'error',
        duration: 7000,
        isClosable: true,
        position: 'top'
      });
    };

    const handleBroadcastResult = ({ ok, message }: { ok: boolean; recipients: number; message: string }) => {
      setBroadcastSending(false);
      if (ok) {
        setBroadcastText('');
      }
      toast({
        title: message,
        status: ok ? 'success' : 'error',
        duration: 6000,
        isClosable: true,
        position: 'top'
      });
    };

    socket.on('admin:maintenance:list', handleList);
    socket.on('admin:maintenance:log', handleLog);
    socket.on('admin:maintenance:done', handleDone);
    socket.on('admin:maintenance:report', handleReport);
    socket.on('admin:maintenance:email-result', handleEmailResult);
    socket.on('admin:maintenance:broadcast-result', handleBroadcastResult);
    socket.on('connect', loadActions);

    return () => {
      socket.off('admin:maintenance:list', handleList);
      socket.off('admin:maintenance:log', handleLog);
      socket.off('admin:maintenance:done', handleDone);
      socket.off('admin:maintenance:report', handleReport);
      socket.off('admin:maintenance:email-result', handleEmailResult);
      socket.off('admin:maintenance:broadcast-result', handleBroadcastResult);
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
      if (action.id === RESET_ALL_ACTION_ID) {
        // Resetting every single player deserves more friction than confirm().
        const typed = window.prompt(
          'This will erase EVERY player\'s adventure progress (party, items, money, badges, position). ' +
            'Type RESET to confirm.'
        );
        if (typed !== 'RESET') {
          return;
        }
      } else {
        const confirmed = window.confirm(
          `"${action.name}" will modify live game data for every player. Run it for real?`
        );
        if (!confirmed) {
          return;
        }
      }
    }
    setLogLines([]);
    setLogActionId(action.id);
    setRunningId(action.id);
    socket?.emit('admin:maintenance:run', { id: action.id, dryRun });
  };

  const openReport = (actionId: string) => {
    setReportLoading(true);
    setReportHtml(null);
    setReportMeta(null);
    setReportActionId(actionId);
    socket?.emit('admin:maintenance:report', { id: actionId });
  };

  const sendReportEmail = (actionId: string) => {
    const to = emailTarget.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      toast({ title: 'Enter a valid destination email address.', status: 'warning', duration: 4000, position: 'top' });
      return;
    }
    setEmailSendingFor(actionId);
    socket?.emit('admin:maintenance:email-report', { id: actionId, to });
  };

  const copyConsole = async () => {
    const copied = await copyTextToClipboard(logLines.join('\n'));
    toast({
      title: copied ? 'Console output copied to the clipboard.' : 'Unable to copy — select the text manually.',
      status: copied ? 'success' : 'warning',
      duration: 3000,
      isClosable: true,
      position: 'top'
    });
  };

  const uploadRxdataZip = async (file: File) => {
    setUploadErrors([]);
    setUploadingZip(true);
    try {
      const response = await fetch(`${getBackendBaseUrl()}/admin/maintenance/rxdata-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/zip',
          'X-File-Name': encodeURIComponent(file.name)
        },
        body: file
      });
      const payload = (await response.json()) as
        | { ok: true; mapCount: number; warnings: string[] }
        | { ok: false; errors: string[] };
      if (payload.ok) {
        toast({
          title: `Zip validated — ${payload.mapCount} maps staged for the event repair.`,
          description: payload.warnings.length > 0 ? `${payload.warnings.length} warning(s) — see the card below.` : undefined,
          status: 'success',
          duration: 7000,
          isClosable: true,
          position: 'top'
        });
        setUploadErrors(payload.warnings.map((warning) => `Warning: ${warning}`));
        loadActions();
      } else {
        setUploadErrors(payload.errors);
        toast({ title: 'The zip failed validation — nothing was staged.', status: 'error', duration: 6000, isClosable: true, position: 'top' });
      }
    } catch (error) {
      setUploadErrors([`Upload failed: ${(error as Error).message}`]);
      toast({ title: 'Upload failed.', status: 'error', duration: 6000, isClosable: true, position: 'top' });
    } finally {
      setUploadingZip(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  };

  const clearRxdataUpload = () => {
    if (!window.confirm('Remove the uploaded rxdata data? The event repair will use the bundled dump again.')) {
      return;
    }
    setUploadErrors([]);
    socket?.emit('admin:maintenance:rxdata-clear');
  };

  const sendBroadcast = () => {
    const message = broadcastText.trim();
    if (!message) {
      return;
    }
    if (!window.confirm(`Send this message to every online player?\n\n"${message}"`)) {
      return;
    }
    setBroadcastSending(true);
    socket?.emit('admin:maintenance:broadcast', { message });
  };

  const emailBar = (actionId: string) => (
    <HStack spacing={2}>
      <Input
        size="sm"
        width="260px"
        bg="white"
        value={emailTarget}
        onChange={(event) => setEmailTarget(event.target.value)}
        placeholder="destination@email.com"
        type="email"
      />
      <Button
        size="sm"
        colorScheme="green"
        onClick={() => sendReportEmail(actionId)}
        isLoading={emailSendingFor === actionId}
        loadingText="Sending…"
        isDisabled={!emailEnabled}
      >
        Send
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEmailFormOpenFor(null)}>
        Cancel
      </Button>
    </HStack>
  );

  const reportAction = actions.find((action) => action.id === reportActionId);

  return (
    <Stack spacing={5}>
      <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
        <HStack justify="space-between" flexWrap="wrap" spacing={4}>
          <Box>
            <Text fontSize="2xl" fontWeight="800" color="#1f2d22">Maintenance</Text>
            <Text color="#68776b">
              Run the server repair and diagnostic tools directly from here — no console access needed.
              One action runs at a time. Every run&apos;s output can be reopened as an HTML report or sent by email.
            </Text>
            {!emailEnabled ? (
              <Text color="#b04a3a" fontSize="sm">
                Email delivery is disabled on this server (SMTP is not configured) — report emailing is unavailable.
              </Text>
            ) : null}
          </Box>
          <Button colorScheme="green" variant="outline" onClick={loadActions}>Refresh</Button>
        </HStack>
      </Box>

      <Box borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
        <Stack spacing={3}>
          <HStack spacing={3}>
            <Text fontSize="xl" fontWeight="800" color="#1f2d22">Send Global Message</Text>
            <Badge colorScheme="purple">online players</Badge>
          </HStack>
          <Text color="#68776b" maxW="720px">
            Broadcasts a chat message to every player currently online (the same channel as the moderator
            <b> /global</b> command). Players who are offline will not see it.
          </Text>
          <Textarea
            value={broadcastText}
            onChange={(event) => setBroadcastText(event.target.value)}
            placeholder="Escribe el mensaje para todos los jugadores conectados…"
            maxLength={500}
            rows={3}
            bg="white"
          />
          <HStack justify="space-between">
            <Text fontSize="sm" color="#8a958c">{broadcastText.trim().length}/500</Text>
            <Button
              colorScheme="purple"
              onClick={sendBroadcast}
              isLoading={broadcastSending}
              loadingText="Sending…"
              isDisabled={broadcastText.trim().length === 0}
            >
              Send to everyone online
            </Button>
          </HStack>
        </Stack>
      </Box>

      {actions.map((action) => {
        const isRunning = runningId === action.id;
        const anotherRunning = runningId !== null && !isRunning;
        const dryRun = dryRunById[action.id] ?? false;
        const isRepair = action.id === REPAIR_ACTION_ID;

        return (
          <Box key={action.id} borderRadius="28px" bg="white" p={{ base: 5, lg: 6 }} boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)">
            <Stack spacing={3}>
              <HStack justify="space-between" align="flex-start" flexWrap="wrap" spacing={4}>
                <Box>
                  <HStack spacing={3} flexWrap="wrap">
                    <Text fontSize="xl" fontWeight="800" color="#1f2d22">{action.name}</Text>
                    <Badge colorScheme={action.dangerous ? 'orange' : 'blue'}>
                      {action.dangerous ? 'writes data' : 'read-only'}
                    </Badge>
                    {action.id === RESET_ALL_ACTION_ID ? <Badge colorScheme="red">affects every player</Badge> : null}
                    {!action.available ? <Badge colorScheme="red">unavailable</Badge> : null}
                  </HStack>
                  <Text color="#68776b" maxW="720px">{action.description}</Text>
                  {action.unavailableReason ? (
                    <Text color="#b04a3a" fontSize="sm">{action.unavailableReason}</Text>
                  ) : null}

                  {isRepair ? (
                    <Stack spacing={2} mt={3} p={3} borderRadius="12px" bg="#f3f7f3">
                      <HStack spacing={2} flexWrap="wrap">
                        <Text fontSize="sm" fontWeight="700" color="#1f2d22">rxdata data source:</Text>
                        {action.dataSource ? (
                          <Badge colorScheme={action.dataSource.source === 'uploaded' ? 'green' : 'gray'}>
                            {action.dataSource.source === 'uploaded' ? 'uploaded zip' : 'bundled dump'}
                          </Badge>
                        ) : (
                          <Badge colorScheme="red">missing</Badge>
                        )}
                        {action.dataSource?.source === 'uploaded' ? (
                          <Text fontSize="sm" color="#68776b">
                            {action.dataSource.mapCount ?? '?'} maps
                            {action.dataSource.uploadedBy ? ` · ${action.dataSource.uploadedBy}` : ''}
                            {action.dataSource.uploadedAt ? ` · ${formatDate(action.dataSource.uploadedAt)}` : ''}
                          </Text>
                        ) : null}
                      </HStack>
                      <HStack spacing={2}>
                        <input
                          ref={uploadInputRef}
                          type="file"
                          accept=".zip,application/zip"
                          style={{ display: 'none' }}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) {
                              void uploadRxdataZip(file);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          colorScheme="green"
                          variant="outline"
                          onClick={() => uploadInputRef.current?.click()}
                          isLoading={uploadingZip}
                          loadingText="Uploading…"
                          isDisabled={isRunning || anotherRunning}
                        >
                          Upload rxdata zip…
                        </Button>
                        {action.dataSource?.source === 'uploaded' ? (
                          <Button
                            size="sm"
                            colorScheme="red"
                            variant="ghost"
                            onClick={clearRxdataUpload}
                            isDisabled={uploadingZip || isRunning || anotherRunning}
                          >
                            Remove upload
                          </Button>
                        ) : null}
                      </HStack>
                      <Text fontSize="xs" color="#8a958c">
                        The zip must contain maps/Map###.json and data/System.json (a wrapping folder is fine).
                        It is validated before being staged; the repair only runs when you press Run.
                      </Text>
                      {uploadErrors.length > 0 ? (
                        <Stack spacing={0}>
                          {uploadErrors.slice(0, 12).map((error, index) => (
                            <Text key={index} fontSize="sm" color={error.startsWith('Warning:') ? '#a07d1f' : '#b04a3a'}>
                              {error}
                            </Text>
                          ))}
                          {uploadErrors.length > 12 ? (
                            <Text fontSize="sm" color="#b04a3a">…and {uploadErrors.length - 12} more.</Text>
                          ) : null}
                        </Stack>
                      ) : null}
                    </Stack>
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
                  <HStack spacing={2}>
                    {action.hasReport ? (
                      <Button size="sm" variant="outline" colorScheme="blue" onClick={() => openReport(action.id)}>
                        Last report
                      </Button>
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
                  </HStack>
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
            <HStack justify="space-between" flexWrap="wrap" spacing={2}>
              <Text fontWeight="700" color="#9fc9a6">Output — {logActionId}</Text>
              <HStack spacing={2} flexWrap="wrap">
                <Button size="xs" variant="outline" colorScheme="green" onClick={() => void copyConsole()}>
                  Copy
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  colorScheme="green"
                  onClick={() => downloadTextFile(`${logActionId}-output.txt`, logLines.join('\n'), 'text/plain')}
                >
                  Download .txt
                </Button>
                <Button size="xs" variant="outline" colorScheme="blue" onClick={() => openReport(logActionId)}>
                  HTML report
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  colorScheme="purple"
                  onClick={() => setEmailFormOpenFor(emailFormOpenFor === logActionId ? null : logActionId)}
                  isDisabled={!emailEnabled}
                  title={emailEnabled ? undefined : 'SMTP is not configured on this server.'}
                >
                  Email report…
                </Button>
                <Button size="xs" variant="outline" colorScheme="green" onClick={() => { setLogLines([]); setLogActionId(null); setEmailFormOpenFor(null); }}>
                  Clear
                </Button>
              </HStack>
            </HStack>
            {emailFormOpenFor === logActionId ? (
              <Box p={2} borderRadius="10px" bg="#1b241c">
                <HStack spacing={2} flexWrap="wrap">
                  <Text fontSize="sm" color="#9fc9a6">
                    Emails the stored report of this action&apos;s last finished run.
                  </Text>
                  {emailBar(logActionId)}
                </HStack>
              </Box>
            ) : null}
            <Box
              ref={logBoxRef}
              maxH="420px"
              overflowY="auto"
              fontFamily="mono"
              fontSize="sm"
              color="#d7e8d9"
              whiteSpace="pre-wrap"
              sx={{ userSelect: 'text', wordBreak: 'break-word' }}
            >
              {logLines.length > 0 ? logLines.join('\n') : 'Waiting for output…'}
            </Box>
          </Stack>
        </Box>
      ) : null}

      <Modal
        isOpen={reportActionId !== null}
        onClose={() => { setReportActionId(null); setReportHtml(null); setReportMeta(null); setEmailFormOpenFor(null); }}
        size="6xl"
        scrollBehavior="inside"
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {reportAction?.name ?? reportMeta?.actionName ?? 'Maintenance report'}
            {reportMeta ? (
              <Text fontSize="sm" fontWeight="400" color={reportMeta.ok ? '#4a7a52' : '#b04a3a'}>
                {reportMeta.ok ? 'Succeeded' : 'Failed'}{reportMeta.dryRun ? ' (dry run)' : ''} · {formatDate(reportMeta.at)} · {reportMeta.by}
              </Text>
            ) : null}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody p={0}>
            {reportLoading || !reportHtml ? (
              <Text p={6} color="#68776b">Loading the report…</Text>
            ) : (
              <iframe
                title="Maintenance report"
                srcDoc={reportHtml}
                sandbox=""
                style={{ width: '100%', height: '65vh', border: 'none', background: '#f0f4f0' }}
              />
            )}
          </ModalBody>
          <ModalFooter justifyContent="space-between" flexWrap="wrap" gap={2}>
            <HStack spacing={2}>
              <Button
                size="sm"
                variant="outline"
                colorScheme="green"
                isDisabled={!reportHtml}
                onClick={() => reportHtml && reportActionId && downloadTextFile(`${reportActionId}-report.html`, reportHtml, 'text/html')}
              >
                Download .html
              </Button>
            </HStack>
            {reportActionId && emailFormOpenFor === `modal:${reportActionId}` ? (
              emailBar(reportActionId)
            ) : (
              <Button
                size="sm"
                colorScheme="purple"
                isDisabled={!emailEnabled || !reportHtml}
                title={emailEnabled ? undefined : 'SMTP is not configured on this server.'}
                onClick={() => reportActionId && setEmailFormOpenFor(`modal:${reportActionId}`)}
              >
                Email this report…
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Stack>
  );
}
