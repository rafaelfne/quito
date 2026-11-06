export const supportEmail = "suporte@quito.app";

export function AppFooter() {
  return (
    <footer className="mt-auto px-4 py-6 text-center text-sm text-muted-foreground">
      Dúvidas?{" "}
      <a href={`mailto:${supportEmail}`} className="underline-offset-4 hover:underline">
        {supportEmail}
      </a>
    </footer>
  );
}
