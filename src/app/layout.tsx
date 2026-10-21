import type { Metadata } from "next";
import { IBM_Plex_Sans, Literata } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const display = Literata({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "ContentPilot AI",
  description: "Черновики постов, объявлений и сценариев с учётом бренда и ваших материалов.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={`${sans.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
