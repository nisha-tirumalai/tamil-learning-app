// The "no Tamil script on screen" guard. Tamil letters live in Unicode
// U+0B80–U+0BFF. Every model answer goes through these checks on the server
// before anything is sent to the browser.

const TAMIL = /[஀-௿]/;

export function hasTamilScript(value: unknown): boolean {
  if (typeof value === "string") return TAMIL.test(value);
  if (Array.isArray(value)) return value.some(hasTamilScript);
  if (value && typeof value === "object") return Object.values(value).some(hasTamilScript);
  return false;
}
