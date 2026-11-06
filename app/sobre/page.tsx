import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { aboutSentences } from "@/app/sobre/about-sentences";

export const metadata: Metadata = {
  title: "Sobre o Quitô",
  description: "Você dá a aula. O Quitô cuida da cobrança.",
};

export default function AboutPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <div className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-2xl font-semibold">Sobre o Quitô</h1>
        {aboutSentences.map((sentence) => (
          <p key={sentence}>{sentence}</p>
        ))}
        <Button asChild>
          <Link href="/">Entrar no Quitô</Link>
        </Button>
      </div>
    </main>
  );
}
