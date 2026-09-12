"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CLAIM_STATUSES, TRIAGE_ROUTES } from "@/lib/types";
import {
  DAMAGE_ZONES,
  ROUTE_LABELS,
  STATUS_LABELS,
  dateLabel,
  known,
  mapZone,
  money,
  percent,
  pretty,
  routeTone,
  statusTone,
  timeLabel,
  type ClaimFindingView,
  type ClaimView,
  type DamageZone,
} from "@/lib/claim-view";

function Badge({ text, tone }: { text: string; tone: string }) {
  return <span className={`badge ${tone}`}>{text}</span>;
}

function panel(title: string, body: React.ReactNode, className = "") {
  return (
    <section className={`case-panel ${className}`}>
      <div className="case-panel-title">
        <h2>{title}</h2>
      </div>
      {body}
    </section>
  );
}

function kv(label: string, value: string) {
  return (
    <div className="kv" key={label}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Finding({ finding }: { finding: ClaimFindingView }) {
  return (
    <div className="finding">
      <div className="finding-title">
        <strong>{pretty(finding.area)}</strong>
        <Badge text={finding.severity} tone={finding.severity} />
      </div>
      <p>{finding.observation}</p>
      <div className="finding-meta">
        <Badge text={finding.source} tone="processing" />
        <span>Confidence: {percent(finding.confidence)}</span>
      </div>
    </div>
  );
}

function ZoneShape({ zone }: { zone: DamageZone }) {
  if (zone === "front") return <path d="M89 39 Q130 21 171 39 L183 70 H77 Z" />;
  if (zone === "rear") return <path d="M77 315 H183 L176 341 Q130 356 84 341 Z" />;
  if (zone === "windscreen") return <path d="M88 111 H172 L165 153 H95 Z" />;
  if (zone === "roof") return <rect x="96" y="163" width="68" height="96" rx="13" />;
  if (zone === "left side") return <path d="M74 107 H85 L92 160 V272 L79 309 H69 Z" />;
  if (zone === "right side") return <path d="M175 107 H186 L191 309 H181 L168 272 V160 Z" />;
  if (zone === "left headlight") return <rect x="77" y="80" width="25" height="19" rx="6" />;
  return <rect x="158" y="80" width="25" height="19" rx="6" />;
}

function DamageMap({ findings }: { findings: ClaimFindingView[] }) {
  const [zone, setZone] = useState<DamageZone | null>(null);
  const severityRank = { unknown: 0, minor: 1, moderate: 2, severe: 3 };
  const zones = DAMAGE_ZONES.map((name) => {
    const matches = findings.filter((finding) => mapZone(finding.area) === name);
    const severity = matches.length
      ? matches.reduce(
          (worst, finding) =>
            (severityRank[finding.severity] ?? 0) > (severityRank[worst] ?? 0)
              ? finding.severity
              : worst,
          "unknown" as ClaimFindingView["severity"],
        )
      : "neutral";
    return { name, matches, severity };
  });
  const selected = zone
    ? findings.filter((finding) => mapZone(finding.area) === zone)
    : [];

  return (
    <div className="damage-map">
      <div className="map-orientation">FRONT</div>
      <svg
        className="car-svg"
        viewBox="0 0 260 375"
        role="group"
        aria-label="Top-down vehicle damage diagram"
      >
        <path
          className="car-shell"
          d="M88 32 Q130 16 172 32 Q190 42 194 85 L201 309 Q198 350 170 356 H90 Q62 350 59 309 L66 85 Q70 42 88 32Z"
        />
        <g className="wheels">
          <rect x="48" y="91" width="12" height="49" rx="5" />
          <rect x="200" y="91" width="12" height="49" rx="5" />
          <rect x="47" y="275" width="12" height="43" rx="5" />
          <rect x="201" y="275" width="12" height="43" rx="5" />
        </g>
        <path className="car-window" d="M95 271 H165 L175 303 H85 Z" />
        {zones.map(({ name, matches, severity }) => (
          <g
            key={name}
            className={`car-zone ${severity}`}
            role={matches.length ? "button" : undefined}
            tabIndex={matches.length ? 0 : undefined}
            onClick={() => matches.length && setZone(name)}
            onKeyDown={(event) => {
              if (matches.length && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                setZone(name);
              }
            }}
            aria-label={
              matches.length
                ? `${name}: ${matches.map((finding) => finding.observation).join(" ")}`
                : undefined
            }
          >
            <title>
              {pretty(name)}:{" "}
              {matches.length
                ? matches
                    .map((finding) => `${finding.observation} (${finding.source})`)
                    .join("; ")
                : "No mapped finding"}
            </title>
            <ZoneShape zone={name} />
          </g>
        ))}
        <text x="130" y="216" className="roof-label" textAnchor="middle">
          ROOF
        </text>
        <text x="25" y="211" className="side-label">
          L
        </text>
        <text x="230" y="211" className="side-label">
          R
        </text>
      </svg>
      <div className="map-orientation">REAR</div>
      <div className="map-legend">
        <span>
          <i className="minor" />
          Minor
        </span>
        <span>
          <i className="moderate" />
          Moderate
        </span>
        <span>
          <i className="severe" />
          Severe
        </span>
        <span>
          <i className="unknown" />
          Unknown
        </span>
      </div>
      <p className="map-help">
        Select a highlighted area to inspect its findings.
      </p>
      <div className="zone-detail" aria-live="polite">
        {zone ? (
          <>
            <strong>{pretty(zone)}</strong>
            {selected.map((finding) => (
              <div key={`${finding.area}-${finding.observation}`}>
                <p>{finding.observation}</p>
                <small>
                  Source: {finding.source} · Confidence:{" "}
                  {percent(finding.confidence)}
                </small>
              </div>
            ))}
          </>
        ) : (
          "No area selected. Neutral areas have no mapped finding; they are not confirmed undamaged."
        )}
      </div>
    </div>
  );
}

export function CaseView({ claim }: { claim: ClaimView }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideRoute, setOverrideRoute] = useState("");
  const [showOverride, setShowOverride] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [pending, setPending] = useState(false);

  const findings = claim.assessment?.findings ?? [];
  const placed = findings.filter((finding) => mapZone(finding.area));
  const unplaced = findings.filter((finding) => !mapZone(finding.area));
  const incidentFacts = useMemo(
    () =>
      Object.entries(claim.facts).filter(
        ([key, value]) =>
          value != null && !/injur|passenger|emergency|human|person/i.test(key),
      ),
    [claim.facts],
  );

  async function performAction(action: string) {
    setError("");
    setPending(true);
    try {
      const payload: Record<string, string> = { action };
      if (action === "request_information" || action === "escalate") {
        if (!note.trim()) {
          throw new Error(
            action === "escalate"
              ? "Add a reason for escalation."
              : "Add a note describing the information required.",
          );
        }
        payload.note = note.trim();
      }
      if (action === "override") {
        if (!overrideStatus && !overrideRoute) {
          throw new Error("Choose a status or route to override.");
        }
        if (overrideStatus) payload.status = overrideStatus;
        if (overrideRoute) payload.route = overrideRoute;
      }
      const response = await fetch(`/api/claims/${encodeURIComponent(claim.id)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error || `HTTP ${response.status}`);
      }
      setToast("Claim updated on the live backend.");
      setNote("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <Link href="/claims" className="back-link">
        ← Claims dashboard
      </Link>
      <section className="case-header">
        <div>
          <div className="eyebrow">VEHICLE CASE · {claim.id}</div>
          <h1>{claim.vehicle}</h1>
          <div className="case-subtitle">
            <strong>{claim.rego}</strong>
            <span>·</span>
            <span>{claim.policyId || "Policy not captured"}</span>
            <span>·</span>
            <span>{claim.coverage.type || "Coverage unknown"}</span>
          </div>
          <div className="case-customer">
            {claim.name} · {claim.customerId}
            <br />
            Created {timeLabel(claim.createdAt)} · Updated{" "}
            {timeLabel(claim.updatedAt)} AEST
          </div>
        </div>
        <div className="header-tags">
          <Badge text={STATUS_LABELS[claim.status]} tone={statusTone(claim.status)} />
          {claim.route ? (
            <Badge text={ROUTE_LABELS[claim.route]} tone={routeTone(claim.route)} />
          ) : null}
        </div>
      </section>
      <div className="case-grid">
        <div className="case-column">
          {panel(
            "Incident",
            <>
              <dl className="kv-grid">
                {kv("Incident date", dateLabel(claim.date))}
                {claim.location ? kv("Location", claim.location) : null}
                {incidentFacts.map(([key, value]) =>
                  kv(pretty(key), known(value)),
                )}
              </dl>
              <div className="narrative">
                <h3>Original vehicle account</h3>
                <p>{claim.narrative}</p>
              </div>
            </>,
          )}
          {panel(
            "Coverage",
            <>
              <dl className="kv-grid">
                {kv("Coverage type", claim.coverage.type || "Unknown")}
                {kv(
                  "Excess (AUD)",
                  claim.coverage.excess == null
                    ? "Unknown"
                    : money(claim.coverage.excess),
                )}
                {kv("Policy status", claim.coverage.status || "Unknown")}
                {kv(
                  "Policy period",
                  claim.coverage.start && claim.coverage.end
                    ? `${dateLabel(claim.coverage.start)} – ${dateLabel(claim.coverage.end)}`
                    : "Unknown",
                )}
              </dl>
              <div className="coverage-check">
                <h3>
                  Preliminary coverage check{" "}
                  <Badge
                    text={pretty(claim.coverage.result)}
                    tone={
                      claim.coverage.result === "pass"
                        ? "ready"
                        : claim.coverage.result === "fail"
                          ? "urgent"
                          : "review"
                    }
                  />
                </h3>
                <p>{claim.coverage.notes}</p>
                {claim.coverage.rules.map((rule) => (
                  <blockquote key={`${rule.id}-${rule.text}`}>
                    {rule.text}
                    {rule.id ? <small>{rule.id}</small> : null}
                  </blockquote>
                ))}
              </div>
            </>,
          )}
          {panel(
            "Evidence",
            claim.evidence.length ? (
              <div className="evidence-grid">
                {claim.evidence.map((item) => (
                  <article className="evidence-card" key={item.filename}>
                    {item.src &&
                    /^image\/(jpeg|png|webp|gif)$/.test(item.mime) ? (
                      <a
                        className="evidence-image"
                        href={item.src}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${item.filename}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.src} alt={item.filename} />
                      </a>
                    ) : (
                      <div className="evidence-placeholder">
                        <span>▧</span>
                        <strong>{item.mime}</strong>
                        <small>Original file unavailable</small>
                      </div>
                    )}
                    <div className="evidence-caption">
                      <h3>{item.filename}</h3>
                      <small>
                        {item.uploadedAt
                          ? `${timeLabel(item.uploadedAt)} AEST`
                          : "Upload time unknown"}
                      </small>
                      <Badge
                        text={`Confidence: ${percent(item.confidence)}`}
                        tone="processing"
                      />
                      {item.limitations ? <p>{item.limitations}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="panel-empty">No evidence uploaded yet.</p>
            ),
          )}
        </div>
        <div className="case-column">
          {panel(
            "Assessment",
            claim.assessment ? (
              <>
                <div className="assessment-layout">
                  <DamageMap findings={findings} />
                  <div className="assessment-findings">
                    <div className="estimate">
                      <span className="eyebrow">
                        PRELIMINARY REPAIR ESTIMATE · AUD
                      </span>
                      <strong>
                        {claim.assessment.estimate
                          ? `${money(claim.assessment.estimate.min)} – ${money(claim.assessment.estimate.max)}`
                          : "Not yet established"}
                      </strong>
                      <p>
                        Suggested range only. Subject to inspection and a
                        repairer quote.
                      </p>
                    </div>
                    {placed.map((finding) => (
                      <Finding
                        key={`${finding.area}-${finding.observation}`}
                        finding={finding}
                      />
                    ))}
                    {unplaced.length ? (
                      <div className="unplaced">
                        <h3>
                          Location not established <span>{unplaced.length}</span>
                        </h3>
                        <p>
                          These findings cannot be placed on the vehicle without
                          guessing.
                        </p>
                        {unplaced.map((finding) => (
                          <Finding
                            key={`${finding.area}-${finding.observation}`}
                            finding={finding}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="assessment-notes">
                  <div>
                    <h3>Assumptions</h3>
                    {claim.assessment.assumptions.length ? (
                      <ul>
                        {claim.assessment.assumptions.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No assumptions recorded.</p>
                    )}
                  </div>
                  <div className="missing-info">
                    <h3>Missing information</h3>
                    {claim.assessment.missing.length ? (
                      <ul>
                        {claim.assessment.missing.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>No missing information recorded.</p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="panel-empty">No assessment yet.</p>
            ),
            "assessment-panel",
          )}
          {panel(
            "Risk & uncertainty",
            <>
              <div className="risk-flags">
                {claim.riskFlags.length ? (
                  claim.riskFlags.map((flag) => (
                    <Badge
                      key={flag}
                      text={pretty(flag)}
                      tone={claim.route === "urgent" ? "urgent" : "review"}
                    />
                  ))
                ) : (
                  <p className="muted">No vehicle risk flags recorded.</p>
                )}
              </div>
              <dl className="kv-grid">
                {kv("Assessment confidence", percent(claim.confidence))}
                {kv(
                  "Conflicting accounts",
                  known(claim.conflictingAccounts),
                )}
              </dl>
              <div className="route-reason">
                <h3>Route reason</h3>
                <p>{claim.routeReason}</p>
              </div>
            </>,
          )}
          {panel(
            "Recommended action",
            <>
              <p className="recommendation-text">{claim.recommendation}</p>
              <p className="non-binding">
                Non-binding — preliminary system suggestion only.
              </p>
            </>,
            "recommendation-panel",
          )}
        </div>
        {panel(
          "Actions",
          <>
            <div className="actions-top">
              <p>
                Move this vehicle claim to its next stage. Approval is not a
                final repair or coverage decision.
              </p>
            </div>
            <label className="action-note-label" htmlFor="actionNote">
              Note for information requests or escalation
            </label>
            <textarea
              id="actionNote"
              rows={2}
              maxLength={2000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Specify missing vehicle evidence or explain why this needs escalation…"
            />
            <div className="action-buttons">
              <button
                className="primary"
                type="button"
                disabled={pending || claim.status === "approved_next_stage"}
                onClick={() => performAction("approve_next_stage")}
              >
                ✓ Approve next stage
              </button>
              <button
                className="secondary"
                type="button"
                disabled={pending}
                onClick={() => performAction("request_information")}
              >
                Request information
              </button>
              <button
                className="secondary danger-button"
                type="button"
                disabled={pending}
                onClick={() => performAction("escalate")}
              >
                Escalate
              </button>
              <button
                className="secondary"
                type="button"
                aria-expanded={showOverride}
                aria-controls="overrideFields"
                onClick={() => setShowOverride((open) => !open)}
              >
                Override {showOverride ? "⌃" : "⌄"}
              </button>
            </div>
            {showOverride ? (
              <div className="override-fields" id="overrideFields">
                <label>
                  Status
                  <select
                    value={overrideStatus}
                    onChange={(event) => setOverrideStatus(event.target.value)}
                  >
                    <option value="">Keep current status</option>
                    {CLAIM_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Route
                  <select
                    value={overrideRoute}
                    onChange={(event) => setOverrideRoute(event.target.value)}
                  >
                    <option value="">Keep current route</option>
                    {TRIAGE_ROUTES.map((value) => (
                      <option key={value} value={value}>
                        {ROUTE_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary"
                  type="button"
                  disabled={pending || (!overrideStatus && !overrideRoute)}
                  onClick={() => performAction("override")}
                >
                  Apply override
                </button>
              </div>
            ) : null}
            {error ? (
              <p className="inline-error" role="alert">
                {error}
              </p>
            ) : null}
          </>,
          "full-span actions-panel",
        )}
        {panel(
          "Audit",
          claim.audit.length ? (
            <div className="audit-list">
              {[...claim.audit]
                .sort(
                  (a, b) =>
                    Date.parse(b.timestamp) - Date.parse(a.timestamp),
                )
                .map((event) => (
                  <div className="audit-event" key={`${event.timestamp}-${event.action}`}>
                    <time>{timeLabel(event.timestamp)} AEST</time>
                    <Badge text={event.actor} tone="processing" />
                    <div>
                      <strong>{pretty(event.action)}</strong>
                      <p>{event.result}</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="panel-empty">No audit events yet.</p>
          ),
          "full-span",
        )}
      </div>
      <div id="toast" className={toast ? "visible" : ""} role="status">
        {toast}
      </div>
    </main>
  );
}
