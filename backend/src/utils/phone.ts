import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

export function isValidE164(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\+[1-9]\d{1,14}$/.test(value)) return false;
  const phone = parsePhoneNumberFromString(value, { extract: false });
  return Boolean(phone?.isValid() && phone.number === value);
}
