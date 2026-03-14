const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[A-Za-z ]{2,30}$/;
const USERNAME_PATTERN = /^[A-Za-z0-9]{4,30}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,150}$/;

export const validateRequired = (label: string, value: string) =>
  value.trim() ? null : `${label} is required.`;

export const validateName = (value: string) =>
  NAME_PATTERN.test(value.trim())
    ? null
    : 'Name must use only letters, between 2 and 30 characters.';

export const validateUsername = (value: string) =>
  USERNAME_PATTERN.test(value.trim())
    ? null
    : 'Username must be alphanumeric only, between 4 and 30 characters.';

export const validateEmail = (value: string) =>
  EMAIL_PATTERN.test(value.trim())
    ? null
    : 'Enter a valid email address.';

export const validatePassword = (value: string) =>
  PASSWORD_PATTERN.test(value)
    ? null
    : 'Password must be 8 to 150 characters and include uppercase, lowercase, number, and symbol.';
