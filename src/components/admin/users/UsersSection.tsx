import { Box, Center, Grid, Spinner, Stack, Text } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  AdminCatalogPayload,
  AdminUserDetails,
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

    const handleAdminError = () => {
      // AdminPage surfaces the toast; here we only clear busy state.
      setIsSaving(false);
      setIsSettingPassword(false);
      setIsSendingRecovery(false);
      setIsDeleting(false);
      setDetailLoading(false);
    };

    const handleAuthInfo = () => {
      // Success feedback is toasted globally; just release the action buttons.
      setIsSettingPassword(false);
      setIsSendingRecovery(false);
    };

    socket.on('admin:users:list', handleUsers);
    socket.on('admin:user:details', handleUserDetails);
    socket.on('admin:user:deleted', handleUserDeleted);
    socket.on('admin:catalog', handleCatalog);
    socket.on('admin:presence:state', handlePresence);
    socket.on('admin:error', handleAdminError);
    socket.on('auth:info', handleAuthInfo);

    emitListLoad(1, '', true);
    socket.emit('admin:catalog:get');
    socket.emit('admin:presence:subscribe');

    return () => {
      socket.off('admin:users:list', handleUsers);
      socket.off('admin:user:details', handleUserDetails);
      socket.off('admin:user:deleted', handleUserDeleted);
      socket.off('admin:catalog', handleCatalog);
      socket.off('admin:presence:state', handlePresence);
      socket.off('admin:error', handleAdminError);
      socket.off('auth:info', handleAuthInfo);
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

  const onlineCount = onlineUserIds.size;
  const selectedOnline = selectedUser ? onlineUserIds.has(selectedUser.id) : false;

  const editorPanel = useMemo(() => {
    if (detailLoading) {
      return (
        <Center py={16}>
          <Spinner color="green.400" size="lg" thickness="3px" />
        </Center>
      );
    }

    if (!selectedUser) {
      return (
        <Stack spacing={3}>
          <Text fontSize="xl" fontWeight="800" color="#1f2d22">User editor</Text>
          <Text color="#657367">
            Choose a user from the list to edit roles, inventory, party, saved map position, and account security.
          </Text>
        </Stack>
      );
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
        onSave={saveUser}
        onResetProgress={resetProgress}
        onSetPassword={setPassword}
        onSendRecovery={sendRecovery}
        onDeleteUser={deleteUser}
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
    saveUser,
    resetProgress,
    setPassword,
    sendRecovery,
    deleteUser
  ]);

  return (
    <Grid templateColumns={{ base: '1fr', xl: '1.15fr 0.85fr' }} gap={6} alignItems="start">
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

      <Box
        borderRadius="28px"
        bg="white"
        p={{ base: 5, lg: 6 }}
        boxShadow="0 20px 48px rgba(47, 69, 52, 0.10)"
        position={{ xl: 'sticky' }}
        top={{ xl: 4 }}
        maxH={{ xl: 'calc(100vh - 32px)' }}
        overflowY={{ xl: 'auto' }}
      >
        {editorPanel}
      </Box>
    </Grid>
  );
}
