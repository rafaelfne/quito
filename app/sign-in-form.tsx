import { codeLength, type SignInState } from "@/lib/sign-in";

export type SignInFormProps = {
  state: SignInState;
  busy: boolean;
  testInboxUrl: string | null;
  testCode: string | null;
  onEmailChange: (email: string) => void;
  onCodeChange: (code: string) => void;
  onSubmitEmail: () => void;
  onSubmitCode: () => void;
  onResend: () => void;
  onEditEmail: () => void;
  onGoogle: () => void;
};

const inputClass = "rounded-sm border px-3 py-2";
const primaryButtonClass = "rounded-sm bg-foreground px-3 py-2 text-background disabled:opacity-50";
const secondaryButtonClass = "rounded-sm border px-3 py-2 disabled:opacity-50";
const linkButtonClass = "text-sm underline disabled:opacity-50";

export function SignInForm(props: SignInFormProps) {
  const { state, busy, testInboxUrl, testCode } = props;
  const isEmailStep = state.step === "email";

  return (
    <form
      className="flex w-full max-w-sm flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (isEmailStep) props.onSubmitEmail();
        else props.onSubmitCode();
      }}
    >
      <header className="flex flex-col gap-1">
        <p className="text-sm opacity-70">Quitô</p>
        <h1 className="text-2xl font-semibold">{isEmailStep ? "Entrar no Quitô" : "Digite o código"}</h1>
      </header>

      {isEmailStep ? (
        <>
          <p className="text-sm">Digite o seu e-mail. Enviamos um código de {codeLength} números para você entrar, sem senha.</p>
          <label className="flex flex-col gap-1 text-sm">
            E-mail
            <input
              className={inputClass}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              required
              value={state.email}
              onChange={(event) => props.onEmailChange(event.target.value)}
            />
          </label>
          <button className={primaryButtonClass} type="submit" disabled={busy}>
            {busy ? "Enviando..." : "Receber código"}
          </button>
          <p className="text-center text-sm opacity-70">ou</p>
          <button className={secondaryButtonClass} type="button" disabled={busy} onClick={props.onGoogle}>
            Entrar com Google
          </button>
        </>
      ) : (
        <>
          {testInboxUrl ? (
            <p className="text-sm">
              Este é o ensaio: o e-mail não vai para a sua caixa de entrada de verdade.{" "}
              {testCode ? (
                <>
                  O seu código é <strong className="text-base tracking-widest">{testCode}</strong>.
                </>
              ) : (
                <>
                  O código fica na caixa de e-mails de teste.{" "}
                  <a className="underline" href={testInboxUrl} target="_blank" rel="noreferrer">
                    Abrir os e-mails de teste
                  </a>
                </>
              )}
            </p>
          ) : state.notice ? (
            <p className="text-sm">{state.notice}</p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            Código
            <input
              className={`${inputClass} text-center text-2xl tracking-[0.5em]`}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={codeLength}
              required
              value={state.code}
              onChange={(event) => props.onCodeChange(event.target.value)}
            />
          </label>
          <button className={primaryButtonClass} type="submit" disabled={busy || state.code.length !== codeLength}>
            {busy ? "Conferindo..." : "Entrar"}
          </button>
          <div className="flex justify-between gap-2">
            <button className={linkButtonClass} type="button" disabled={busy} onClick={props.onResend}>
              Enviar outro código
            </button>
            <button className={linkButtonClass} type="button" disabled={busy} onClick={props.onEditEmail}>
              Trocar e-mail
            </button>
          </div>
        </>
      )}

      {state.message ? (
        <p className="text-sm" role="alert">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
