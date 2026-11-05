import { Button } from "@/components/ui/button";

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
      <Button variant="destructiveOutline" type="button" onClick={onOpen}>
        Apagar conta
      </Button>
    );
  }
  const deleting = step === "deleting";
  return (
    <section className="flex flex-col gap-4 rounded-sm border border-destructive p-4">
      <h2 className="font-semibold break-words">Apagar a conta {email}?</h2>
      <p className="text-sm">Isso apaga para sempre a sua conta e tudo o que você guardou no Quitô, como alunos, aulas e cobranças. Não dá para desfazer. Depois, você volta para a tela de entrada.</p>
      {message ? (
        <p className="text-sm" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Button variant="destructive" type="button" disabled={deleting} onClick={onConfirm}>
          {deleting ? "Apagando..." : "Sim, apagar tudo"}
        </Button>
        <Button variant="outline" type="button" disabled={deleting} onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </section>
  );
}
