import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max';

const names = new Intl.DisplayNames(['pt-BR'], { type: 'region' });
export const phoneCountries = getCountries().map(code => ({
  code, name: names.of(code) || code, callingCode: getCountryCallingCode(code),
})).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

export function phoneDigits(value, country) {
  // Permite colar um telefone internacional do país selecionado sem duplicar o DDI.
  if (value.trim().startsWith('+')) {
    const parsed = parsePhoneNumberFromString(value, { extract: false });
    if (parsed?.country === country) return parsed.nationalNumber;
    // Mantém o DDI divergente para a validação rejeitá-lo, sem reinterpretar como número local.
    return '+' + value.replace(/\D/g, '');
  }
  return value.replace(/\D/g, '');
}

export function formatPhone(digits, country) {
  return new AsYouType(country).input(digits);
}

export function phoneE164(digits, country) {
  const phone = parsePhoneNumberFromString(digits, { defaultCountry: country, extract: false });
  return phone?.country === country && phone.isValid() ? phone.number : null;
}

export function formatPhoneDestination(value) {
  if (typeof value !== 'string') return '';
  const phone = parsePhoneNumberFromString(value, { extract: false });
  return phone?.isValid() ? `+${phone.countryCallingCode} ${phone.formatNational()}` : '';
}
