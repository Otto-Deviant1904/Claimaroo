// Live-backend adapter for the static officer dashboard.
// Tries http://localhost:3000 (Next API) first, falls back to the
// bundled fixtures in model.js when the backend is unreachable.
//
// Load order (see index.html): model.js -> app.js -> backend.js
// Top-level `let`/`function` bindings from classic scripts share scope,
// so this file can reassign `claims`, patch `M.STATUS`, override
// `performAction`, and re-render.
(function () {
  var BASE = (window.CLAIM_API_BASE || "http://localhost:3000").replace(/\/$/, "");
  var M = window.ClaimModel;
  if (!M) return;

  // Complete the status enum (fixtures only ship 6 of the 8 locked statuses).
  M.STATUS = Object.assign(
    { human_review: "Human review", urgent: "Urgent" },
    M.STATUS || {},
  );

  function confToNum(c) {
    return c === "high" ? 0.9 : c === "medium" ? 0.75 : c === "low" ? 0.55 : null;
  }

  function covResult(s) {
    return s === "likely_covered" ? "pass" : s === "not_covered" ? "fail" : "needs_review";
  }

  function mapCase(pack) {
    var claim = pack.claim || {};
    var customer = pack.customer || {};
    var policy = pack.policy || {};
    var sf = claim.structuredFacts || {};
    var veh = policy.vehicleMake || policy.vehicle_make
      ? (policy.vehicleYear || "") + " " + (policy.vehicleMake || "") + " " + (policy.vehicleModel || "")
      : "Vehicle unknown";
    var findings = (((pack.assessment || {}).damageFindings) || []).map(function (f) {
      return {
        area: f.area || "unspecified",
        severity: f.severity || "unknown",
        observation: f.observation || "",
        source: f.source || "heuristic",
        confidence: confToNum((pack.evidence || []).length ? pack.evidence[0].analysisConfidence : null),
      };
    });
    var ass = pack.assessment || null;
    return {
      id: claim.id,
      name: customer.name || "Unknown",
      customerId: customer.id || claim.customerId,
      vehicle: veh.trim(),
      rego: policy.registration || "",
      policyId: claim.policyId || policy.id,
      incident: sf.incidentType ? String(sf.incidentType).replace(/_/g, " ") : "Collision",
      date: (claim.incidentTime || "").slice(0, 10) || null,
      location: claim.location || null,
      narrative: claim.narrative || "No narrative captured.",
      status: claim.status || "decision_ready",
      route: claim.route || "human_review",
      riskFlags: claim.flags || [],
      updatedAt: claim.updatedAt || new Date().toISOString(),
      createdAt: claim.createdAt || claim.updatedAt || new Date().toISOString(),
      facts: {
        incident_type: sf.incidentType || null,
        vehicle_drivable: sf.vehicleDrivable ?? null,
        airbags_deployed: sf.airbagsDeployed ?? null,
        weather: sf.weather || null,
        other_vehicles: sf.otherVehicles ?? null,
        police_notified: sf.policeNotified ?? null,
        passengers: sf.passengers ?? null,
      },
      coverage: {
        type: policy.coverageType
          ? String(policy.coverageType).replace(/_/g, " ")
          : "Unknown",
        excess: policy.excessCents != null ? policy.excessCents / 100 : null,
        status: policy.status || "Unknown",
        start: policy.startDate || null,
        end: policy.endDate || null,
        result: covResult(claim.coverageStatus),
        notes: claim.coverageNotes || "Coverage has not been checked yet.",
        rules: (policy.relevantRules || []).map(function (r) {
          return typeof r === "string" ? { id: "", text: r } : r;
        }),
      },
      assessment: ass
        ? {
            estimate:
              ass.estimateLowCents != null && ass.estimateHighCents != null
                ? { min: ass.estimateLowCents / 100, max: ass.estimateHighCents / 100 }
                : null,
            findings: findings,
            assumptions: ass.assumptions || [],
            missing: ass.missingInformation || [],
          }
        : null,
      evidence: (pack.evidence || []).map(function (e) {
        return {
          filename: e.filename,
          mime: e.mimeType,
          uploadedAt: e.createdAt || null,
          confidence: confToNum(e.analysisConfidence),
          limitations: e.analysisLimitations || null,
          src: e.hasFile && e.fileUrl ? BASE + e.fileUrl : null,
        };
      }),
      confidence: confToNum(claim.confidence),
      conflictingAccounts: sf.conflictingAccounts ?? null,
      routeReason: claim.routeReason || "Not triaged yet.",
      recommendation: claim.recommendedAction || "Review the case.",
      audit: (pack.audit || []).map(function (a) {
        return {
          timestamp: a.timestamp,
          actor: a.actor,
          action: a.action,
          result: a.resultSummary || a.inputsSummary || a.action,
        };
      }),
    };
  }

  function setFooter(live, n) {
    var f = document.querySelector(".site-footer");
    if (f) {
      f.textContent = live
        ? "Live backend connected (" + BASE + ") · " + n + " claims · Actions persist to Postgres."
        : "Prototype · Actions are saved in this browser. No live claims API is connected.";
    }
  }

  function boot() {
    fetch(BASE + "/api/claims")
      .then(function (r) {
        if (!r.ok) throw new Error("list failed: " + r.status);
        return r.json();
      })
      .then(function (data) {
        var rows = (data && data.claims) || [];
        if (!rows.length) throw new Error("empty inbox");
        return Promise.all(
          rows.map(function (c) {
            return fetch(BASE + "/api/claims/" + encodeURIComponent(c.id)).then(function (r) {
              if (!r.ok) throw new Error(c.id + ": " + r.status);
              return r.json();
            });
          }),
        );
      })
      .then(function (packs) {
        var mapped = packs.map(mapCase).filter(function (c) { return c && c.id; });
        if (!mapped.length) throw new Error("no cases");
        claims = mapped;
        try {
          localStorage.setItem("claimdesk-live-ids", JSON.stringify(mapped.map(function (c) { return c.id; })));
        } catch { /* ignore */ }
        setFooter(true, mapped.length);
        renderInbox();
        renderRoute();
        toast("Live backend connected — " + mapped.length + " claims from Postgres.");
      })
      .catch(function () {
        setFooter(false);
      });
  }

  // Officer actions: try the live API first, fall back to the local model.
  var localApply = (typeof performAction !== "undefined") ? performAction : null;
  performAction = function (action, note, override) {
    var id = (typeof currentId !== "undefined") ? currentId : null;
    var noteEl = document.querySelector("#actionNote");
    var noteText = ((note != null ? note : (noteEl ? noteEl.value : "")) || "").trim();
    var ov = override || {};
    if (!ov.status || !ov.route) {
      var s = document.querySelector("#overrideStatus");
      var r = document.querySelector("#overrideRoute");
      ov = { status: (s && s.value) || undefined, route: (r && r.value) || undefined };
    }
    if (!id) {
      if (localApply) return localApply(action, note, override);
      return;
    }
    var payload = { action: action };
    if (action === "request_information" || action === "escalate") payload.note = noteText;
    if (action === "override") {
      if (ov.status) payload.status = ov.status;
      if (ov.route) payload.route = ov.route;
    }
    fetch(BASE + "/api/claims/" + encodeURIComponent(id) + "/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) { return res.json().then(function (b) { return { res: res, body: b }; }); })
      .then(function (out) {
        if (!out.res.ok) throw new Error((out.body && out.body.error) || ("HTTP " + out.res.status));
        return fetch(BASE + "/api/claims/" + encodeURIComponent(id)).then(function (r) {
          if (!r.ok) throw new Error("reload: " + r.status);
          return r.json();
        });
      })
      .then(function (pack) {
        var fresh = mapCase(pack);
        var i = -1;
        for (var k = 0; k < claims.length; k++) {
          if (claims[k].id === id) { i = k; break; }
        }
        if (i >= 0) claims[i] = fresh;
        renderCase();
        renderInbox();
        toast("Claim updated on the live backend.");
      })
      .catch(function (err) {
        if (localApply) {
          try {
            localApply(action, note, override);
            toast("Backend unreachable — saved locally. (" + err.message + ")");
            return;
          } catch (e) {
            var el = document.querySelector("#actionError");
            if (el) el.textContent = e.message;
            return;
          }
        }
        var el2 = document.querySelector("#actionError");
        if (el2) el2.textContent = err.message;
      });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
