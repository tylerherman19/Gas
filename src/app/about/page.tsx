import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — Costco Gas MN",
  description: "How this Costco gas price tracker works.",
};

export default function About() {
  return (
    <article className="space-y-6 text-sm leading-relaxed">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">How this works</h1>
        <p className="mt-2 text-muted">
          Costco doesn&apos;t publish gas prices centrally — they&apos;re buried on
          individual warehouse pages. But the site calls an undocumented endpoint
          behind the scenes.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">The endpoint</h2>
        <pre className="overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-xs">
{`GET https://www.costco.com/AjaxGetGasPricesService
      ?warehouseid=377_648

{"377":{"premium":"4.729","regular":"3.929"},
 "648":{"premium":"4.499","regular":"3.819"}}`}
        </pre>
        <p className="text-muted">
          The parameter is lowercase <code className="font-mono">warehouseid</code>,
          and multiple warehouse numbers are joined with underscores. It caps out
          around ten warehouses per call and quietly drops the rest. Requests
          without a browser-shaped User-Agent get dropped entirely.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">The warehouses</h2>
        <ul className="space-y-1 text-muted">
          <li>
            <span className="font-medium text-foreground">#377 St Louis Park</span>{" "}
            — 44.967, −93.354
          </li>
          <li>
            <span className="font-medium text-foreground">#648 Maple Grove</span> —
            45.093, −93.425
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Storage</h2>
        <p className="text-muted">
          A GitHub Action polls every three hours and writes to Postgres via
          Supabase. Rows are only written when a price actually moves, so the
          table is a clean change log rather than a pile of identical readings.
          The daily chart forward-fills across days where nothing changed.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Credit</h2>
        <p className="text-muted">
          The idea and the layout come from{" "}
          <a
            href="https://www.jack.bio/costcogas"
            className="text-accent underline underline-offset-2"
            target="_blank"
            rel="noreferrer"
          >
            Jack LaFond&apos;s national Costco gas tracker
          </a>
          , which covers all ~600 US warehouses.
        </p>
      </section>
    </article>
  );
}
