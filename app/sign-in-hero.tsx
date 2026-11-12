export const heroTitle = "Cobre sem constrangimento";

export const heroSummary = "O Quitô calcula quanto cada responsável deve no mês e deixa a cobrança pronta no dia certo.";

export function SignInHero() {
  return (
    <section aria-labelledby="sign-in-hero-title" className="flex w-full max-w-sm flex-col gap-2">
      <h2 id="sign-in-hero-title" className="text-3xl font-semibold">
        {heroTitle}
      </h2>
      <p className="text-base opacity-80">{heroSummary}</p>
    </section>
  );
}
