import type { Metadata } from "next";
import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const display = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const sans = Inter({ variable: "--font-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Costco Gas Index — St Louis Park vs Maple Grove",
  description:
    "A running head-to-head between the two Twin Cities Costco gas stations: current price, 7-day change, and which one has been cheaper.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dateline = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        <header className="px-5 pt-8">
          <div className="mx-auto w-full max-w-4xl">
            <div className="flex items-baseline justify-between gap-4 pb-2">
              <span className="tracking-label font-mono text-[10px] text-ink-faint">
                Twin Cities · Minnesota
              </span>
              <span className="tracking-label font-mono text-[10px] text-ink-faint">
                No. 377 / No. 648
              </span>
            </div>

            <div className="double-rule" />

            <h1 className="pt-5 text-center font-display text-[clamp(2.4rem,7vw,4.25rem)] leading-[0.95] tracking-tight">
              The Costco Gas Index
            </h1>

            <p className="pt-3 text-center font-display text-lg italic text-ink-soft">
              St Louis Park <span className="not-italic text-ink-faint">vs</span> Maple Grove
            </p>

            <div className="mt-5 flex items-center justify-between border-t border-b border-rule py-2">
              <Nav />
              <span className="tracking-label font-mono text-[10px] text-ink-faint">
                {dateline}
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-4xl flex-1 px-5 py-10">{children}</main>

        <footer className="px-5 pb-10">
          <div className="mx-auto w-full max-w-4xl">
            <div className="perforated mb-4" />
            <p className="font-mono text-[11px] leading-relaxed text-ink-faint">
              Prices read directly from Costco every three hours. History begins the
              day collection started — Costco publishes only current prices, so there
              is nothing to backfill. Not affiliated with Costco Wholesale. Check the
              pump before you commit to the detour.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
