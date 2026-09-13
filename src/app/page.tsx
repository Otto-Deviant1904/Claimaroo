import type { Metadata } from "next";
import Link from "next/link";
import "./claimaroo.css";

const WORKSPACE = "/claims";

export const metadata: Metadata = {
  title: "Claimaroo — Motor collision claims intake",
  description:
    "A claim should reach the officer as a record, not a recording. Voice-first motor claims intake for Australia.",
};

const FILED_FIELDS = [
  ["Incident", "Collision, 11 Sept ~20:00"],
  ["Location", "Nepean Hwy, right turn"],
  ["Impact point", "Rear passenger side"],
  ["Injuries", "None reported"],
  ["Drivable", "Yes — door inoperable"],
  ["Assessment confidence", "88%"],
] as const;

const QUOTES = [
  "I was turning right onto Nepean Highway, about eight last night, and a white ute came through and clipped my rear passenger side.",
  "No one's hurt. It still drives but the back door won't open.",
  "I think I got his rego — it was one, something, S-D. Sorry, I'm not certain on that.",
] as const;

const STATS = [
  {
    label: "Claims lodged, 2024–25",
    value: "5.71m",
    tone: "",
    note: "Across 41.6m policies in force",
  },
  {
    label: "Claims-handling code breaches",
    value: "41,140",
    tone: "cl-tone-amber",
    note: "59% of all reported breaches",
  },
  {
    label: "Missed 20-day progress updates",
    value: "18,350",
    tone: "cl-tone-red",
    note: "Up 67% in a single year",
  },
  {
    label: "General insurance complaints",
    value: "36,022",
    tone: "cl-tone-amber",
    note: "Motor is the most complained about",
  },
] as const;

const SAVINGS_ROWS: {
  input: string;
  value: string;
  kind?: "derived" | "total";
}[] = [
  {
    input: "Motor policies in Australia (Insurance Council of Australia)",
    value: "~18m",
  },
  {
    input: "Policyholders lodging a claim each year (1 in 7, per ICA)",
    value: "14%",
  },
  {
    input: "Implied motor claims lodged nationally",
    value: "~2.5m",
    kind: "derived",
  },
  {
    input:
      "Loaded onshore contact centre cost (A$60–70/hr benchmark; $65 used)",
    value: "$1.08/min",
  },
  {
    input:
      "Officer minutes per lodged claim (call, follow-up and keying · modelled)",
    value: "11 min",
  },
  { input: "Intake labour per claim", value: "$11.90", kind: "derived" },
  { input: "Intake labour, modelled book", value: "$2.98m" },
  {
    input: "Intakes completed without an officer (modelled, not measured)",
    value: "55%",
  },
  { input: "Gross labour released", value: "$1.64m", kind: "derived" },
  { input: "Less voice agent run cost", value: "−$0.45m", kind: "derived" },
  {
    input: "Net per year, on intake alone",
    value: "$1.19m",
    kind: "total",
  },
];

const SOURCES = [
  "General Insurance Code Governance Committee, Industry Data and Compliance Report 2024–25 — claims lodged, policies in force, breach counts, and the 20-business-day and 10-business-day obligations.",
  "Australian Financial Complaints Authority, Annual Review 2024–25 and 2025–26 complaint data — complaint volumes, motor as the most complained-about insurance product, delay in claim handling as the leading issue.",
  "Insurance Council of Australia, Motor Insurance Policy Paper: A Roadmap for Reducing Rising Premiums (March 2025) — claim frequency of 1 in 7, average claim size of $5,202, repair cycle times, claims cost composition.",
  "Insurance Council of Australia industry snapshot — approximately 18 million motor-related policies in Australia.",
  "Australian contact centre outsourcing benchmarks, 2026 — loaded onshore agent cost of A$60–70 per hour and voice average handle time of 4–7 minutes.",
] as const;

function Ctas({ placement }: { placement?: "hero" | "footer" }) {
  const hero = placement === "hero";
  return (
    <div
      className={`cl-cta-row${hero ? " cl-cta-hero" : ""}`}
      role="group"
      aria-label={hero ? "Start a claim" : "Choose a side"}
    >
      <Link
        className={`cl-btn cl-btn-primary${hero ? " cl-btn-hero" : ""}`}
        href="/claim"
      >
        File a Insurance Claim
      </Link>
      <Link className="cl-btn cl-btn-secondary" href={WORKSPACE}>
        Open the officer workspace
      </Link>
    </div>
  );
}

export default function Home() {
  return (
    <div className="cl-root">
      <a className="cl-skip" href="#cl-main">
        Skip to content
      </a>
      <header className="cl-topbar">
        <Link className="cl-brand" href="/">
          Claimaroo
        </Link>
        <div className="cl-topbar-meta">
          <span>Motor collision · Australia</span>
          <Link href={WORKSPACE}>Officer workspace</Link>
        </div>
      </header>

      <main id="cl-main" className="cl-wrap" tabIndex={-1}>
        <section className="cl-section">
          <p className="cl-eyebrow">Motor claims</p>
          <h1 className="cl-h1">
            A claim should reach the officer as a record, not a recording.
          </h1>
          <p className="cl-lede">
            Claimaroo answers the first call after a collision, asks only for
            what is still missing, and files a claim where every field traces
            back to something the customer actually said.
          </p>

          <Ctas placement="hero" />

          <div className="cl-hero-grid">
            <article className="cl-card cl-card-pad">
              <div className="cl-card-head">
                <h2 className="cl-card-title">What the customer said</h2>
                <span className="cl-pill cl-pill-grey">Transcript</span>
              </div>
              {QUOTES.map((quote) => (
                <blockquote key={quote} className="cl-quote">
                  {quote}
                </blockquote>
              ))}
            </article>

            <article className="cl-card cl-card-pad">
              <div className="cl-card-head">
                <h2 className="cl-card-title">What Claimaroo filed</h2>
                <span className="cl-pill cl-pill-amber">Human review</span>
              </div>
              <dl className="cl-kv">
                {FILED_FIELDS.map(([key, value], index) => (
                  <div
                    key={key}
                    className="cl-kv-row"
                    style={{ ["--i" as string]: index }}
                  >
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <aside className="cl-callout">
                <h3>Missing information</h3>
                <p>
                  Third party rego captured as a partial only. Confirm with the
                  customer rather than inferring it.
                </p>
              </aside>
            </article>
          </div>
        </section>

        <section className="cl-section">
          <p className="cl-eyebrow">The gap</p>
          <h2 className="cl-h2">
            Australian motor claims don&apos;t fail at assessment. They fail at
            the handover.
          </h2>
          <p className="cl-sub">
            Every figure below comes from the industry&apos;s own compliance
            reporting or the financial ombudsman.
          </p>
          <div className="cl-stat-grid">
            {STATS.map((stat) => (
              <article key={stat.label} className="cl-stat">
                <p className="cl-stat-label">{stat.label}</p>
                <p className={`cl-stat-value ${stat.tone}`.trim()}>
                  {stat.value}
                </p>
                <p className="cl-stat-note">{stat.note}</p>
              </article>
            ))}
          </div>
          <article className="cl-card cl-card-pad cl-prose">
            <p>
              Comprehensive motor vehicle insurance is the most complained-about
              insurance product in Australia. Motor claim delays account for
              roughly one in four general insurance complaints reaching the
              ombudsman, and delay in claim handling was the single most
              complained-about issue across all of financial services.
            </p>
            <p>
              The Code Governance Committee&apos;s data points at the
              mechanism. The obligation to update a customer at least every
              twenty business days was breached 18,350 times in one year. More
              than half of the insurers who missed claims-handling timeframes
              could not say by how many days — a pattern the Committee described
              as structural rather than individual error.
            </p>
            <p>
              You cannot update a customer on a claim whose record is
              incomplete, and you cannot measure a breach you never captured
              cleanly. Both problems start in the first five minutes.
            </p>
          </article>
          <p className="cl-footnote">
            ASIC named insurance claims handling among its enforcement
            priorities for 2026, and the redrafted General Insurance Code of
            Practice is intended to be contractually enforceable.
          </p>
        </section>

        <section className="cl-section">
          <p className="cl-eyebrow">How we scoped it</p>
          <h2 className="cl-h2">
            The narrowest problem with the widest downstream effect.
          </h2>
          <div className="cl-split">
            <article className="cl-card cl-card-pad cl-prose">
              <div className="cl-card-head">
                <h3 className="cl-card-title">What we built</h3>
                <span className="cl-pill cl-pill-green">In scope</span>
              </div>
              <p>
                One line of business: motor collision. Highest volume, tightest
                standard field set, no property valuation, no contractor
                coordination, no catastrophe surge logic. Depth over breadth.
              </p>
              <p>
                Three commitments came out of that. Every extracted field
                carries the phrase it came from, so an officer can check the
                machine rather than trust it. Low confidence surfaces as a flag
                and is never resolved by guessing. And the agent asks only for
                what is genuinely still missing, which is what stops the repeat
                call.
              </p>
            </article>
            <article className="cl-card cl-card-pad cl-prose">
              <div className="cl-card-head">
                <h3 className="cl-card-title">What we deliberately didn&apos;t</h3>
                <span className="cl-pill cl-pill-red">Out of scope</span>
              </div>
              <p>
                The obvious build is an agent that settles the claim. We
                didn&apos;t build that. Liability on a motor collision is
                contested, the customer is often distressed, and an automated
                decision at that point is both a regulatory and a human risk.
              </p>
              <p>
                Nothing Claimaroo produces is a coverage or repair decision.
                The recommended action in the workspace is explicitly
                non-binding. A person keeps the authority, and the record exists
                so they can exercise it properly.
              </p>
            </article>
          </div>
        </section>

        <section className="cl-section">
          <p className="cl-eyebrow">What it does</p>
          <h2 className="cl-h2">Two surfaces, one record between them.</h2>
          <article className="cl-card cl-card-pad">
            <dl className="cl-dl">
              <div className="cl-dl-item">
                <dt>Photos before the call</dt>
                <dd>
                  The customer uploads damage photos from the roadside, on their
                  phone, before speaking to anyone. The agent then already knows
                  which panel it is asking about.
                </dd>
              </div>
              <div className="cl-dl-item">
                <dt>One call, in the browser</dt>
                <dd>
                  No phone number and no hold queue. The agent tracks which
                  fields are filled, which are missing and which are uncertain,
                  and shapes its next question accordingly.
                </dd>
              </div>
              <div className="cl-dl-item">
                <dt>Conflicts flagged, not smoothed over</dt>
                <dd>
                  If the verbal account and the photos disagree — a described
                  scratch against a caved-in quarter panel — the record says so
                  and routes for human review.
                </dd>
              </div>
              <div className="cl-dl-item">
                <dt>Routed on arrival</dt>
                <dd>
                  Each claim lands in the workspace already sorted into the
                  standard path, human review, or urgent escalation, with the
                  reason for that route stated on the file.
                </dd>
              </div>
            </dl>
          </article>
        </section>

        <section className="cl-section">
          <p className="cl-eyebrow">What it saves</p>
          <h2 className="cl-h2">
            Intake labour is the floor, not the ceiling.
          </h2>
          <p className="cl-sub">
            This counts one thing only: officer minutes spent taking and
            re-taking motor claim details. It is the part we can defend from
            public data. Every modelled input is labelled, so you can argue with
            the assumptions rather than the arithmetic.
          </p>
          <div className="cl-table-block">
            <div className="cl-table-head">
              <h3 id="cl-savings-heading">Annual intake cost, modelled</h3>
              <span>250,000 motor claims a year · AUD</span>
            </div>
            <div className="cl-table-scroll">
              <table className="cl-table" aria-labelledby="cl-savings-heading">
                <thead>
                  <tr>
                    <th>Input</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {SAVINGS_ROWS.map((row) => (
                    <tr
                      key={row.input}
                      className={
                        row.kind === "derived"
                          ? "cl-row-derived"
                          : row.kind === "total"
                            ? "cl-row-total"
                            : undefined
                      }
                    >
                      <th scope="row">{row.input}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cl-table-foot">
              Sensitivity: at 35% automation the net is about $0.75m; at 70% it
              is about $1.51m. Extrapolated across all Australian motor claims
              the intake line is roughly $12m a year.
            </p>
          </div>
          <article className="cl-card cl-card-pad cl-prose" style={{ marginTop: 16 }}>
            <p>
              Which is exactly why the argument isn&apos;t really about call
              minutes. The cost that matters is asymmetric. A clean record at
              intake is the precondition for meeting a twenty-business-day
              update obligation that was breached 18,350 times last year, at a
              moment when the regulator has made claims handling an enforcement
              priority and the industry Code is being rewritten to be
              contractually enforceable.
            </p>
          </article>
        </section>

        <section className="cl-section">
          <p className="cl-eyebrow">Where this sits</p>
          <h2 className="cl-h2">Not the first voice agent in claims.</h2>
          <article className="cl-card cl-card-pad cl-prose">
            <p>
              Australian and European insurers are already deploying generative
              AI in claims, mostly staff-facing or aimed at automating the
              assessment of low-complexity claims. Those systems all assume a
              submitted claim already exists and is well formed.
            </p>
            <p>
              Claimaroo sits upstream. It produces the clean, structured,
              source-linked input those pipelines need and rarely get. The
              honest framing of this build is a fast prototype of the reasoning
              layer, not a claim to have invented voice intake.
            </p>
          </article>
        </section>

        <section className="cl-section">
          <article className="cl-card cl-card-pad">
            <h2 className="cl-h2">Pick a side.</h2>
            <p className="cl-sub">
              The customer side is what someone uses standing next to a damaged
              car. The workspace is what the officer opens next.
            </p>
            <Ctas />
          </article>
        </section>

        <section className="cl-section">
          <p className="cl-eyebrow">Sources</p>
          <article className="cl-card cl-card-pad">
            <ul className="cl-source-list">
              {SOURCES.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
            <p className="cl-footnote">
              Automation rate, officer minutes per claim and voice run cost are
              modelled by us and labelled as such in the table. Everything else
              is published.
            </p>
          </article>
        </section>
      </main>

      <footer className="cl-footer">
        Claimaroo — built for the Forward: AI in Business Hackathon. Motor
        collision claims intake, Australia. Demonstration only, and not
        affiliated with any insurer.
      </footer>
    </div>
  );
}
