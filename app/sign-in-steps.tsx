const steps = [
  "Marque as aulas de cada aluno.",
  "O Quitô calcula o valor do mês.",
  "Mande a cobrança com a chave Pix no dia do vencimento.",
];

export function SignInSteps() {
  return (
    <section className="w-full max-w-5xl" aria-labelledby="how-it-works-title">
      <h2 id="how-it-works-title" className="mb-4 text-center text-xl font-semibold">
        Como funciona
      </h2>
      <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step} className="flex items-start gap-3 rounded-sm border bg-card p-4">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary text-sm font-semibold text-primary-foreground">
              {index + 1}
            </span>
            <p className="pt-1 text-sm">{step}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
