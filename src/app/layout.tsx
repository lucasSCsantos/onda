import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Rodape } from "@/components/rodape";
import { SCRIPT_TEMA } from "@/components/tema";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Mural ONDA", template: "%s · Mural ONDA" },
  description: "Calendário de Eventos da Liderança do ONDA, ministério de adolescentes.",
  applicationName: "Mural ONDA",
  // Há dados de menores: nada do app entra em buscadores.
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Mural ONDA", statusBarStyle: "default" },
  icons: { apple: "/icones/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#284995" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <div className="flex flex-1 flex-col">{children}</div>
        <Rodape />
      </body>
    </html>
  );
}
