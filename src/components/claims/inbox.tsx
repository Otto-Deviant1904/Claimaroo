"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CLAIM_STATUSES,
  type ClaimStatus,
  type TriageRoute,
} from "@/lib/types";
import {
  ROUTE_LABELS,
  STATUS_LABELS,
  dateLabel,
  pretty,
  routeTone,
  statusTone,
  timeLabel,
  type ClaimView,
} from "@/lib/claim-view";

function Badge({
  text,
  tone,
}: {
  text: string;
  tone: string;
}) {
  return <span className={`badge ${tone}`}>{text}</span>;
}

export function ClaimsInbox({
  claims,
  error,
}: {
  claims: ClaimView[];
  error: string | null;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [route, setRoute] = useState("all");

  const shown = useMemo(() => {
    const q = search.toLowerCase().trim();
    return claims
      .filter((claim) => (route === "all" || claim.route === route))
      .filter((claim) => (status === "all" || claim.status === status))
      .filter((claim) =>
        !q ||
        [
          claim.id,
          claim.policyId,
          claim.vehicle,
          claim.rego,
          claim.name,
          claim.location,
          claim.incident,
          ...claim.riskFlags,
        ].some((value) => String(value || "").toLowerCase().includes(q)),
      )
      .sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      );
  }, [claims, route, search, status]);

  const counts = {
    all: claims.length,
    auto_path: claims.filter((claim) => claim.route === "auto_path").length,
    human_review: claims.filter((claim) => claim.route === "human_review")
      .length,
    urgent: claims.filter((claim) => claim.route === "urgent").length,
  };

  return (
    <main id="inboxView">
      <div className="dashboard-heading">
        <div>
          <p className="dashboard-eyebrow">MOTOR CLAIMS</p>
          <h1>Claims dashboard</h1>
          <p className="dashboard-subtitle">
            Review vehicle claims and move each case forward.
          </p>
        </div>
        <span className="workspace-badge">Officer workspace</span>
      </div>
      <section className="summary-cards" aria-label="Claims summary">
        {(
          [
            ["all", "Total claims", counts.all, "All vehicle claims"],
            [
              "auto_path",
              "Standard path",
              counts.auto_path,
              "Routed to the standard process",
            ],
            [
              "human_review",
              "Human review",
              counts.human_review,
              "Requires officer assessment",
            ],
            [
              "urgent",
              "Urgent escalation",
              counts.urgent,
              "Prioritise these vehicle cases",
            ],
          ] as const
        ).map(([key, label, count, foot]) => (
          <button
            key={key}
            className={`summary-card ${key}`}
            type="button"
            aria-pressed={route === key}
            onClick={() => setRoute(key)}
          >
            <span className="summary-label">{label}</span>
            <strong>{count}</strong>
            <span className="summary-foot">{foot}</span>
          </button>
        ))}
      </section>
      <section className="dashboard-table">
        <div className="table-heading">
          <h2>
            Claims <span>{claims.length}</span>
          </h2>
          <span>Newest updated first</span>
        </div>
        <div className="dashboard-controls">
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search claim, vehicle, rego or policy…"
              aria-label="Search claims"
            />
          </label>
          <select
            aria-label="Filter by claim status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {CLAIM_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by route"
            value={route}
            onChange={(event) => setRoute(event.target.value)}
          >
            <option value="all">All routes</option>
            {(Object.keys(ROUTE_LABELS) as TriageRoute[]).map((value) => (
              <option key={value} value={value}>
                {ROUTE_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        {error ? (
          <div className="inline-error" role="alert">
            {error}
          </div>
        ) : null}
        {claims.length === 0 && !error ? (
          <div className="no-results">
            <h3>No claims yet</h3>
            <p>
              Seed the database with <code>npm run db:seed</code>.
            </p>
          </div>
        ) : null}
        <div className="claims-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Claim / Policy</th>
                <th>Vehicle</th>
                <th>Incident</th>
                <th>Status</th>
                <th>Route</th>
                <th>Risk flags</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Open case</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((claim) => (
                <tr key={claim.id}>
                  <td>
                    <Link
                      className="claim-id table-claim-link"
                      href={`/claims/${claim.id}`}
                    >
                      {claim.id}
                    </Link>
                    <small>{claim.policyId}</small>
                  </td>
                  <td>
                    <strong>{claim.vehicle}</strong>
                    <small>{claim.rego}</small>
                  </td>
                  <td>
                    {claim.incident}
                    <small>{dateLabel(claim.date)}</small>
                  </td>
                  <td>
                    <Badge
                      text={STATUS_LABELS[claim.status as ClaimStatus]}
                      tone={statusTone(claim.status)}
                    />
                  </td>
                  <td>
                    {claim.route ? (
                      <Badge
                        text={ROUTE_LABELS[claim.route]}
                        tone={routeTone(claim.route)}
                      />
                    ) : (
                      <span className="no-flags">Not routed</span>
                    )}
                  </td>
                  <td>
                    <div className="table-flags">
                      {claim.riskFlags.length ? (
                        claim.riskFlags.map((flag) => (
                          <Badge
                            key={flag}
                            text={pretty(flag)}
                            tone="review"
                          />
                        ))
                      ) : (
                        <span className="no-flags">None recorded</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <time>{timeLabel(claim.updatedAt)}</time>
                    <small>AEST</small>
                  </td>
                  <td>
                    <Link
                      className="open-case"
                      href={`/claims/${claim.id}`}
                      aria-label={`Open ${claim.id}`}
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && claims.length > 0 ? (
          <div className="no-results">
            <h3>No matching claims</h3>
            <p>Try another search or clear your filters.</p>
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("all");
                setRoute("all");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : null}
        <div className="table-count" aria-live="polite">
          Showing {shown.length} of {claims.length} claims
        </div>
      </section>
    </main>
  );
}
