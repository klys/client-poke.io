import { Button, Link, Stack, Text } from '@chakra-ui/react';
import { useEffect } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../context/authContext';
import AuthAlerts from './AuthAlerts';
import AuthShell from './AuthShell';

const ValidateEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const {
    authenticated,
    clearMessages,
    errorMessage,
    infoMessage,
    requestEmailValidation,
    user,
    verifyEmail
  } = useAuth();

  useEffect(() => {
    clearMessages();

    if (!token) {
      return;
    }

    verifyEmail({ token });
  }, [clearMessages, token, verifyEmail]);

  const handleResendValidation = () => {
    clearMessages();
    requestEmailValidation();
  };

  const successMessage = user?.emailVerified ? 'Your email is already verified.' : null;

  return (
    <AuthShell
      title="Validate Email"
      description="Use this screen to confirm your email address or request a new validation email."
    >
      <Stack spacing={4}>
        <AuthAlerts
          errorMessage={errorMessage}
          infoMessage={infoMessage}
          successMessage={successMessage}
        />

        {!token && (
          <Text color="gray.600">
            Open this page using the validation link from your email, or request a new validation email below.
          </Text>
        )}

        {authenticated && (
          <Button colorScheme="teal" onClick={handleResendValidation}>
            Resend validation email
          </Button>
        )}

        {!authenticated && (
          <Text color="gray.600">
            Log in first if you need us to resend the validation email.
          </Text>
        )}

        <Link as={RouterLink} to="/login" color="teal.600" textAlign="center">
          Back to login
        </Link>
      </Stack>
    </AuthShell>
  );
};

export default ValidateEmail;
