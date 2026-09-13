import type { Metadata } from "next";
import Link from "next/link";
import {
  CaseCarousel,
  type CaseCarouselSlide,
} from "@/components/landing/case-carousel";
import { ReadMore } from "@/components/landing/read-more";
import "./landing.css";

const WORKSPACE = "/claims";

export const metadata: Metadata = {
  title: "Claimaroo — A clearer start to your claim",
  description:
    "A clearer start to motor claims with Claimaroo. Voice-first intake for Australia.",
};

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
    tone: "tone-amber",
    note: "59% of all reported breaches",
  },
  {
    label: "Missed 20-day progress updates",
    value: "18,350",
    tone: "tone-red",
    note: "Up 67% in a single year",
  },
  {
    label: "General insurance complaints",
    value: "36,022",
    tone: "tone-amber",
    note: "Motor is the most complained about",
  },
] as const;

const SOURCES = [
  "General Insurance Code Governance Committee, Industry Data and Compliance Report 2024–25 — claims lodged, policies in force, breach counts, and the 20-business-day and 10-business-day obligations.",
  "Australian Financial Complaints Authority, Annual Review 2024–25 and 2025–26 complaint data — complaint volumes, motor as the most complained-about insurance product, delay in claim handling as the leading issue.",
  "Insurance Council of Australia, Motor Insurance Policy Paper: A Roadmap for Reducing Rising Premiums (March 2025) — claim frequency of 1 in 7, average claim size of $5,202, repair cycle times, claims cost composition.",
  "Insurance Council of Australia industry snapshot — approximately 18 million motor-related policies in Australia.",
  "Australian contact centre outsourcing benchmarks, 2026 — loaded onshore agent cost of A$60–70 per hour and voice average handle time of 4–7 minutes.",
  "insurancenews.com.au, “Square numbers: the latest dispute data from AFCA’s cube” (10 November 2025) — AFCA Datacube complaint counts by underwriting entity, FY2024–25.",
  "Budget Direct, Claims Process (budgetdirect.com.au) — published claim-decision commitment of 10 working days.",
  "Australian Securities and Investments Commission, Media Release 26-036MR (27 February 2026, asic.gov.au) — Federal Court proceedings against Auto & General Insurance Company Ltd.",
] as const;

type FormulaItem =
  { value: string; label: string; highlight?: boolean } | { op: string };

const FORMULA: FormulaItem[] = [
  { value: "11 min", label: "officer time, per claim" },
  { op: "×" },
  { value: "$1.08", label: "loaded cost, per minute" },
  { op: "×" },
  { value: "250,000", label: "claims a year, modelled book" },
  { op: "=" },
  {
    value: "$2.98m",
    label: "intake labour at stake, modelled",
    highlight: true,
  },
];

const INSURER_STORIES: {
  name: string;
  stat: string;
  statLabel: string;
  gap: string;
  possibility: string;
}[] = [
  {
    name: "Allianz",
    stat: "1,625",
    statLabel: "AFCA complaints, FY2024–25 — 3rd-most nationally, all products",
    gap: "Allianz underwrites its own book, so every dispute traces straight back to the name on the policy.",
    possibility:
      "A claim record that's complete from minute one is fewer disputes born from an incomplete one.",
  },
  {
    name: "AAMI",
    stat: "5,343",
    statLabel:
      "AFCA complaints booked to AAI Ltd — AAMI, Suncorp, GIO, Apia, Shannons & Vero combined",
    gap: "AAMI's own number doesn't exist. The brand you trust isn't the entity anyone is actually measuring.",
    possibility:
      "A record structured to travel with the claim, not with the underwriting arrangement behind it.",
  },
  {
    name: "Budget Direct",
    stat: "10 days",
    statLabel:
      "Published claim-decision commitment — its underwriter is now in Federal Court over broken ones",
    gap: "A promise on the website and the record behind it can drift apart for years before anyone catches it.",
    possibility:
      "Capturing the claim cleanly the first time is also how you catch that drift in year one, not year eight.",
  },
];

const CASE_SLIDES: CaseCarouselSlide[] = [
  {
    eyebrow: "01 · THE MARKET",
    title: "How big is the book?",
    rows: [
      { label: "Motor policies in Australia (ICA)", value: "~18m" },
      { label: "Lodge a claim each year (1 in 7, per ICA)", value: "14%" },
      {
        label: "Implied motor claims lodged nationally",
        value: "~2.5m",
        derived: true,
      },
    ],
  },
  {
    eyebrow: "02 · THE COST OF INTAKE",
    title: "What one claim costs to open",
    rows: [
      {
        label: "Loaded onshore rate (A$60–70/hr; $65 used)",
        value: "$1.08/min",
      },
      { label: "Officer minutes per claim, modelled", value: "11 min" },
      { label: "Intake labour per claim", value: "$11.90", derived: true },
      { label: "Intake labour, modelled book", value: "$2.98m" },
    ],
  },
  {
    eyebrow: "03 · WHAT AUTOMATION RECOVERS",
    title: "What comes back net",
    rows: [
      { label: "Intakes handled without an officer, modelled", value: "55%" },
      { label: "Gross labour released", value: "$1.64m", derived: true },
      { label: "Less voice agent run cost", value: "−$0.45m", derived: true },
      {
        label: "Net per year, on intake alone",
        value: "$1.19m",
        total: true,
      },
    ],
  },
  {
    eyebrow: "04 · THE RANGE",
    title: "It moves with the automation rate",
    rows: [
      { label: "At 35% automation", value: "~$0.75m" },
      { label: "At 70% automation", value: "~$1.51m" },
      { label: "Extrapolated across all AU motor claims", value: "~$12m/yr" },
    ],
  },
  {
    eyebrow: "05 · BUT THE MATH ASSUMES ONE THING",
    title: "None of this works if the record can't be trusted.",
    body: "A faster intake only pays off if what it captures holds up when a claims officer opens the file. That's the part that happens next.",
    cta: { label: "See how claims teams review the record", href: "#record" },
  },
];

export default function Home() {
  return (
    <div className="landing">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header>
        <Link className="brand" href="/" aria-label="Claimaroo home">
          <span className="brandmark">
            c<span>↗</span>
          </span>
          claimaroo<span className="branddot">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <a href="#how">How it works</a>
          <a href="#numbers">The numbers</a>
          <a href="#record">For claims teams</a>
          <a href="#questions">FAQs</a>
        </nav>
        <Link className="button small secondary" href={WORKSPACE}>
          Officer workspace <span>↗</span>
        </Link>
      </header>

      <main id="main">
        <section className="hero wrap">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="line" /> MOTOR CLAIMS, WITH A HUMAN TOUCH
            </div>
            <h1>
              A bump in the road.
              <br />
              <em>Not your whole day.</em>
            </h1>
            <p>
              After a collision, finding the right words can be hard. Tell
              Claimaroo what happened. We’ll help put the details together,
              ready for a claims officer.
            </p>
            <div className="actions">
              <Link className="button primary" href="/claim">
                Start a claim <span>↗</span>
              </Link>
              <a className="text-link" href="#how">
                See how it works <span>↓</span>
              </a>
            </div>
            <div className="hero-note">
              <span>◉</span> Photos first. Call next. A person reviews your
              claim.
            </div>
          </div>
          <div
            className="story"
            aria-label="An example conversation becomes an organised claim"
          >
            <div className="story-top">
              <span>FROM YOUR WORDS TO THE NEXT STEP</span>
              <span>01 — 03</span>
            </div>
            <div className="voice-card">
              <div className="card-label">
                <span className="icon">↗</span>
                <div>
                  <strong>You tell your story</strong>
                  <small>Example customer conversation</small>
                </div>
                <span className="sound" aria-hidden="true">
                  ▂▅▃▇▅▂▅
                </span>
              </div>
              <blockquote>
                “A white ute clipped the back passenger side. I’m okay, but the
                door won’t open.”
              </blockquote>
              <div className="voice-footer">
                <span>Voice intake</span>
                <span>In your own words</span>
              </div>
            </div>
            <div className="connector">
              ↓ <span>The details come together</span>
            </div>
            <div className="record-card">
              <div className="record-top">
                <span className="label">CLAIM SUMMARY</span>
                <span className="badge">Human review</span>
              </div>
              <h3>One story. A clearer record.</h3>
              <dl>
                <div>
                  <dt>Damage reported</dt>
                  <dd>Rear passenger side</dd>
                </div>
                <div>
                  <dt>Vehicle condition</dt>
                  <dd>Drives · door won’t open</dd>
                </div>
                <div>
                  <dt>Third-party registration</dt>
                  <dd className="amber">Needs confirmation</dd>
                </div>
              </dl>
              <div className="source">
                <span>✓</span> Linked to what the customer said
              </div>
            </div>
            <div className="story-foot">
              <span>AI organises the details.</span>
              <strong>People make the decisions.</strong>
            </div>
          </div>
        </section>

        <div className="principles">
          <div className="wrap">
            <span>
              <b>01</b> A conversation, not a long form
            </span>
            <span>
              <b>02</b> Uncertainty stays visible
            </span>
            <span>
              <b>03</b> Human judgement stays in control
            </span>
          </div>
        </div>

        <section id="how" className="wrap section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">A LITTLE LESS TO DEAL WITH</div>
              <h2>
                From “what now?”
                <br />
                to a clear next step.
              </h2>
            </div>
            <p>
              You don’t need a perfect account of what happened. Start with what
              you know.
            </p>
          </div>
          <div className="steps">
            <article>
              <span className="step-number">01 / ADD PHOTOS</span>
              <div className="step-icon">⊞</div>
              <h3>Show the damage.</h3>
              <p>
                Upload photos of your vehicle from the roadside. They help the
                claims officer understand your account and the damage reported.
              </p>
            </article>
            <article>
              <span className="step-number">02 / TALK</span>
              <div className="step-icon">↗</div>
              <h3>Tell us what happened.</h3>
              <p>
                Start a browser call. The AI assistant collects the incident
                details and asks about anything that’s missing or unclear.
              </p>
            </article>
            <article>
              <span className="step-number">03 / HUMAN REVIEW</span>
              <div className="step-icon">✓</div>
              <h3>Let a person take it forward.</h3>
              <p>
                Your details come together in one record. A claims officer
                checks the information and decides what happens next.
              </p>
            </article>
          </div>
        </section>

        <section id="numbers" className="numbers-section">
          <div className="wrap section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">THE GAP</div>
                <h2>
                  Australian motor claims don’t fail at assessment. They fail at
                  the handover.
                </h2>
              </div>
              <p>
                Every figure below comes from the industry’s own compliance
                reporting or the financial ombudsman.
              </p>
            </div>
            <div className="stat-grid">
              {STATS.map((stat) => (
                <article key={stat.label} className="stat">
                  <p className="stat-label">{stat.label}</p>
                  <p className={`stat-value ${stat.tone}`.trim()}>
                    {stat.value}
                  </p>
                  <p className="stat-note">{stat.note}</p>
                </article>
              ))}
            </div>
            <ReadMore
              moreLabel="Read the full picture"
              lessLabel="Show less"
              intro={
                <p>
                  Comprehensive motor vehicle insurance is the most
                  complained-about insurance product in Australia. Motor claim
                  delays account for roughly one in four general insurance
                  complaints reaching the ombudsman — and delay in claim
                  handling was the single most complained-about issue across all
                  of financial services.
                </p>
              }
              more={
                <>
                  <p>
                    The Code Governance Committee’s data points at the
                    mechanism. The obligation to update a customer at least
                    every twenty business days was breached 18,350 times in one
                    year. More than half of the insurers who missed
                    claims-handling timeframes could not say by how many days —
                    a pattern the Committee described as structural rather than
                    individual error.
                  </p>
                  <p>
                    You cannot update a customer on a claim whose record is
                    incomplete, and you cannot measure a breach you never
                    captured cleanly. Both problems start in the first five
                    minutes.
                  </p>
                  <p className="footnote">
                    ASIC named insurance claims handling among its enforcement
                    priorities for 2026, and the redrafted General Insurance
                    Code of Practice is intended to be contractually
                    enforceable.
                  </p>
                </>
              }
            />

            <div className="insurers-block">
              <div className="eyebrow">NAMED INSURERS</div>
              <h3 className="insurers-title">The gap, brand by brand</h3>
              <p className="insurers-intro">
                Three insurers, three shapes of the same problem — a market
                reality check, not a rating. AFCA counts a dispute against the
                underwriting entity, not the brand on your card, so the name a
                customer trusts isn’t always the one anyone is measuring.
              </p>
              <div className="insurer-cards">
                {INSURER_STORIES.map((story) => (
                  <article className="insurer-card" key={story.name}>
                    <div className="insurer-wordmark">{story.name}</div>
                    <p className="insurer-stat">
                      <strong>{story.stat}</strong> {story.statLabel}
                    </p>
                    <dl className="insurer-points">
                      <div>
                        <dt>The gap</dt>
                        <dd>{story.gap}</dd>
                      </div>
                      <div>
                        <dt>The possibility</dt>
                        <dd>{story.possibility}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
              <p className="insurer-foot">
                Not affiliated with Allianz, AAMI or Budget Direct. Figures are
                public — see sources below.
              </p>
            </div>

            <div className="savings-block">
              <div className="savings-head">
                <h3 id="savings-heading">The case, modelled</h3>
                <span>250,000 motor claims a year · AUD</span>
              </div>
              <div className="formula-row">
                {FORMULA.map((item, index) =>
                  "op" in item ? (
                    <span
                      key={`op-${index}`}
                      className="formula-op"
                      aria-hidden="true"
                    >
                      {item.op}
                    </span>
                  ) : (
                    <div
                      key={item.label}
                      className={`formula-term${
                        item.highlight ? " formula-result" : ""
                      }`}
                    >
                      <span className="formula-figure">{item.value}</span>
                      <span className="formula-caption">{item.label}</span>
                    </div>
                  ),
                )}
              </div>
              <p className="formula-note">
                That’s the money before automation rate or run cost enter the
                picture. Work through both and $1.19m of it comes home net —
                swipe through the full working.
              </p>
              <CaseCarousel slides={CASE_SLIDES} />
            </div>

            <div className="sources-block">
              <ReadMore
                moreLabel="See more sources"
                lessLabel="Show fewer sources"
                more={
                  <ul className="source-list">
                    {SOURCES.map((source) => (
                      <li key={source}>{source}</li>
                    ))}
                  </ul>
                }
              />
              <p className="footnote">
                Automation rate, officer minutes per claim and voice run cost
                are modelled by us and labelled as such above. Everything else
                is published.
              </p>
            </div>
          </div>
        </section>

        <section id="record" className="review-section">
          <div className="wrap review-grid">
            <div>
              <div className="eyebrow">FOR THE PERSON ON THE OTHER SIDE</div>
              <h2>
                A claim to review.
                <br />
                Not a story to rebuild.
              </h2>
              <p>
                Give your claims team the account, the evidence and the
                unanswered questions in one place.
              </p>
              <ul className="benefits">
                <li>
                  <span>✓</span>
                  <div>
                    <h3>Check the source.</h3>
                    <p>
                      See the customer’s own words behind each captured detail.
                    </p>
                  </div>
                </li>
                <li>
                  <span>✓</span>
                  <div>
                    <h3>Know what needs a second look.</h3>
                    <p>
                      Missing details and conflicting evidence stay visible. The
                      assistant doesn’t fill the gaps by guessing.
                    </p>
                  </div>
                </li>
                <li>
                  <span>✓</span>
                  <div>
                    <h3>Keep the decision with your team.</h3>
                    <p>
                      Suggested routing supports review. It doesn’t decide
                      cover, liability or repairs.
                    </p>
                  </div>
                </li>
              </ul>
              <Link className="text-link" href={WORKSPACE}>
                Explore an example claim <span>↗</span>
              </Link>
            </div>
            <div className="officer-preview">
              <div className="workspace-bar">
                <span className="mini-brand">c↗</span> Officer workspace{" "}
                <span className="sample">EXAMPLE</span>
              </div>
              <div className="officer-body">
                <div className="label">MOTOR COLLISION / CLM-1024</div>
                <h3>Ready for a closer look.</h3>
                <span className="badge">Human review</span>
                <div className="evidence">
                  <div className="label">CUSTOMER ACCOUNT</div>
                  <p>
                    “I think I got his rego — it was one, something, S-D. Sorry,
                    I’m not certain on that.”
                  </p>
                  <small>Source: example call transcript</small>
                </div>
                <div className="flag">
                  <strong>
                    ! &nbsp; Confirm the other vehicle’s registration
                  </strong>
                  <p>
                    Partial registration only. Ask the customer to confirm
                    before completing this field.
                  </p>
                </div>
                <div className="decision">
                  <span>Recommended next step</span>
                  <strong>
                    Contact customer for missing detail <span>↗</span>
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="wrap section scope">
          <div>
            <div className="eyebrow">FOCUSED WHERE IT MATTERS</div>
            <h2>
              A better beginning.
              <br />A person-led outcome.
            </h2>
          </div>
          <div>
            <p className="large-copy">
              Claimaroo focuses on the first part of a motor collision claim:
              listening, collecting evidence and preparing a useful handover.
            </p>
            <p>
              It’s a hackathon prototype of a simpler intake experience. It
              doesn’t approve claims, determine fault or promise a settlement.
            </p>
          </div>
        </section>

        <section id="questions" className="wrap faq section">
          <div>
            <div className="eyebrow">A FEW THINGS TO KNOW</div>
            <h2>Before you start.</h2>
          </div>
          <div className="faq-list">
            <details>
              <summary>Is this a real insurance claim service?</summary>
              <p>
                No. This is a demonstration built for the Forward: AI in
                Business Hackathon. It isn’t connected to an insurer and doesn’t
                lodge a real claim. Use example information when exploring it.
              </p>
            </details>
            <details>
              <summary>When do I add my photos?</summary>
              <p>
                Before the call. Show the damage first, then talk through what
                happened. Photos help the assistant ask better questions and
                give the claims officer a clearer record.
              </p>
            </details>
            <details>
              <summary>What if I don’t know all the details?</summary>
              <p>
                Say what you know. Missing or uncertain details are flagged for
                follow-up rather than filled in with a guess.
              </p>
            </details>
            <details>
              <summary>Does AI decide whether my claim is approved?</summary>
              <p>
                No. Claimaroo organises the information and suggests a review
                route. A claims officer retains responsibility for coverage,
                liability and next steps.
              </p>
            </details>
          </div>
        </section>

        <section className="wrap final-cta">
          <div className="eyebrow">LET’S TAKE THE FIRST STEP</div>
          <h2>
            You tell the story.
            <br />
            We’ll help with the details.
          </h2>
          <Link className="button primary" href="/claim">
            Try the claim experience <span>↗</span>
          </Link>
          <p>Photos and a browser call · Demonstration only</p>
        </section>
      </main>

      <footer className="wrap">
        <Link className="brand" href="/">
          claimaroo<span className="branddot">.</span>
        </Link>
        <p>
          Built for Forward: AI in Business Hackathon.
          <br />
          Motor collision intake · Australia
        </p>
        <span>Demonstration only. Not affiliated with an insurer.</span>
      </footer>
    </div>
  );
}
