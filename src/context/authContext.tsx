import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@chakra-ui/react';
import { io, type Socket } from 'socket.io-client';

export type AuthUser = {
  id: number
  name: string
  username: string
  email: string
  emailVerified: boolean
}

type AuthSessionPayload = {
  authenticated: boolean
  user: AuthUser | null
  token?: string
}

type AuthMessagePayload = {
  message: string
}

type LoginPayload = {
  username: string
  password: string
}

type RegisterPayload = {
  name: string
  username: string
  email: string
  password: string
}

type ResetPasswordPayload = {
  token: string
  password: string
}

type RecoverPasswordPayload = {
  identifier: string
}

type RecoverUsernamePayload = {
  email: string
}

type VerifyEmailPayload = {
  token: string
}

type AuthContextValue = {
  socket: Socket | null
  authReady: boolean
  authenticated: boolean
  user: AuthUser | null
  token: string | null
  errorMessage: string | null
  infoMessage: string | null
  clearMessages: () => void
  login: (payload: LoginPayload) => void
  register: (payload: RegisterPayload) => void
  recoverPassword: (payload: RecoverPasswordPayload) => void
  resetPassword: (payload: ResetPasswordPayload) => void
  recoverUsername: (payload: RecoverUsernamePayload) => void
  verifyEmail: (payload: VerifyEmailPayload) => void
  requestEmailValidation: () => void
  logout: () => void
}

const AUTH_TOKEN_STORAGE_KEY = 'client-poke.io.auth.token';

const AuthContext = createContext<AuthContextValue | null>(null);

let sharedAuthSocket: Socket | null = null;
let sharedAuthSocketUrl: string | null = null;

const getStoredAuthToken = () => window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

const persistAuthToken = (token: string) => {
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
};

const clearStoredAuthToken = () => {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
};

const getSocketAuthToken = (socket: Socket) => {
  const socketAuth = socket.auth as { token?: string } | undefined;

  return typeof socketAuth?.token === 'string' ? socketAuth.token : null;
};

const getSharedAuthSocket = (socketUrl: string) => {
  if (sharedAuthSocket && sharedAuthSocketUrl === socketUrl) {
    return sharedAuthSocket;
  }

  if (sharedAuthSocket) {
    sharedAuthSocket.removeAllListeners();
    sharedAuthSocket.disconnect();
  }

  sharedAuthSocket = io(socketUrl, {
    autoConnect: false,
    transports: ["websocket"]
  });
  sharedAuthSocketUrl = socketUrl;

  return sharedAuthSocket;
};

export const AuthProvider = (
  { children, socketUrl }: { children: ReactNode, socketUrl: string }
) => {
  const toast = useToast();
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => getStoredAuthToken());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const clearMessages = useCallback(() => {
    setErrorMessage(null);
    setInfoMessage(null);
  }, []);

  const syncToken = useCallback((nextToken: string | null) => {
    const socket = socketRef.current;

    setToken(nextToken);

    if (nextToken) {
      persistAuthToken(nextToken);
    } else {
      clearStoredAuthToken();
    }

    if (!socket) {
      return;
    }

    const currentToken = getSocketAuthToken(socket);
    const shouldReconnect = currentToken !== nextToken;

    socket.auth = nextToken ? { token: nextToken } : {};

    if (shouldReconnect && socket.connected) {
      socket.disconnect();
      socket.connect();
    }
  }, []);

  const ensureConnected = useCallback(() => {
    const socket = socketRef.current;

    if (!socket) {
      return;
    }

    const storedToken = getStoredAuthToken();
    socket.auth = storedToken ? { token: storedToken } : {};

    if (!socket.connected) {
      socket.connect();
    }
  }, []);

  const emitAuthEvent = useCallback((
    eventName: string,
    payload?: Record<string, unknown>
  ) => {
    const socket = socketRef.current;

    clearMessages();
    ensureConnected();

    if (!socket) {
      return;
    }

    if (payload) {
      socket.emit(eventName, payload);
      return;
    }

    socket.emit(eventName);
  }, [clearMessages, ensureConnected]);

  const logout = useCallback(() => {
    clearMessages();
    setAuthenticated(false);
    setUser(null);
    setAuthReady(true);
    syncToken(null);

    toast({
      title: 'Logged out.',
      status: 'success',
      duration: 3000,
      isClosable: true,
      position: 'top'
    });
  }, [clearMessages, syncToken, toast]);

  useEffect(() => {
    const socket = getSharedAuthSocket(socketUrl);
    const storedToken = getStoredAuthToken();

    socketRef.current = socket;
    setAuthReady(false);
    setToken(storedToken);
    socket.auth = storedToken ? { token: storedToken } : {};

    const handleConnect = () => {
      socket.emit('auth:session');
    };

    const handleSession = (payload: AuthSessionPayload) => {
      setAuthReady(true);
      setAuthenticated(payload.authenticated);
      setUser(payload.user);
      clearMessages();

      if (payload.authenticated) {
        const nextToken = payload.token ?? getStoredAuthToken();

        if (nextToken) {
          syncToken(nextToken);
        }

        return;
      }

      syncToken(null);
    };

    const handleInfo = ({ message }: AuthMessagePayload) => {
      setErrorMessage(null);
      setInfoMessage(message);
      toast({
        title: message,
        status: 'success',
        duration: 4000,
        isClosable: true,
        position: 'top'
      });
    };

    const handleError = ({ message }: AuthMessagePayload) => {
      setInfoMessage(null);
      setErrorMessage(message);
      toast({
        title: message,
        status: 'error',
        duration: 4000,
        isClosable: true,
        position: 'top'
      });
    };

    socket.on('connect', handleConnect);
    socket.on('auth:session', handleSession);
    socket.on('auth:info', handleInfo);
    socket.on('auth:error', handleError);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('auth:session', handleSession);
      socket.off('auth:info', handleInfo);
      socket.off('auth:error', handleError);
      socket.disconnect();
    };
  }, [clearMessages, socketUrl, syncToken, toast]);

  const value = useMemo<AuthContextValue>(() => ({
    socket: socketRef.current,
    authReady,
    authenticated,
    user,
    token,
    errorMessage,
    infoMessage,
    clearMessages,
    login: (payload) => emitAuthEvent('auth:login', payload),
    register: (payload) => emitAuthEvent('auth:register', payload),
    recoverPassword: (payload) => emitAuthEvent('auth:recover-password', payload),
    resetPassword: (payload) => emitAuthEvent('auth:reset-password', payload),
    recoverUsername: (payload) => emitAuthEvent('auth:recover-username', payload),
    verifyEmail: (payload) => emitAuthEvent('auth:verify-email', payload),
    requestEmailValidation: () => emitAuthEvent('auth:request-email-validation'),
    logout
  }), [
    authReady,
    authenticated,
    clearMessages,
    emitAuthEvent,
    errorMessage,
    infoMessage,
    logout,
    token,
    user
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
};
