import Select, { createFilter } from 'react-select';
import { phoneCountries, phoneDigits, formatPhone } from '../utils/phone';

// SVGs empacotados localmente; não usa emojis ou servidores de bandeiras externos.
const flags = import.meta.glob('../../node_modules/country-flag-icons/3x2/*.svg', {
  eager: true, query: '?url&no-inline', import: 'default',
});
const options = phoneCountries.map(country => ({
  ...country, value: country.code, label: `${country.name} (+${country.callingCode})`,
}));
const filterCountry = createFilter({ stringify: option => `${option.data.name} +${option.data.callingCode} ${option.data.code}` });

export default function InternationalPhoneField({ country, telephone, error, disabled, required = true, onCountryChange, onTelephoneChange, onBlur }) {
  return <fieldset className="international-phone-field">
    <legend>Telefone</legend>
    <div className="international-phone-controls">
      <Select
        className="phone-country" classNamePrefix="phone-country"
        inputId="company-phone-country" instanceId="company-phone-country"
        aria-label={`País do telefone: ${options.find(option => option.code === country)?.label || country}`} isDisabled={disabled} isClearable={false}
        options={options} value={options.find(option => option.code === country)}
        onChange={option => onCountryChange(option.code)} filterOption={filterCountry}
        placeholder="Pesquisar país..." noOptionsMessage={() => 'Nenhum país encontrado.'}
        screenReaderStatus={({ count }) => `${count} países encontrados.`}
        menuPlacement="auto" maxMenuHeight={180}
        formatOptionLabel={(option, { context }) => <span className="phone-country-option">
          <img src={flags[`../../node_modules/country-flag-icons/3x2/${option.code}.svg`]} alt="" aria-hidden="true" width="20" height="14" />
          <span>{context === 'value' ? `+${option.callingCode}` : `${option.name} (+${option.callingCode})`}</span>
        </span>}
        styles={{
          control: (base, state) => ({ ...base, height: 42, minHeight: 42, borderRadius: 7, fontSize: 15,
            backgroundColor: disabled ? 'var(--ui-soft)' : 'var(--ui-surface)',
            borderColor: state.isFocused ? 'var(--color-primary)' : '#d0d5dd',
            boxShadow: state.isFocused ? '0 0 0 3px rgb(23 59 104 / 10%)' : 'none',
            '&:hover': { borderColor: state.isFocused ? 'var(--color-primary)' : '#a8b3c4' } }),
          valueContainer: base => ({ ...base, padding: '0 8px' }),
          singleValue: base => ({ ...base, color: 'var(--ui-text)', maxWidth: '100%' }),
          input: base => ({ ...base, margin: 0, padding: 0, color: 'var(--ui-text)' }),
          dropdownIndicator: base => ({ ...base, padding: 4 }),
          indicatorSeparator: () => ({ display: 'none' }),
          menu: base => ({ ...base, minWidth: 'min(300px, calc(100vw - 80px))', zIndex: 5, borderRadius: 7, fontSize: 14 }),
          option: (base, state) => ({ ...base, color: state.isSelected ? '#fff' : 'var(--ui-text)',
            backgroundColor: state.isSelected ? 'var(--color-primary)' : state.isFocused ? 'var(--ui-soft)' : 'var(--ui-surface)',
            padding: '8px 10px' }),
        }}
      />
      <label className="phone-number-field">
        <span className="ui-sr-only">Número de telefone</span>
        <input type="tel" inputMode="tel" autoComplete="tel-national" required={required} disabled={disabled}
          placeholder={country === 'BR' ? '(31) 99999-9999' : 'Telefone com código de área'}
          value={formatPhone(telephone, country)} aria-invalid={Boolean(error)}
          aria-describedby={error ? 'company-phone-error' : undefined}
          onChange={event => onTelephoneChange(phoneDigits(event.target.value, country))} onBlur={onBlur} />
      </label>
    </div>
    {error && <p id="company-phone-error" className="company-form-error" role="alert">{error}</p>}
  </fieldset>;
}
