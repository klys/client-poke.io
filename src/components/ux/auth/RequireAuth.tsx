import { Center, Spinner, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';

type RequireAuthProps = {
  children: ReactNode
}

const RequireAuth = ({ children }: RequireAuthProps) => {
  const { authReady, authenticated } = useAuth();

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

  return <>{children}</>;
};

export default RequireAuth;
