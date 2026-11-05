import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "quito",
  description: "Criado com o Virgílio",
};

const followSystemTheme = `(() => {
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", systemDark.matches);
  apply();
  systemDark.addEventListener("change", apply);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: followSystemTheme }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
