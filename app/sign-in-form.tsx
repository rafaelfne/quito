import { codeLength, type SignInState } from "@/lib/sign-in";

export type SignInFormProps = {
  state: SignInState;
  busy: boolean;
  onEmailChange: (email: string) => void;
  onCodeChange: (code: string) => void;
  onSubmitEmail: () => void;
  onSubmitCode: () => void;
  onResend: () => void;
  onEditEmail: () => void;
};

const inputClass = "rounded border px-3 py-2";
const primaryButtonClass = "rounded bg-foreground px-3 py-2 text-background disabled:opacity-50";
const linkButtonClass = "text-sm underline disabled:opacity-50";

export function SignInForm(props: SignInFormProps) {
  const { state, busy } = props;
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
        </>
      ) : (
        <>
          {state.notice ? <p className="text-sm">{state.notice}</p> : null}
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
