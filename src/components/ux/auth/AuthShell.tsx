import { Box, Heading, Stack, Text } from '@chakra-ui/react';
import type { ReactNode } from 'react';

type AuthShellProps = {
  title: string
  description: string
  children: ReactNode
}

const AuthShell = ({ title, description, children }: AuthShellProps) => (
  <Box
    minH="100vh"
    display="flex"
    alignItems="center"
    justifyContent="center"
    px={{ base: 4, md: 6 }}
    py={{ base: 8, md: 12 }}
    bgGradient="linear(to-b, gray.50, teal.50)"
  >
    <Box
      w="full"
      maxW="480px"
      bg="white"
      borderWidth="1px"
      borderColor="gray.200"
      borderRadius="2xl"
      boxShadow="xl"
      px={{ base: 5, md: 8 }}
      py={{ base: 6, md: 8 }}
    >
      <Stack spacing={6}>
        <Stack spacing={2} textAlign="center">
          <Heading size="lg">{title}</Heading>
          <Text color="gray.600">{description}</Text>
        </Stack>
        {children}
      </Stack>
    </Box>
  </Box>
);

export default AuthShell;
