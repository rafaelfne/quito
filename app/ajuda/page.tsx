import type { Metadata } from "next";
import Link from "next/link";
import { helpQuestions } from "@/lib/help";

export const metadata: Metadata = {
  title: "Ajuda · Quitô",
  description: "Perguntas frequentes do professor sobre o Quitô",
};

export default function HelpPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Ajuda</h1>
        <Link className="text-sm underline" href="/">
          Voltar para o Quitô
        </Link>
      </header>
      <p className="text-muted-foreground">As dúvidas mais comuns de quem usa o Quitô para cobrar as aulas.</p>
      <section className="flex flex-col gap-3" aria-label="Perguntas frequentes">
        {helpQuestions.map((item) => (
          <details key={item.question} className="group rounded-sm border border-border bg-card text-card-foreground shadow-xs">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
              <span>{item.question}</span>
              <span aria-hidden="true" className="text-primary transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <div className="flex flex-col gap-2 border-t border-border px-4 py-3 text-sm text-muted-foreground">
              {item.answers.map((answer) => (
                <p key={answer}>{answer}</p>
              ))}
            </div>
          </details>
        ))}
      </section>
    </main>
  );
}
