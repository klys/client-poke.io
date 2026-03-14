import {
  Button,
  FormControl,
  FormLabel,
  Input,
  Link,
  Stack
} from '@chakra-ui/react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import AuthAlerts from './AuthAlerts';
import AuthShell from './AuthShell';
import { validateRequired } from './validation';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { authenticated, clearMessages, errorMessage, infoMessage, login } = useAuth();

  useEffect(() => {
    clearMessages();
    setValidationError(null);
  }, [clearMessages]);

  const handleSubmit = (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();

    const usernameError = validateRequired('Username', username);
    const passwordError = validateRequired('Password', password);

    clearMessages();

    if (usernameError || passwordError) {
      setValidationError(usernameError ?? passwordError);
      return;
    }

    setValidationError(null);
    login({
      username: username.trim(),
      password
    });
  };

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell
      title="Welcome Back"
      description="Sign in to jump back into the game."
    >
      <Stack as="form" spacing={4} onSubmit={handleSubmit} noValidate>
        <AuthAlerts
          errorMessage={validationError ?? errorMessage}
          infoMessage={infoMessage}
        />

        <FormControl isRequired>
          <FormLabel htmlFor="username">Username</FormLabel>
          <Input
            id="username"
            name="username"
            placeholder="Username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </FormControl>

        <FormControl isRequired>
          <FormLabel htmlFor="password">Password</FormLabel>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormControl>

        <Stack spacing={3} pt={2}>
          <Button colorScheme="teal" type="submit" size="lg" width="full">
            Log In
          </Button>
          <Button
            as={RouterLink}
            to="/new-user"
            colorScheme="red"
            variant="outline"
            size="lg"
            width="full"
          >
            New Player
          </Button>
        </Stack>

        <Stack
          direction={{ base: 'column', sm: 'row' }}
          justify="space-between"
          spacing={2}
          pt={2}
        >
          <Link as={RouterLink} to="/recover-password" color="teal.600">
            Forgot password?
          </Link>
          <Link as={RouterLink} to="/recover-username" color="teal.600">
            Forgot username?
          </Link>
        </Stack>
      </Stack>
    </AuthShell>
  );
};

export default Login;
