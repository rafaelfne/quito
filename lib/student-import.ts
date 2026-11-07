import { requestTimeoutMs, withTimeout } from "@/lib/sign-in";
import { appendContactLines, type PickedContact } from "@/lib/contact-picker";
import { loadStudents, normalizePhone, studentNameLimit, type Student, type StudentsClient, type StudentsListStatus, type StudentsLoad } from "@/lib/students";

export type ImportedStudent = { name: string; guardian_name: string; guardian_phone: string };

export type ImportLine = { line: number; text: string; name: string; guardianName: string; phone: string | null; problems: string[] };

export type StudentImportState = {
  text: string;
  students: Student[];
  listStatus: StudentsListStatus;
  message: string | null;
  notice: string | null;
};

export const studentImportPath = "/students/import";

export const studentImportMessages = {
  nameMissing: "Falta o nome do aluno.",
  guardianMissing: "Falta o nome do responsável.",
  nameTooLong: `Um dos nomes passou de ${studentNameLimit} caracteres.`,
  phoneMissing: "Falta o WhatsApp do responsável.",
  phoneInvalid: "Confira o telefone: ele precisa ter o DDD e o número.",
  repeatedInList: "Este aluno aparece mais de uma vez na lista.",
  alreadySaved: "Este aluno já está cadastrado.",
  nothingReady: "Nenhuma linha está pronta para guardar. Corrija as linhas marcadas e tente de novo.",
  loadFailed: "Não deu para conferir os alunos que você já tem. Confira a internet e tente de novo.",
  contactsAdded: (count: number) => (count === 1 ? "1 contato entrou na caixa." : `${count} contatos entraram na caixa.`) + " Escreva o nome do aluno no começo de cada linha, antes da vírgula.",
  contactsFailed: "Não deu para abrir os contatos do celular. Tente de novo ou cole a lista.",
  saveFailed: "Não deu para guardar os alunos agora. Confira a internet e toque em Guardar de novo.",
};

export const initialStudentImport: StudentImportState = { text: "", students: [], listStatus: "loading", message: null, notice: null };

const phonePattern = /\(?\+?\d[\d ().-]{6,}\d/;

const cellSeparator = /\t|\s*[;|,]\s*|\s+[-–—/]\s+/;

const listMarker = /^\s*(?:\d{1,3}[.)-]|[-•*])\s+/;

const leadingEmptyCell = /^[ ]*[\t;|,]/;

const headerCell = /^(nome|aluno|aluna|responsável|responsavel|telefone|whatsapp|celular|contato|fone)\b/i;

function cleanCell(raw: string): string {
  return raw.replace(/^["']+|["']+$/g, "").trim().replace(/\s+/g, " ");
}

function isHeader(text: string): boolean {
  if (/\d/.test(text)) return false;
  const cells = text.split(cellSeparator).map(cleanCell).filter(Boolean);
  return cells.length > 1 && cells.every((cell) => headerCell.test(cell));
}

function problemsOf(name: string, guardianName: string, rawPhone: string | undefined, phone: string | null): string[] {
  const problems: string[] = [];
  if (!name) problems.push(studentImportMessages.nameMissing);
  else if (!guardianName) problems.push(studentImportMessages.guardianMissing);
  if (name.length > studentNameLimit || guardianName.length > studentNameLimit) problems.push(studentImportMessages.nameTooLong);
  if (rawPhone === undefined) problems.push(studentImportMessages.phoneMissing);
  else if (!phone) problems.push(studentImportMessages.phoneInvalid);
  return problems;
}

export function parseStudentLine(text: string, line: number): ImportLine {
  const content = text.replace(listMarker, "");
  const rawPhone = content.match(phonePattern)?.[0];
  const phone = rawPhone === undefined ? null : normalizePhone(rawPhone);
  const cells = (rawPhone === undefined ? content : content.replace(rawPhone, "\t")).split(cellSeparator).map(cleanCell).filter(Boolean);
  const [name = "", guardianName = ""] = leadingEmptyCell.test(content) ? ["", ...cells] : cells;
  return { line, text, name, guardianName, phone, problems: problemsOf(name, guardianName, rawPhone, phone) };
}

function studentKey(name: string, phone: string): string {
  return `${name.toLocaleLowerCase("pt-BR")}|${phone}`;
}

export function parseStudentList(text: string, students: Student[] = []): ImportLine[] {
  const saved = new Set(students.map((student) => studentKey(student.name, student.guardian_phone)));
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/).map((content, index) => ({ content, number: index + 1 }));
  const filled = lines.filter(({ content }) => content.trim() !== "");
  const body = filled.length > 0 && isHeader(filled[0].content) ? filled.slice(1) : filled;
  return body.map(({ content, number }) => {
    const parsed = parseStudentLine(content, number);
    if (parsed.problems.length > 0 || !parsed.phone) return parsed;
    const key = studentKey(parsed.name, parsed.phone);
    const repeated = saved.has(key) ? studentImportMessages.alreadySaved : seen.has(key) ? studentImportMessages.repeatedInList : null;
    seen.add(key);
    return repeated ? { ...parsed, problems: [repeated] } : parsed;
  });
}

export function isReady(line: ImportLine): boolean {
  return line.problems.length === 0 && line.phone !== null;
}

export function importableStudents(lines: ImportLine[]): ImportedStudent[] {
  return lines.filter(isReady).map((line) => ({ name: line.name, guardian_name: line.guardianName, guardian_phone: line.phone as string }));
}

export function describeReady(count: number): string {
  return count === 1 ? "Guardar 1 aluno" : `Guardar ${count} alunos`;
}

export function describeSaved(count: number): string {
  return count === 1 ? "1 aluno guardado." : `${count} alunos guardados.`;
}

export async function saveImportedStudents(client: StudentsClient, rows: ImportedStudent[]): Promise<boolean> {
  try {
    const { error } = await withTimeout(Promise.resolve(client.from("students").insert(rows)), requestTimeoutMs);
    return !error;
  } catch {
    return false;
  }
}

export function changeImportText(state: StudentImportState, text: string): StudentImportState {
  return { ...state, text, message: null, notice: null };
}

export function addPickedContacts(state: StudentImportState, contacts: PickedContact[]): StudentImportState {
  if (contacts.length === 0) return { ...state, message: null, notice: null };
  return { ...state, text: appendContactLines(state.text, contacts), message: null, notice: studentImportMessages.contactsAdded(contacts.length) };
}

export function failPickingContacts(state: StudentImportState): StudentImportState {
  return { ...state, message: studentImportMessages.contactsFailed, notice: null };
}

export function startReloadingImport(state: StudentImportState): StudentImportState {
  return { ...state, listStatus: "loading" };
}

export function applyImportLoad(state: StudentImportState, result: StudentsLoad): StudentImportState {
  return result.ok ? { ...state, students: result.students, listStatus: "ready" } : { ...state, listStatus: "failed" };
}

export async function submitImport(client: StudentsClient, state: StudentImportState): Promise<StudentImportState> {
  const lines = parseStudentList(state.text, state.students);
  const rows = importableStudents(lines);
  if (rows.length === 0) return { ...state, message: studentImportMessages.nothingReady, notice: null };
  if (!(await saveImportedStudents(client, rows))) return { ...state, message: studentImportMessages.saveFailed, notice: null };
  const text = lines
    .filter((line) => !isReady(line))
    .map((line) => line.text)
    .join("\n");
  const next: StudentImportState = { ...state, text, message: null, notice: describeSaved(rows.length) };
  return applyImportLoad(next, await loadStudents(client));
}
