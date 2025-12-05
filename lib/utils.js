export function maskPhone(num) {
  if (!num) return "";
  return num.replace(/^(\d{4})(\d+)(\d{3})$/, "$1 xxxx $3");
}
