import {
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  type InputProps
} from '@chakra-ui/react';
import { useState } from 'react';

const EyeIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

export type PasswordInputProps = Omit<InputProps, 'type'>;

/**
 * Password field with a "reveal" (eye) toggle button. Drop-in replacement for
 * a Chakra <Input type="password" />.
 */
const PasswordInput = (props: PasswordInputProps) => {
  const [show, setShow] = useState(false);

  return (
    <InputGroup>
      <Input {...props} type={show ? 'text' : 'password'} pr="2.75rem" />
      <InputRightElement width="2.75rem">
        <IconButton
          aria-label={show ? 'Hide password' : 'Show password'}
          icon={show ? <EyeOffIcon /> : <EyeIcon />}
          onClick={() => setShow((value) => !value)}
          // Keep focus in the field so tapping the eye doesn't dismiss the keyboard.
          onMouseDown={(event) => event.preventDefault()}
          variant="ghost"
          size="sm"
          tabIndex={-1}
        />
      </InputRightElement>
    </InputGroup>
  );
};

export default PasswordInput;
