import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Jenga",
  title: "Jenga — Donnez forme à vos idées",
  description: "Créez votre site avec Jenga et l’IA. Décrivez votre idée, suivez le code et découvrez l’aperçu en direct.",
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
