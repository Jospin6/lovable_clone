import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier — Donnez forme à vos idées",
  description: "Créez votre site avec l’IA. Décrivez votre idée, suivez le code et découvrez l’aperçu en direct.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
