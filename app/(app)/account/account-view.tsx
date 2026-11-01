import Link from "next/link";
import { DeleteAccount } from "@/app/(app)/account/delete-account";
import { SignOutButton } from "@/app/(app)/sign-out-button";
import { signInMethodLabels, type AccountResult } from "@/lib/account";
import { afterSignInPath } from "@/lib/session";

function AccountDetailsView({ account, onRetry }: { account: AccountResult | null; onRetry: () => void }) {
  if (!account) return <p className="text-sm">Carregando...</p>;
  if (!account.ok) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm" role="alert">
          {account.message}
        </p>
        <button className="rounded bg-foreground px-3 py-2 text-background" type="button" onClick={onRetry}>
          Tentar de novo
        </button>
      </div>
    );
  }
  return (
    <dl className="flex flex-col gap-4">
      <div>
        <dt className="text-sm">E-mail</dt>
        <dd className="font-medium break-words">{account.email}</dd>
      </div>
      {account.method ? (
        <div>
          <dt className="text-sm">Como você entrou neste aparelho</dt>
          <dd className="font-medium">{signInMethodLabels[account.method]}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function AccountView({
  account,
  signOutMessage,
  onRetry,
  onSignOutError,
}: {
  account: AccountResult | null;
  signOutMessage: string | null;
  onRetry: () => void;
  onSignOutError: (message: string) => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sua conta</h1>
        <Link className="text-sm underline" href={afterSignInPath}>
          Voltar
        </Link>
      </header>
      <AccountDetailsView account={account} onRetry={onRetry} />
      <SignOutButton onError={onSignOutError} />
      {signOutMessage ? (
        <p className="text-sm" role="alert">
          {signOutMessage}
        </p>
      ) : null}
      {account?.ok ? <DeleteAccount email={account.email} /> : null}
    </main>
  );
}
