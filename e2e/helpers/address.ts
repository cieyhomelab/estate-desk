// Mirrors src/lib/utils.ts parseAddressParts — kept separate because E2E tests
// cannot import from the app source (no path alias resolution in playwright.config.ts).
export function parseAddressParts(address: string): { street: string; city: string | null } {
  const lastComma = address.lastIndexOf(",");
  if (lastComma === -1) return { street: address, city: null };
  return {
    street: address.slice(0, lastComma).trim(),
    city: address.slice(lastComma + 1).trim(),
  };
}
