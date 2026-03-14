import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Link,
  Stack,
  Text
} from '@chakra-ui/react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import AuthAlerts from './AuthAlerts';
import AuthShell from './AuthShell';
import { validatePassword, validateRequired } from './validation';

const RecoverPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const {
    authenticated,
    clearMessages,
    errorMessage,
    infoMessage,
    recoverPassword,
    resetPassword
  } = useAuth();
  const isResetMode = token.length > 0;

  useEffect(() => {
    clearMessages();
    setValidationError(null);
  }, [clearMessages, isResetMode]);

  const handleSubmit = (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();
    clearMessages();

    if (isResetMode) {
      const passwordError = validatePassword(password);

      if (passwordError) {
        setValidationError(passwordError);
        return;
      }

      setValidationError(null);
      resetPassword({
        token,
        password
      });
      return;
    }

    const identifierError = validateRequired('Username or email', identifier);

    if (identifierError) {
      setValidationError(identifierError);
      return;
    }

    setValidationError(null);
    recoverPassword({
      identifier: identifier.trim()
    });
  };

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell
      title="Recover Password"
      description={isResetMode
        ? 'Choose a new password for your account.'
        : 'Enter your username or email and we will help you recover access.'}
    >
      <Stack as="form" spacing={4} onSubmit={handleSubmit} noValidate>
        <AuthAlerts
          errorMessage={validationError ?? errorMessage}
          infoMessage={infoMessage}
        />

        {isResetMode ? (
          <FormControl isRequired>
            <FormLabel htmlFor="password">New Password</FormLabel>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="Create a new password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <FormHelperText>
              Use 8 to 150 characters with uppercase, lowercase, number, and symbol.
            </FormHelperText>
          </FormControl>
        ) : (
          <FormControl isRequired>
            <FormLabel htmlFor="identifier">Username or Email</FormLabel>
            <Input
              id="identifier"
              name="identifier"
              placeholder="Username or email"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
            <FormHelperText>Use the username or email tied to your account.</FormHelperText>
          </FormControl>
        )}

        {isResetMode && (
          <Text color="gray.600">
            This reset request came from the secure token in your recovery link.
          </Text>
        )}

        <Stack spacing={3} pt={2}>
          <Button colorScheme="teal" type="submit" size="lg" width="full">
            {isResetMode ? 'Reset Password' : 'Recover Password'}
          </Button>
          <Link as={RouterLink} to="/login" color="teal.600" textAlign="center">
            Back to login
          </Link>
        </Stack>
      </Stack>
    </AuthShell>
  );
};

export default RecoverPassword;
