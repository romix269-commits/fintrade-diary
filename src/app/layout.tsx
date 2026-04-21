import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ФинТрейд",
  description: "Дневник трейдера и аналитика торговли",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}