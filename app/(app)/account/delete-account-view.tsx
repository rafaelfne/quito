export type DeleteStep = "closed" | "confirming" | "deleting";

export function DeleteAccountView({
  email,
  step,
  message,
  onOpen,
  onCancel,
  onConfirm,
}: {
  email: string;
  step: DeleteStep;
  message: string | null;
  onOpen: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (step === "closed") {
    return (
      <button className="rounded border border-red-700 px-3 py-2 text-red-700" type="button" onClick={onOpen}>
        Apagar conta
      </button>
    );
  }
  const deleting = step === "deleting";
  return (
    <section className="flex flex-col gap-4 rounded border border-red-700 p-4">
      <h2 className="font-semibold break-words">Apagar a conta {email}?</h2>
      <p className="text-sm">Isso apaga para sempre a sua conta e tudo o que você guardou no Quitô, como alunos, aulas e cobranças. Não dá para desfazer. Depois, você volta para a tela de entrada.</p>
      {message ? (
        <p className="text-sm" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <button className="rounded bg-red-700 px-3 py-2 text-white disabled:opacity-60" type="button" disabled={deleting} onClick={onConfirm}>
          {deleting ? "Apagando..." : "Sim, apagar tudo"}
        </button>
        <button className="rounded border px-3 py-2 disabled:opacity-60" type="button" disabled={deleting} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </section>
  );
}
