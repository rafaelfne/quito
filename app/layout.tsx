import type { Metadata, Viewport } from "next";
import { Poppins, Domine, IBM_Plex_Mono } from "next/font/google";
import { appIdentity } from "@/lib/app-identity";
import "./globals.css";

const fontAppSans = Poppins({ variable: "--font-app-sans", weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"], subsets: ["latin"] });

const fontAppSerif = Domine({ variable: "--font-app-serif", subsets: ["latin"] });

const fontAppMono = IBM_Plex_Mono({ variable: "--font-app-mono", weight: ["100", "200", "300", "400", "500", "600", "700"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: appIdentity.name,
  description: appIdentity.description,
  applicationName: appIdentity.name,
  appleWebApp: { capable: true, title: appIdentity.name, statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: appIdentity.lightBackground },
    { media: "(prefers-color-scheme: dark)", color: appIdentity.darkBackground },
  ],
};

const followSystemTheme = `(() => {
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => document.documentElement.classList.toggle("dark", systemDark.matches);
  apply();
  systemDark.addEventListener("change", apply);
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${fontAppMono.variable} ${fontAppSerif.variable} ${fontAppSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: followSystemTheme }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
