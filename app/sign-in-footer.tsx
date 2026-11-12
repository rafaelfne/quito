export const contactEmail = "oi@quito.app";

export function SignInFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="flex flex-col items-center gap-1 px-8 pb-8 text-center text-sm text-muted-foreground">
      <p>Os dados dos seus alunos são só seus. Ninguém mais vê.</p>
      <p>
        Dúvidas? Fale com a gente em{" "}
        <a className="underline underline-offset-4 hover:text-foreground" href={`mailto:${contactEmail}`}>
          {contactEmail}
        </a>
      </p>
      <p>© {year} Quitô</p>
    </footer>
  );
}
