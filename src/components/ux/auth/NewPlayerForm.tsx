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
import { validateEmail, validateName, validatePassword, validateUsername } from './validation';

const NewPlayerForm = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { authenticated, clearMessages, errorMessage, infoMessage, register } = useAuth();

  useEffect(() => {
    clearMessages();
    setValidationError(null);
  }, [clearMessages]);

  const handleSubmit = (event: FormEvent<HTMLDivElement>) => {
    event.preventDefault();

    const nameError = validateName(name);
    const usernameError = validateUsername(username);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    clearMessages();

    if (nameError || usernameError || emailError || passwordError) {
      setValidationError(nameError ?? usernameError ?? emailError ?? passwordError);
      return;
    }

    setValidationError(null);
    register({
      name: name.trim(),
      username: username.trim(),
      email: email.trim(),
      password
    });
  };

  if (authenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthShell
      title="Create New Player"
      description="Set up your account with valid player details."
    >
      <Stack as="form" spacing={4} onSubmit={handleSubmit} noValidate>
        <AuthAlerts
          errorMessage={validationError ?? errorMessage}
          infoMessage={infoMessage}
        />

        <FormControl isRequired>
          <FormLabel htmlFor="name">Name</FormLabel>
          <Input
            id="name"
            name="name"
            placeholder="Your name"
            title="Use only letters and spaces, between 2 and 30 characters."
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <FormHelperText>Letters only, 2 to 30 characters.</FormHelperText>
        </FormControl>

        <FormControl isRequired>
          <FormLabel htmlFor="username">Username</FormLabel>
          <Input
            id="username"
            name="username"
            placeholder="Username"
            title="Use only letters and numbers, between 4 and 30 characters."
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
          <FormHelperText>Alphanumeric only, 4 to 30 characters.</FormHelperText>
        </FormControl>

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
          <FormHelperText>Enter a valid email address.</FormHelperText>
        </FormControl>

        <FormControl isRequired>
          <FormLabel htmlFor="password">Password</FormLabel>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="Create a password"
            autoComplete="new-password"
            title="Use 8 to 150 characters with at least one uppercase letter, one lowercase letter, one number, and one symbol."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <FormHelperText>
            8 to 150 characters, with uppercase, lowercase, number, and symbol.
          </FormHelperText>
        </FormControl>

        <Stack spacing={3} pt={2}>
          <Button colorScheme="teal" type="submit" size="lg" width="full">
            Create Player
          </Button>
          <Link as={RouterLink} to="/login" color="teal.600" textAlign="center">
            Back to login
          </Link>
        </Stack>
      </Stack>
    </AuthShell>
  );
};

export default NewPlayerForm;
