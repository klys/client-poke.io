import {
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Stack,
  Text
} from '@chakra-ui/react';
import { useState } from 'react';
import PasswordInput from '../../ux/auth/PasswordInput';
import { validatePassword } from '../../ux/auth/validation';

type SecurityPanelProps = {
  username: string
  onSetPassword: (newPassword: string) => void
  onSendRecovery: () => void
  isSettingPassword: boolean
  isSendingRecovery: boolean
}

export default function SecurityPanel({
  username,
  onSetPassword,
  onSendRecovery,
  isSettingPassword,
  isSendingRecovery
}: SecurityPanelProps) {
  const [password, setPassword] = useState('');
  const validationError = password.length > 0 ? validatePassword(password) : null;
  const canSubmit = password.length > 0 && !validationError;

  const submit = () => {
    if (!canSubmit) {
      return;
    }
    onSetPassword(password);
    setPassword('');
  };

  return (
    <Box borderRadius="20px" bg="#f6f8f3" p={4}>
      <Text fontWeight="800" mb={3}>Security</Text>
      <Stack spacing={4}>
        <FormControl isInvalid={Boolean(validationError)}>
          <FormLabel fontSize="sm">Set a new password for {username}</FormLabel>
          <HStack align="flex-start">
            <PasswordInput
              bg="white"
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  submit();
                }
              }}
            />
            <Button
              colorScheme="green"
              onClick={submit}
              isLoading={isSettingPassword}
              isDisabled={!canSubmit}
              minW="90px"
            >
              Set
            </Button>
          </HStack>
          <Text fontSize="xs" color={validationError ? 'red.500' : '#8a9782'} mt={1}>
            {validationError ?? '8–150 chars with uppercase, lowercase, number, and symbol.'}
          </Text>
        </FormControl>

        <Box borderTop="1px solid rgba(56,78,58,0.10)" pt={3}>
          <HStack justify="space-between" flexWrap="wrap" spacing={3}>
            <Box>
              <Text fontWeight="600" fontSize="sm">Password recovery email</Text>
              <Text fontSize="xs" color="#8a9782">Emails the user a self-service reset link.</Text>
            </Box>
            <Button variant="outline" colorScheme="green" onClick={onSendRecovery} isLoading={isSendingRecovery}>
              Send recovery email
            </Button>
          </HStack>
        </Box>
      </Stack>
    </Box>
  );
}
