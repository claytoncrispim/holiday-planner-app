export default function isIataCode(value) {
  return typeof value === "string" && /^[A-Z]{3}$/.test(value);
}