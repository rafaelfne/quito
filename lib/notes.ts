export const notesPath = "/notes";

export const noteLimit = 2000;

export const noteTooLongMessage = `Sua nota passou do limite de ${noteLimit.toLocaleString("pt-BR")} caracteres. Encurte o texto e toque em Guardar de novo.`;

export function cleanNote(body: string): string | null {
  const text = body.trim();
  if (!text || text.length > noteLimit) return null;
  return text;
}

export function noteWarning(body: string): string | null {
  return body.trim().length > noteLimit ? noteTooLongMessage : null;
}
