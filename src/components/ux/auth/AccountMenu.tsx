import {
  Box,
  Button,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Text
} from '@chakra-ui/react';
import { useAuth } from '../../../context/authContext';

const AccountMenu = () => {
  const { logout, user } = useAuth();

  return (
    <Box
      position="fixed"
      top={{ base: 4, md: 6 }}
      right={{ base: 4, md: 6 }}
      zIndex={3000}
    >
      <Menu>
        <MenuButton
          as={Button}
          colorScheme="teal"
          variant="solid"
          boxShadow="lg"
        >
          <Text as="span" display={{ base: 'none', sm: 'inline' }}>
            {user?.username ?? 'Account'}
          </Text>
          <Text as="span" display={{ base: 'inline', sm: 'none' }}>
            Menu
          </Text>
          <Text as="span" ml={2}>
            v
          </Text>
        </MenuButton>
        <MenuList>
          <MenuItem>Account</MenuItem>
          <MenuItem>Settings</MenuItem>
          <MenuItem color="red.500" onClick={logout}>
            Log out
          </MenuItem>
        </MenuList>
      </Menu>
    </Box>
  );
};

export default AccountMenu;
