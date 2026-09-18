import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["500", "700", "800"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Market Monitor",
  description:
    "A US markets recap for wherever the session stands: real index levels, the Treasury curve, and a written desk note, assembled from public market data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
