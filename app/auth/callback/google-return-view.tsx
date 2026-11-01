import Link from "next/link";

export function GoogleReturnView({ message, retryHref }: { message: string | null; retryHref: string }) {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <p className="text-sm opacity-70">Quitô</p>
        {message ? (
          <>
            <p className="text-sm" role="alert">
              {message}
            </p>
            <Link className="rounded bg-foreground px-3 py-2 text-center text-background" href={retryHref}>
              Voltar para a entrada
            </Link>
          </>
        ) : (
          <p role="status">Entrando com o Google...</p>
        )}
      </div>
    </main>
  );
}
