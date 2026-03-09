const SUPPORTED_COUNTRIES = [
  'Kenya', 'Uganda', 'Tanzania', 'Rwanda', 'Ethiopia',
  'Burundi', 'South Sudan', 'Somalia', 'DR Congo', 'Mozambique',
  'Zambia', 'Zimbabwe', 'Malawi', 'South Africa', 'Nigeria',
  'Ghana', 'Senegal', 'Cameroon', 'Egypt',
];

export function CountrySelector({ value, onChange, selectClassName }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={selectClassName}
      style={{ fontWeight: value !== 'Kenya' ? '600' : 'normal' }}
    >
      {SUPPORTED_COUNTRIES.map((c) => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  );
}