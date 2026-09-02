import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Costco Gas: St Louis Park vs Maple Grove",
  description:
    "Live tracker and price history for regular and premium gas at the St Louis Park and Maple Grove Costco warehouses in Minnesota.",
  openGraph: {
    title: "Costco Gas: St Louis Park vs Maple Grove",
    description:
      "Live tracker and price history for the two Twin Cities Costco gas stations.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-5 px-5 py-4">
            <Link
              href="/"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-white"
              aria-label="Home"
            >
              ⛽
            </Link>
            <nav className="flex items-center gap-4 text-sm text-muted">
              <Link href="/" className="transition-colors hover:text-foreground">
                tracker
              </Link>
              <Link href="/about" className="transition-colors hover:text-foreground">
                about
              </Link>
            </nav>
            <span className="ml-auto font-mono text-xs text-muted">MN</span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-10">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-3xl px-5 py-6 text-xs leading-relaxed text-muted">
            Prices are read directly from Costco and refreshed every 3 hours. Not
            affiliated with Costco Wholesale. Check the pump before you commit to
            the detour.
          </div>
        </footer>
      </body>
    </html>
  );
}
