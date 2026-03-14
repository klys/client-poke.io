import { Alert, AlertDescription, AlertIcon, Stack } from '@chakra-ui/react';

type AuthAlertsProps = {
  errorMessage?: string | null
  infoMessage?: string | null
  successMessage?: string | null
}

const AuthAlerts = ({ errorMessage, infoMessage, successMessage }: AuthAlertsProps) => {
  if (!errorMessage && !infoMessage && !successMessage) {
    return null;
  }

  return (
    <Stack spacing={3}>
      {errorMessage && (
        <Alert status="error" borderRadius="md">
          <AlertIcon />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {successMessage && (
        <Alert status="success" borderRadius="md">
          <AlertIcon />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      {!successMessage && infoMessage && (
        <Alert status="success" borderRadius="md">
          <AlertIcon />
          <AlertDescription>{infoMessage}</AlertDescription>
        </Alert>
      )}
    </Stack>
  );
};

export default AuthAlerts;
