import Link from "next/link";
import { DeleteAccount } from "@/app/(app)/account/delete-account";
import { NotificationTimeSection } from "@/app/(app)/account/notification-time-section";
import { NotificationsSection } from "@/app/(app)/account/notifications-section";
import { SignOutButton } from "@/app/(app)/sign-out-button";
import { Button } from "@/components/ui/button";
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
        <Button type="button" onClick={onRetry}>
          Tentar de novo
        </Button>
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
      <NotificationsSection />
      <NotificationTimeSection />
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
