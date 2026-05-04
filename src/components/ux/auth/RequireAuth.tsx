import { Center, Spinner, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  getDefaultAuthorizedPath,
  type RolePermission,
  useAuth
} from '../../../context/authContext';

type RequireAuthProps = {
  children?: ReactNode
  requiredPermission?: RolePermission
}

const RequireAuth = ({ children, requiredPermission }: RequireAuthProps) => {
  const { authReady, authenticated, hasPermission, user } = useAuth();

  if (!authReady) {
    return (
      <Center minH="100vh" flexDirection="column" gap={4}>
        <Spinner size="xl" color="teal.500" />
        <Text color="gray.600">Checking your session...</Text>
      </Center>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to={getDefaultAuthorizedPath(user)} replace />;
  }

  return <>{children}</>;
};

export default RequireAuth;
