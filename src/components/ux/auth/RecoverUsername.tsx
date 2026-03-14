import {
  Button,
  FormControl,
  FormHelperText,
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
import { validateEmail } from './validation';

const RecoverUsername = () => {
  const [email, setEmail] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { authenticated, clearMessages, errorMessage, infoMessage, recoverUsername } = useAuth();

  useEffect(() => {
    clearMessages();
    setValidationError(null);
  }, [clearMessages]);

  const handleSubmit = (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();

    const emailError = validateEmail(email);

    clearMessages();

    if (emailError) {
      setValidationError(emailError);
      return;
    }

    setValidationError(null);
    recoverUsername({
      email: email.trim()
    });
  };

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell
      title="Recover Username"
      description="Enter your email and we will help you find your username."
    >
      <Stack as="form" spacing={4} onSubmit={handleSubmit} noValidate>
        <AuthAlerts
          errorMessage={validationError ?? errorMessage}
          infoMessage={infoMessage}
        />

        <FormControl isRequired>
          <FormLabel htmlFor="email">Email</FormLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <FormHelperText>Enter the email connected to your player account.</FormHelperText>
        </FormControl>

        <Stack spacing={3} pt={2}>
          <Button colorScheme="teal" type="submit" size="lg" width="full">
            Recover Username
          </Button>
          <Link as={RouterLink} to="/login" color="teal.600" textAlign="center">
            Back to login
          </Link>
        </Stack>
      </Stack>
    </AuthShell>
  );
};

export default RecoverUsername;
