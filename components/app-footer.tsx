export const supportEmail = "suporte@quito.app";

export const appMotto = "Quitô · suas aulas em dia";

export function AppFooter() {
  return (
    <footer className="mt-auto flex flex-col gap-1 px-4 py-6 text-center text-muted-foreground">
      <p className="text-sm">
        Dúvidas?{" "}
        <a href={`mailto:${supportEmail}`} className="underline-offset-4 hover:underline">
          {supportEmail}
        </a>
      </p>
      <p className="text-xs">{appMotto}</p>
    </footer>
  );
}
