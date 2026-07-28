/**
 * Trade state hub.
 *
 * Mirrors the SocialContext pattern: this provider owns every `trade:*`
 * listener on the shared game socket, and the UI components below it only read
 * this context and call its action helpers.
 *
 * The client is strictly a renderer here:
 *   - it never mutates offers locally (it emits an intent and waits for
 *     `trade:state` / `trade:offer:changed`),
 *   - it never decides whether an asset is tradeable,
 *   - it never generates snapshots or system chat messages,
 *   - it never marks a trade complete on its own.
 *
 * Every action carries the version the client last saw plus a fresh
 * idempotency key, and the matching `trade:result` releases the pending flag
 * so controls stay disabled while a request is in flight.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { AppContext } from '../../../../context/appContext';
import { useAuth } from '../../../../context/authContext';
import { getActiveLanguage, translate } from '../../../../i18n';
import type {
  TradeActionResult,
  TradeChatMessage,
  TradeHistoryPage,
  TradeOutcome,
  TradeRequestNotice,
  TradeStatePayload
} from './tradeTypes';

const MAX_TRADE_MESSAGES = 200;

export interface TradeApi {
  /** Authoritative trade state, or null when not in a trade. */
  trade: TradeStatePayload | null;
  messages: TradeChatMessage[];
  /** Incoming trade requests awaiting an accept/decline. */
  requests: TradeRequestNotice[];
  /** Set when the trade window should be visible. */
  windowOpen: boolean;
  /** Last terminal result, for the outcome banner. */
  outcome: TradeOutcome | null;
  /** Last error the server rejected an action with. */
  lastError: string | null;
  /** True while an action is awaiting its `trade:result`. */
  pending: boolean;
  history: TradeHistoryPage | null;
  historyLoading: boolean;

  requestTrade: (target: { targetPlayerId?: string; targetUserId?: number }) => void;
  acceptRequest: (tradeId: string) => void;
  declineRequest: (tradeId: string) => void;
  cancelRequest: (tradeId: string) => void;

  addItem: (itemId: string, quantity: number) => void;
  updateItem: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  addVenomon: (venomonId: string) => void;
  removeVenomon: (venomonId: string) => void;
  setCurrency: (amount: number) => void;

  lockOffer: () => void;
  unlockOffer: () => void;
  confirmTrade: () => void;
  cancelTrade: () => void;

  sendChat: (text: string) => void;
  syncTrade: () => void;
  loadHistory: (page?: number) => void;
  reportTrade: (tradeId: string, reason: string, explanation?: string) => void;

  dismissOutcome: () => void;
  clearError: () => void;
  closeWindow: () => void;
}

export const TradeContext = createContext<TradeApi | null>(null);

export function useTrade(): TradeApi {
  const api = useContext(TradeContext);
  if (!api) {
    throw new Error('useTrade must be used inside <TradeProvider>');
  }
  return api;
}

let requestSequence = 0;
/** Idempotency key: unique per user action, so retries collapse server-side. */
function nextRequestId() {
  requestSequence += 1;
  return `${Date.now().toString(36)}-${requestSequence.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function TradeProvider({ children }: { children: ReactNode }) {
  const { socket, myplayer } = useContext(AppContext);
  const { user } = useAuth();
  const myUserId: number | null = typeof user?.id === 'number' ? user.id : null;

  const [trade, setTrade] = useState<TradeStatePayload | null>(null);
  const [messages, setMessages] = useState<TradeChatMessage[]>([]);
  const [requests, setRequests] = useState<TradeRequestNotice[]>([]);
  const [windowOpen, setWindowOpen] = useState(false);
  const [outcome, setOutcome] = useState<TradeOutcome | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [history, setHistory] = useState<TradeHistoryPage | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // The version every outgoing action is stamped with. Held in a ref so
  // handlers built once still stamp the latest value.
  const versionRef = useRef<number>(0);
  const tradeIdRef = useRef<string | null>(null);
  const snapshotHashRef = useRef<string | null>(null);

  useEffect(() => {
    versionRef.current = trade?.version ?? 0;
    tradeIdRef.current = trade?.tradeId ?? null;
    snapshotHashRef.current = trade?.snapshotHash ?? null;
  }, [trade]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const applyState = (data: TradeStatePayload | null) => {
      setTrade(data);
      if (data) {
        setWindowOpen(true);
        // A brand-new session starts with a clean chat log; `trade:sync`
        // replays history for reconnects.
        setMessages((current) => (current.length > 0 && current[0].tradeId === data.tradeId ? current : []));
      }
    };

    const handleState = (data: TradeStatePayload | null) => applyState(data);

    const handleOpened = (data: TradeStatePayload) => {
      setMessages([]);
      setOutcome(null);
      setLastError(null);
      applyState(data);
    };

    const handleRequestReceived = (data: TradeRequestNotice) => {
      setRequests((current) =>
        current.some((entry) => entry.tradeId === data.tradeId) ? current : [...current, data]
      );
    };

    const handleRequestExpired = (data: { tradeId: string }) => {
      setRequests((current) => current.filter((entry) => entry.tradeId !== data.tradeId));
    };

    const handleChat = (data: TradeChatMessage) => {
      setMessages((current) => {
        if (current.some((entry) => entry.id === data.id)) {
          return current;
        }
        return [...current, data].slice(-MAX_TRADE_MESSAGES);
      });
    };

    const handleCompleted = (data: any) => {
      setTrade(null);
      setOutcome({
        tradeId: data?.tradeId ?? '',
        kind: 'completed',
        message: translate('trade.outcomeCompleted', getActiveLanguage()),
        given: data?.given,
        received: data?.received
      });
      setWindowOpen(true);
    };

    const handleCancelled = (data: any) => {
      setTrade(null);
      setRequests((current) => current.filter((entry) => entry.tradeId !== data?.tradeId));
      setOutcome({
        tradeId: data?.tradeId ?? '',
        kind: 'cancelled',
        message: String(data?.reason ?? translate('trade.outcomeCancelled', getActiveLanguage()))
      });
    };

    const handleFailed = (data: any) => {
      setTrade(null);
      setOutcome({
        tradeId: data?.tradeId ?? '',
        kind: 'failed',
        message: String(data?.message ?? translate('trade.outcomeFailed', getActiveLanguage()))
      });
      setWindowOpen(true);
    };

    const handleResult = (data: TradeActionResult) => {
      setPending(false);
      if (!data?.success && data?.message) {
        setLastError(data.message);
      } else if (data?.success) {
        setLastError(null);
      }
    };

    const handleHistory = (data: TradeHistoryPage) => {
      setHistory(data);
      setHistoryLoading(false);
    };

    const handleParticipantPresence = () => {
      // The authoritative flags ride along on trade:state; nothing to do here
      // beyond letting the state update re-render the banner.
    };

    socket.on('trade:state', handleState);
    socket.on('trade:opened', handleOpened);
    socket.on('trade:offer:changed', handleState);
    socket.on('trade:offer:invalidated', handleState);
    socket.on('trade:confirmation:started', handleState);
    socket.on('trade:request:received', handleRequestReceived);
    socket.on('trade:request:expired', handleRequestExpired);
    socket.on('trade:chat:message', handleChat);
    socket.on('trade:completed', handleCompleted);
    socket.on('trade:cancelled', handleCancelled);
    socket.on('trade:failed', handleFailed);
    socket.on('trade:result', handleResult);
    socket.on('trade:history', handleHistory);
    socket.on('trade:participant:disconnected', handleParticipantPresence);
    socket.on('trade:participant:reconnected', handleParticipantPresence);

    return () => {
      socket.off('trade:state', handleState);
      socket.off('trade:opened', handleOpened);
      socket.off('trade:offer:changed', handleState);
      socket.off('trade:offer:invalidated', handleState);
      socket.off('trade:confirmation:started', handleState);
      socket.off('trade:request:received', handleRequestReceived);
      socket.off('trade:request:expired', handleRequestExpired);
      socket.off('trade:chat:message', handleChat);
      socket.off('trade:completed', handleCompleted);
      socket.off('trade:cancelled', handleCancelled);
      socket.off('trade:failed', handleFailed);
      socket.off('trade:result', handleResult);
      socket.off('trade:history', handleHistory);
      socket.off('trade:participant:disconnected', handleParticipantPresence);
      socket.off('trade:participant:reconnected', handleParticipantPresence);
    };
  }, [socket]);

  // On (re)entering the world, ask for the authoritative trade state rather
  // than trusting anything cached from before the disconnect.
  useEffect(() => {
    if (!socket || myUserId === null || !myplayer) {
      return;
    }
    socket.emit('trade:sync', {});
  }, [socket, myUserId, myplayer]);

  const emit = useCallback(
    (event: string, payload?: unknown) => {
      if (!socket) {
        return;
      }
      setPending(true);
      socket.emit(event, payload);
    },
    [socket]
  );

  /** Stamps an action with the trade id, last-seen version and a fresh key. */
  const envelope = useCallback(
    (extra: Record<string, unknown> = {}) => ({
      tradeId: tradeIdRef.current ?? '',
      expectedVersion: versionRef.current,
      requestId: nextRequestId(),
      ...extra
    }),
    []
  );

  const api: TradeApi = useMemo(
    () => ({
      trade,
      messages,
      requests,
      windowOpen,
      outcome,
      lastError,
      pending,
      history,
      historyLoading,

      requestTrade: (target) => emit('trade:request', target),
      acceptRequest: (tradeId) => {
        setRequests((current) => current.filter((entry) => entry.tradeId !== tradeId));
        emit('trade:request:accept', { tradeId });
      },
      declineRequest: (tradeId) => {
        setRequests((current) => current.filter((entry) => entry.tradeId !== tradeId));
        emit('trade:request:decline', { tradeId });
      },
      cancelRequest: (tradeId) => emit('trade:request:cancel', { tradeId }),

      addItem: (itemId, quantity) => emit('trade:offer:add-item', envelope({ itemId, quantity })),
      updateItem: (itemId, quantity) => emit('trade:offer:update-item', envelope({ itemId, quantity })),
      removeItem: (itemId) => emit('trade:offer:remove-item', envelope({ itemId })),
      addVenomon: (venomonId) => emit('trade:offer:add-venomon', envelope({ venomonId })),
      removeVenomon: (venomonId) => emit('trade:offer:remove-venomon', envelope({ venomonId })),
      setCurrency: (amount) => emit('trade:offer:set-currency', envelope({ amount })),

      lockOffer: () => emit('trade:offer:lock', envelope()),
      unlockOffer: () => emit('trade:offer:unlock', envelope()),
      confirmTrade: () =>
        emit('trade:confirm', envelope({ snapshotHash: snapshotHashRef.current ?? '' })),
      cancelTrade: () => emit('trade:cancel', { tradeId: tradeIdRef.current ?? '', requestId: nextRequestId() }),

      sendChat: (text) =>
        emit('trade:chat:send', {
          tradeId: tradeIdRef.current ?? '',
          text,
          requestId: nextRequestId()
        }),
      syncTrade: () => emit('trade:sync', { tradeId: tradeIdRef.current ?? undefined }),
      loadHistory: (page = 1) => {
        setHistoryLoading(true);
        socket?.emit('trade:history', { page, pageSize: 10 });
      },
      reportTrade: (tradeId, reason, explanation) =>
        emit('trade:report', { tradeId, reason, explanation }),

      dismissOutcome: () => setOutcome(null),
      clearError: () => setLastError(null),
      closeWindow: () => {
        setWindowOpen(false);
        setOutcome(null);
      }
    }),
    [trade, messages, requests, windowOpen, outcome, lastError, pending, history, historyLoading, emit, envelope, socket]
  );

  return <TradeContext.Provider value={api}>{children}</TradeContext.Provider>;
}
