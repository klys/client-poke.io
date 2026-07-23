import {
  Center,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalOverlay,
  Spinner
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  AdminCatalogPayload,
  AdminEventState,
  AdminUserDetails,
  AdminUserStorage,
  AdminUserSummary
} from '../types';
import UserEditor, { type UserUpdatePayload } from './UserEditor';
import UserList from './UserList';

type UsersSectionProps = {
  socket: Socket | null
}

type UserListPayload = {
  users: AdminUserSummary[]
  search: string
  page: number
  pageSize: number
  total: number
  totalPages: number
}

const PAGE_SIZE = 10;

const EMPTY_CATALOG: AdminCatalogPayload = { items: [], pokemons: [], maps: [] };

export default function UsersSection({ socket }: UsersSectionProps) {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');

  const [selectedUser, setSelectedUser] = useState<AdminUserDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [catalog, setCatalog] = useState<AdminCatalogPayload>(EMPTY_CATALOG);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(() => new Set());

  const [isSaving, setIsSaving] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [eventState, setEventState] = useState<AdminEventState | null>(null);
  const [eventStateLoading, setEventStateLoading] = useState(false);
  const [isSavingEventState, setIsSavingEventState] = useState(false);
  const [storage, setStorage] = useState<AdminUserStorage | null>(null);
  const [storageLoading, setStorageLoading] = useState(false);

  const currentPageRef = useRef(1);
  const currentSearchRef = useRef('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emitListLoad = useCallback((nextPage: number, nextSearch: string, withLoader: boolean) => {
    if (!socket) {
      return;
    }
    currentPageRef.current = nextPage;
    currentSearchRef.current = nextSearch;
    if (withLoader) {
      setListLoading(true);
    }
    socket.emit('admin:users:list', { page: nextPage, pageSize: PAGE_SIZE, search: nextSearch });
  }, [socket]);

  // Subscriptions + initial load. Presence stays live until the section unmounts.
  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleUsers = (payload: UserListPayload) => {
      setUsers(payload.users);
      setPage(payload.page);
      setTotal(payload.total);
      setTotalPages(payload.totalPages);
      currentPageRef.current = payload.page;
      setListLoading(false);
    };

    const handleUserDetails = ({ user }: { user: AdminUserDetails | null }) => {
      setSelectedUser(user);
      setDetailLoading(false);
      setIsSaving(false);
      // Counts (party/inventory) may have changed — refresh the list quietly.
      emitListLoad(currentPageRef.current, currentSearchRef.current, false);
    };

    const handleUserDeleted = ({ userId }: { userId: number }) => {
      setIsDeleting(false);
      setSelectedUser((current) => (current && current.id === userId ? null : current));
      setOnlineUserIds((current) => {
        if (!current.has(userId)) {
          return current;
        }
        const next = new Set(current);
        next.delete(userId);
        return next;
      });
      emitListLoad(currentPageRef.current, currentSearchRef.current, true);
    };

    const handleCatalog = (payload: AdminCatalogPayload) => {
      setCatalog(payload);
    };

    const handlePresence = ({ onlineUserIds: ids }: { onlineUserIds: number[] }) => {
      setOnlineUserIds(new Set(ids));
    };

    const handleEventState = (payload: AdminEventState & { userId: number }) => {
      setEventState({
        switches: payload.switches ?? {},
        variables: payload.variables ?? {},
        selfSwitches: payload.selfSwitches ?? {}
      });
      setEventStateLoading(false);
      setIsSavingEventState(false);
    };

    const handleStorage = (payload: AdminUserStorage & { userId: number }) => {
      setStorage({ boxes: payload.boxes ?? [], profile: payload.profile });
      setStorageLoading(false);
    };

    const handleAdminError = () => {
      // AdminPage surfaces the toast; here we only clear busy state.
      setIsSaving(false);
      setIsSettingPassword(false);
      setIsSendingRecovery(false);
      setIsDeleting(false);
      setIsDisconnecting(false);
      setDetailLoading(false);
      setEventStateLoading(false);
      setIsSavingEventState(false);
      setStorageLoading(false);
    };

    const handleAuthInfo = () => {
      // Success feedback is toasted globally; just release the action buttons.
      setIsSettingPassword(false);
      setIsSendingRecovery(false);
      setIsDisconnecting(false);
    };

    // Requests in flight when the socket drops are lost; without this the
    // panel would sit on stale data (or a stuck spinner) after a reconnect.
    const handleReconnect = () => {
      emitListLoad(currentPageRef.current, currentSearchRef.current, true);
      socket.emit('admin:catalog:get');
      socket.emit('admin:presence:subscribe');
    };

    const handleDisconnect = () => {
      setIsSaving(false);
      setIsSettingPassword(false);
      setIsSendingRecovery(false);
      setIsDeleting(false);
      setIsDisconnecting(false);
      setDetailLoading(false);
      setEventStateLoading(false);
      setIsSavingEventState(false);
      setStorageLoading(false);
    };

    socket.on('admin:users:list', handleUsers);
    socket.on('admin:user:details', handleUserDetails);
    socket.on('admin:user:deleted', handleUserDeleted);
    socket.on('admin:user:event-state', handleEventState);
    socket.on('admin:user:storage', handleStorage);
    socket.on('admin:catalog', handleCatalog);
    socket.on('admin:presence:state', handlePresence);
    socket.on('admin:error', handleAdminError);
    socket.on('auth:info', handleAuthInfo);
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    emitListLoad(1, '', true);
    socket.emit('admin:catalog:get');
    socket.emit('admin:presence:subscribe');

    return () => {
      socket.off('admin:users:list', handleUsers);
      socket.off('admin:user:details', handleUserDetails);
      socket.off('admin:user:deleted', handleUserDeleted);
      socket.off('admin:user:event-state', handleEventState);
      socket.off('admin:user:storage', handleStorage);
      socket.off('admin:catalog', handleCatalog);
      socket.off('admin:presence:state', handlePresence);
      socket.off('admin:error', handleAdminError);
      socket.off('auth:info', handleAuthInfo);
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
      socket.emit('admin:presence:unsubscribe');
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [socket, emitListLoad]);

  // Debounced live search as the admin types.
  const onSearchInputChange = useCallback((value: string) => {
    setSearchInput(value);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      emitListLoad(1, value.trim(), true);
    }, 350);
  }, [emitListLoad]);

  const onSubmitSearch = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    emitListLoad(1, searchInput.trim(), true);
  }, [emitListLoad, searchInput]);

  const openUser = useCallback((userId: number) => {
    if (!socket) {
      return;
    }
    setDetailLoading(true);
    // Per-user side panels reload lazily for the newly opened user.
    setEventState(null);
    setStorage(null);
    socket.emit('admin:user:get', { userId });
  }, [socket]);

  const goToPage = useCallback((nextPage: number) => {
    emitListLoad(Math.max(1, Math.min(totalPages, nextPage)), currentSearchRef.current, true);
  }, [emitListLoad, totalPages]);

  const saveUser = useCallback((updates: UserUpdatePayload) => {
    if (!socket || !selectedUser) {
      return;
    }
    setIsSaving(true);
    socket.emit('admin:user:update', { userId: selectedUser.id, updates });
  }, [socket, selectedUser]);

  const resetProgress = useCallback(() => {
    if (!socket || !selectedUser) {
      return;
    }
    socket.emit('admin:user:reset-progress', { userId: selectedUser.id });
  }, [socket, selectedUser]);

  const setPassword = useCallback((newPassword: string) => {
    if (!socket || !selectedUser) {
      return;
    }
    setIsSettingPassword(true);
    socket.emit('admin:user:set-password', { userId: selectedUser.id, newPassword });
  }, [socket, selectedUser]);

  const sendRecovery = useCallback(() => {
    if (!socket || !selectedUser) {
      return;
    }
    setIsSendingRecovery(true);
    socket.emit('admin:user:send-recovery', { userId: selectedUser.id });
  }, [socket, selectedUser]);

  const deleteUser = useCallback(() => {
    if (!socket || !selectedUser) {
      return;
    }
    setIsDeleting(true);
    socket.emit('admin:user:delete', { userId: selectedUser.id });
  }, [socket, selectedUser]);

  const disconnectUser = useCallback(() => {
    if (!socket || !selectedUser) {
      return;
    }
    setIsDisconnecting(true);
    socket.emit('admin:user:disconnect', { userId: selectedUser.id });
  }, [socket, selectedUser]);

  const loadEventState = useCallback(() => {
    if (!socket || !selectedUser) {
      return;
    }
    setEventStateLoading(true);
    socket.emit('admin:user:event-state:get', { userId: selectedUser.id });
  }, [socket, selectedUser]);

  const saveEventState = useCallback((next: { switches: Record<string, boolean>; variables: Record<string, number> }) => {
    if (!socket || !selectedUser) {
      return;
    }
    setIsSavingEventState(true);
    socket.emit('admin:user:event-state:update', { userId: selectedUser.id, ...next });
  }, [socket, selectedUser]);

  const loadStorage = useCallback(() => {
    if (!socket || !selectedUser) {
      return;
    }
    setStorageLoading(true);
    socket.emit('admin:user:storage:get', { userId: selectedUser.id });
  }, [socket, selectedUser]);

  const closeEditor = useCallback(() => {
    setSelectedUser(null);
    setDetailLoading(false);
  }, []);

  const onlineCount = onlineUserIds.size;
  const selectedOnline = selectedUser ? onlineUserIds.has(selectedUser.id) : false;
  const isEditorOpen = detailLoading || selectedUser !== null;

  const editorPanel = useMemo(() => {
    if (detailLoading) {
      return (
        <Center py={16}>
          <Spinner color="green.400" size="lg" thickness="3px" />
        </Center>
      );
    }

    if (!selectedUser) {
      return null;
    }

    return (
      <UserEditor
        user={selectedUser}
        catalog={catalog}
        online={selectedOnline}
        isSaving={isSaving}
        isSettingPassword={isSettingPassword}
        isSendingRecovery={isSendingRecovery}
        isDeleting={isDeleting}
        isDisconnecting={isDisconnecting}
        eventState={eventState}
        eventStateLoading={eventStateLoading}
        isSavingEventState={isSavingEventState}
        storage={storage}
        storageLoading={storageLoading}
        onSave={saveUser}
        onResetProgress={resetProgress}
        onSetPassword={setPassword}
        onSendRecovery={sendRecovery}
        onDeleteUser={deleteUser}
        onDisconnect={disconnectUser}
        onLoadEventState={loadEventState}
        onSaveEventState={saveEventState}
        onLoadStorage={loadStorage}
      />
    );
  }, [
    detailLoading,
    selectedUser,
    catalog,
    selectedOnline,
    isSaving,
    isSettingPassword,
    isSendingRecovery,
    isDeleting,
    isDisconnecting,
    eventState,
    eventStateLoading,
    isSavingEventState,
    storage,
    storageLoading,
    saveUser,
    resetProgress,
    setPassword,
    sendRecovery,
    deleteUser,
    disconnectUser,
    loadEventState,
    saveEventState,
    loadStorage
  ]);

  return (
    <>
      <UserList
        users={users}
        loading={listLoading}
        page={page}
        totalPages={totalPages}
        total={total}
        onlineUserIds={onlineUserIds}
        onlineCount={onlineCount}
        selectedUserId={selectedUser?.id ?? null}
        searchInput={searchInput}
        onSearchInputChange={onSearchInputChange}
        onSubmitSearch={onSubmitSearch}
        onSelect={openUser}
        onPrev={() => goToPage(page - 1)}
        onNext={() => goToPage(page + 1)}
      />

      <Modal isOpen={isEditorOpen} onClose={closeEditor} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent borderRadius="28px" my={{ base: 4, lg: 10 }}>
          <ModalCloseButton top={4} right={4} />
          <ModalBody p={{ base: 5, lg: 6 }}>
            {editorPanel}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
