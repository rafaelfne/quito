export const noteLimit = 2000;

export function cleanNote(body: string): string | null {
  const text = body.trim();
  if (!text || text.length > noteLimit) return null;
  return text;
}
