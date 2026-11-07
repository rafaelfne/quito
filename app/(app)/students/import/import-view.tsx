import Link from "next/link";
import { Button } from "@/components/ui/button";
import { describeReady, importableStudents, isReady, parseStudentList, studentImportMessages, type ImportLine, type StudentImportState } from "@/lib/student-import";
import { formatPhone, studentsPath } from "@/lib/students";

type StudentImportViewProps = {
  state: StudentImportState;
  busy: boolean;
  onChange: (text: string) => void;
  onSubmit: () => void;
  onRetry: () => void;
  onPickContacts?: () => void;
};

function LinePreview({ line }: { line: ImportLine }) {
  const ready = isReady(line);
  return (
    <li className="flex flex-col gap-1 rounded-sm border p-3" aria-invalid={ready ? undefined : true}>
      <p className="text-xs opacity-70">Linha {line.line}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="opacity-70">Aluno</dt>
        <dd className="break-words font-medium">{line.name || "—"}</dd>
        <dt className="opacity-70">Responsável</dt>
        <dd className="break-words">{line.guardianName || "—"}</dd>
        <dt className="opacity-70">WhatsApp</dt>
        <dd>{line.phone ? formatPhone(line.phone) : "—"}</dd>
      </dl>
      {ready ? (
        <p className="text-sm font-medium">Pronto para guardar</p>
      ) : (
        <ul className="text-sm font-medium">
          {line.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

function ContactsPick({ busy, onPickContacts }: { busy: boolean; onPickContacts: () => void }) {
  return (
    <section className="flex flex-col gap-2">
      <Button variant="outline" type="button" disabled={busy} onClick={onPickContacts}>
        Escolher dos contatos do celular
      </Button>
      <p className="text-sm opacity-70">O Quitô recebe só os contatos que você escolher, nunca a agenda inteira.</p>
    </section>
  );
}

export function StudentImportView({ state, busy, onChange, onSubmit, onRetry, onPickContacts }: StudentImportViewProps) {
  const lines = parseStudentList(state.text, state.students);
  const readyCount = importableStudents(lines).length;
  const pending = lines.length - readyCount;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Colar uma lista de alunos</h1>
        <p className="text-sm">Um aluno por linha: nome do aluno, nome do responsável e WhatsApp. Pode copiar as linhas direto de uma planilha.</p>
        <Link className="text-sm underline" href={studentsPath}>
          Voltar para Alunos
        </Link>
      </header>
      {onPickContacts ? <ContactsPick busy={busy} onPickContacts={onPickContacts} /> : null}
      {state.notice ? (
        <p className="text-sm" role="status">
          {state.notice}
        </p>
      ) : null}
      {state.listStatus === "failed" ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm" role="alert">
            {studentImportMessages.loadFailed}
          </p>
          <Button variant="outline" type="button" onClick={onRetry}>
            Tentar de novo
          </Button>
        </div>
      ) : null}
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Lista de alunos
          <span className="opacity-70">Exemplo: Pedro Lima, Ana Lima, (11) 98765-4321</span>
          <textarea
            className="min-h-40 rounded-sm border bg-background px-3 py-3 text-base text-foreground"
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            value={state.text}
            disabled={busy}
            onChange={(event) => onChange(event.target.value)}
          />
        </label>
        {lines.length > 0 ? (
          <p className="text-sm font-medium" role="status">
            {readyCount} {readyCount === 1 ? "pronto" : "prontos"} para guardar{pending > 0 ? `, ${pending} ${pending === 1 ? "precisa" : "precisam"} de correção` : ""}.
          </p>
        ) : null}
        {state.message ? (
          <p className="text-sm" role="alert">
            {state.message}
          </p>
        ) : null}
        <Button type="submit" disabled={busy || state.listStatus !== "ready" || readyCount === 0}>
          {busy ? "Guardando..." : describeReady(readyCount)}
        </Button>
        {pending > 0 ? <p className="text-sm opacity-70">As linhas que precisam de correção ficam na caixa depois de guardar, para você arrumar e guardar de novo.</p> : null}
      </form>
      {lines.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">Como o Quitô separou</h2>
          <ul className="flex flex-col gap-2">
            {lines.map((line) => (
              <LinePreview key={line.line} line={line} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
