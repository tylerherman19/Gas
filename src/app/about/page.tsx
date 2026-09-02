import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Method — The Costco Gas Index",
  description: "How the Costco gas price data is collected and stored.",
};

export default function About() {
  return (
    <article className="space-y-10">
      <header>
        <h2 className="font-display text-4xl leading-none">Method</h2>
        <p className="max-w-xl pt-4 text-[15px] leading-relaxed text-ink-soft">
          Costco does not publish gas prices centrally. They are buried on
          individual warehouse pages — but the site calls an undocumented
          endpoint to fill them in, and that endpoint answers anyone who asks
          politely.
        </p>
      </header>

      <div className="perforated" />

      <Section n="01" title="The endpoint">
        <pre className="overflow-x-auto border border-rule-strong bg-card p-4 font-mono text-[11px] leading-relaxed">
{`GET https://www.costco.com/AjaxGetGasPricesService
      ?warehouseid=377_648

{"377":{"premium":"4.729","regular":"3.929"},
 "648":{"premium":"4.499","regular":"3.819"}}`}
        </pre>
        <ul className="space-y-2 pt-4 text-sm leading-relaxed text-ink-soft">
          <Bullet>
            The parameter is lowercase <Code>warehouseid</Code>. Every other
            spelling returns{" "}
            <Code>{`{"errorMessage":"warehouse id supplied, , is not a number"}`}</Code>.
          </Bullet>
          <Bullet>Warehouse numbers are joined with underscores.</Bullet>
          <Bullet>
            It caps at roughly ten warehouses per call and silently drops the
            rest, so requests are batched in tens.
          </Bullet>
          <Bullet>
            Requests without a browser-shaped User-Agent and Referer are dropped
            entirely.
          </Bullet>
          <Bullet>
            Unknown warehouse numbers come back as <Code>{`{"999999":{}}`}</Code>{" "}
            rather than an error.
          </Bullet>
        </ul>
      </Section>

      <Section n="02" title="Why not the richer endpoint">
        <p className="text-sm leading-relaxed text-ink-soft">
          Costco has a second endpoint,{" "}
          <Code>AjaxWarehouseBrowseLookupView</Code>, which takes a latitude and
          longitude and returns addresses, hours, services and prices together.
          It sits behind Akamai and returns <strong className="text-ink">403</strong>{" "}
          to datacenter IPs, including CI runners. So this project uses the
          prices-only endpoint and keeps the two warehouses&rsquo; coordinates in
          the database instead.
        </p>
      </Section>

      <Section n="03" title="The warehouses">
        <dl className="grid gap-px bg-rule sm:grid-cols-2">
          <Warehouse
            id="377"
            name="St Louis Park"
            coords="44.967, −93.354"
            color="var(--slp)"
          />
          <Warehouse
            id="648"
            name="Maple Grove"
            coords="45.093, −93.425"
            color="var(--grove)"
          />
        </dl>
      </Section>

      <Section n="04" title="Storage">
        <p className="text-sm leading-relaxed text-ink-soft">
          A scheduled job polls every three hours and writes to Postgres via
          Supabase, alongside the fantasy football tables. A row is written only
          when a price actually moves, so the table is a change log rather than a
          pile of identical readings. The daily view forward-fills across
          unchanged days so the chart draws a continuous line.
        </p>
      </Section>

      <Section n="05" title="On history">
        <p className="text-sm leading-relaxed text-ink-soft">
          Costco exposes only current prices — there is no historical endpoint
          anywhere. This record therefore begins the day collection started and
          grows one day at a time. Nothing can be backfilled.
        </p>
      </Section>

      <div className="perforated" />

      <p className="font-mono text-[11px] leading-relaxed text-ink-faint">
        Owes its idea and much of its shape to{" "}
        <a
          href="https://www.jack.bio/costcogas"
          className="text-ink underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          Jack LaFond&rsquo;s national Costco gas tracker
        </a>
        , which covers all ~600 US warehouses.
      </p>
    </article>
  );
}

function Section({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-8">
      <div className="flex items-start gap-3 sm:w-20 sm:flex-col sm:gap-1">
        <span className="tnum font-display text-3xl leading-none text-rule-strong">{n}</span>
      </div>
      <div>
        <h3 className="pb-3 font-display text-2xl leading-none">{title}</h3>
        {children}
      </div>
    </section>
  );
}

function Warehouse({
  id,
  name,
  coords,
  color,
}: {
  id: string;
  name: string;
  coords: string;
  color: string;
}) {
  return (
    <div className="relative bg-card p-4">
      <div className="absolute inset-y-0 left-0 w-1" style={{ background: color }} />
      <dt className="pl-3 font-display text-xl leading-none">{name}</dt>
      <dd className="tnum pl-3 pt-2 font-mono text-[11px] text-ink-faint">
        No. {id} · {coords}
      </dd>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-rule-strong" />
      <span>{children}</span>
    </li>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-paper-deep px-1.5 py-0.5 font-mono text-[11px]">{children}</code>;
}
