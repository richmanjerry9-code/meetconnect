// utils/phone.js
export function formatPhone(phone) {
  if (!phone) throw new Error('Phone number is required');

  const cleaned = phone.trim().replace(/\s+/g, ''); // remove spaces

  if (cleaned.startsWith('07') || cleaned.startsWith('01') || cleaned.startsWith('+254')) {
    return cleaned; // leave as is
  }

  if (/^[17]\d{8}$/.test(cleaned)) {
    return '+254' + cleaned; // add +254
  }

  throw new Error('Invalid phone number format');
}
