"use client";

import { ConversationProvider, useConversation } from "@elevenlabs/react";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { OrbBreathe } from "@/components/claim/orb-breathe";
import { TOOL_NAMES, type TranscriptEntry, type TranscriptRole } from "@/lib/types";
import "../claimaroo.css";

const WORKSPACE = "/claims";
const PHOTO_CAP = 8;

type Photo = {
  id: string;
  file: File;
  previewUrl: string;
  uploaded: boolean;
  uploading: boolean;
  evidenceId?: string;
  error?: string;
};

type TokenResponse = {
  agentId?: string;
  conversationToken?: string;
  error?: string;
};

type ToolBody = {
  ok?: boolean;
  result?: unknown;
  resultText?: string;
  error?: string;
};

type EvidenceBody = {
  evidenceId?: string;
  error?: string;
};

function readClaimId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const record = result as Record<string, unknown>;
  const id = record.claimId ?? record.claim_id;
  return typeof id === "string" && id.length > 0 ? id : null;
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function newLocalId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export default function ClaimPage() {
  return (
    <ConversationProvider>
      <ClaimIntake />
    </ConversationProvider>
  );
}

function ClaimIntake() {
  const { status, isSpeaking, startSession, endSession, sendContextualUpdate } =
    useConversation();

  const [photos, setPhotosState] = useState<Photo[]>([]);
  const [claimId, setClaimIdState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lodged, setLodged] = useState(false);
  const [libraryOver, setLibraryOver] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [filingFallback, setFilingFallback] = useState(false);

  const photosRef = useRef<Photo[]>([]);
  const claimIdRef = useRef<string | null>(null);
  const phoneRef = useRef(phone);
  const hasConnectedRef = useRef(false);
  const lodgingFallbackRef = useRef(false);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const transcriptSavedRef = useRef(0);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const lodgedHeadingRef = useRef<HTMLHeadingElement>(null);

  const logTurn = useCallback(
    (role: TranscriptRole, text: string, name?: string) => {
      const trimmed = text?.trim();
      if (!trimmed) return;
      transcriptRef.current = [
        ...transcriptRef.current,
        {
          at: new Date().toISOString(),
          role,
          text: trimmed,
          ...(name ? { name } : {}),
        },
      ];
    },
    [],
  );

  const persistTranscript = useCallback(async (id: string, final = false) => {
    const last = transcriptRef.current[transcriptRef.current.length - 1];
    if (final && last?.role !== "system") {
      logTurn("system", "Call ended.");
    }
    if (transcriptRef.current.length === transcriptSavedRef.current) return;
    transcriptSavedRef.current = transcriptRef.current.length;
    try {
      await fetch(`/api/claims/${encodeURIComponent(id)}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptRef.current }),
      });
    } catch {
      // Transcript is best-effort; claim persistence does not depend on it.
      transcriptSavedRef.current = 0;
    }
  }, [logTurn]);

  const setPhotos = useCallback((updater: (prev: Photo[]) => Photo[]) => {
    setPhotosState((prev) => {
      const next = updater(prev);
      photosRef.current = next;
      return next;
    });
  }, []);

  const setClaimId = useCallback((id: string) => {
    claimIdRef.current = id;
    setClaimIdState(id);
  }, []);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    phoneRef.current = phone;
  }, [phone]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (status !== "connected") return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  const lodgeFallbackIfNeeded = useCallback(async () => {
    if (claimIdRef.current || lodgingFallbackRef.current) {
      return claimIdRef.current;
    }
    const phoneValue = phoneRef.current.trim();
    if (!phoneValue) return null;

    lodgingFallbackRef.current = true;
    setFilingFallback(true);

    try {
      const customerResponse = await fetch("/api/tools/get_customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phoneValue }),
      });
      const customerBody = (await customerResponse.json()) as ToolBody;
      const customerResult = customerBody.result as
        | {
            found?: boolean;
            customer?: { id?: string };
            policy_ids?: string[];
          }
        | undefined;
      if (
        !customerResponse.ok ||
        customerBody.ok === false ||
        !customerResult?.found ||
        !customerResult.customer?.id ||
        !customerResult.policy_ids?.[0]
      ) {
        setError(
          customerBody.error ??
            "Could not match that mobile to a seeded customer. Use 0412 000 001 for Maya Chen.",
        );
        return null;
      }

      const createResponse = await fetch("/api/tools/create_claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customerResult.customer.id,
          policy_id: customerResult.policy_ids[0],
          incident_time: new Date().toISOString(),
          location: "Reported during voice intake",
          narrative:
            "Voice session ended without an agent create_claim tool call. Claim lodged from the intake page using the customer mobile on file.",
          structured_facts: { incidentType: "collision" },
        }),
      });
      const createBody = (await createResponse.json()) as ToolBody;
      const createdId = readClaimId(createBody.result);
      if (!createResponse.ok || createBody.ok === false || !createdId) {
        setError(createBody.error ?? "Fallback create_claim failed.");
        return null;
      }

      setClaimId(createdId);
      logTurn(
        "tool",
        "Voice session ended before the agent could file the claim. The intake page filed it using the policy mobile on record.",
        "create_claim",
      );
      await uploadPendingRef.current(createdId);
      void persistTranscript(createdId, true);
      // Mirror the tooled agent flow: analyse, coverage, triage. Best-effort —
      // a filed claim with partial enrichment beats a failed lodge.
      for (const name of ["analyse_damage", "run_coverage_check", "run_triage"] as const) {
        try {
          await fetch(`/api/tools/${name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ claim_id: createdId }),
          });
        } catch {
          // Enrichment is best-effort after fallback lodge.
        }
      }
      return createdId;
    } finally {
      lodgingFallbackRef.current = false;
      setFilingFallback(false);
    }
  }, [logTurn, persistTranscript, setClaimId]);

  const lodgeFallbackRef = useRef(lodgeFallbackIfNeeded);
  useEffect(() => {
    lodgeFallbackRef.current = lodgeFallbackIfNeeded;
  }, [lodgeFallbackIfNeeded]);

  useEffect(() => {
    if (status === "disconnected" && hasConnectedRef.current) {
      void (async () => {
        if (!claimIdRef.current) {
          await lodgeFallbackRef.current();
        }
        if (claimIdRef.current) {
          await persistTranscript(claimIdRef.current, true);
        }
        setLodged(true);
      })();
    }
  }, [status, persistTranscript]);

  useEffect(() => {
    if (lodged) lodgedHeadingRef.current?.focus();
  }, [lodged]);

  const uploadOne = useCallback(async (photo: Photo, id: string): Promise<Photo> => {
    if (photo.evidenceId || photo.uploaded) return photo;

    setPhotos((prev) =>
      prev.map((item) =>
        item.id === photo.id
          ? { ...item, uploading: true, error: undefined }
          : item,
      ),
    );

    try {
      const form = new FormData();
      form.set("claimId", id);
      form.set("file", photo.file);
      const response = await fetch("/api/evidence", {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as EvidenceBody;
      if (!response.ok || !body.evidenceId) {
        throw new Error(body.error ?? "Photo upload failed.");
      }
      return {
        ...photo,
        uploaded: true,
        uploading: false,
        evidenceId: body.evidenceId,
        error: undefined,
      };
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Photo upload failed.";
      return {
        ...photo,
        uploading: false,
        uploaded: false,
        error: message,
      };
    }
  }, [setPhotos]);

  const uploadPending = useCallback(
    async (id: string) => {
      const pending = photosRef.current.filter(
        (photo) => !photo.evidenceId && !photo.uploaded,
      );
      const failures: string[] = [];
      for (const photo of pending) {
        const latest = photosRef.current.find((item) => item.id === photo.id);
        if (latest?.evidenceId || latest?.uploaded) continue;
        const updated = await uploadOne(photo, id);
        setPhotos((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
        if (updated.error) failures.push(updated.error);
      }
      if (failures.length > 0) {
        setUploadError(failures[0] ?? "Photo upload failed.");
      } else {
        setUploadError(null);
        const ids = photosRef.current
          .map((photo) => photo.evidenceId)
          .filter((value): value is string => Boolean(value));
        if (ids.length > 0) {
          try {
            sendContextualUpdate(`Uploaded ${ids.length} photos: ${ids.join(", ")}`);
          } catch {
            // Persistence does not depend on the agent receiving this update.
          }
        }
      }
    },
    [sendContextualUpdate, setPhotos, uploadOne],
  );

  const uploadPendingRef = useRef(uploadPending);
  useEffect(() => {
    uploadPendingRef.current = uploadPending;
  }, [uploadPending]);

  const clientTools = useMemo(() => {
    const tools: Record<
      string,
      (parameters: Record<string, unknown>) => Promise<string>
    > = {};
    for (const name of TOOL_NAMES) {
      tools[name] = async (parameters) => {
        logTurn("tool", `called with ${JSON.stringify(parameters).slice(0, 300)}`, name);
        const response = await fetch(`/api/tools/${name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parameters),
        });
        const body = (await response.json()) as ToolBody;
        if (name === "create_claim") {
          const createdId = readClaimId(body.result);
          if (createdId) {
            setClaimId(createdId);
            await uploadPendingRef.current(createdId);
            void persistTranscript(createdId);
          }
        }
        if (!response.ok || body.ok === false) {
          logTurn("tool", `failed: ${body.error ?? "unknown error"}`, name);
          return body.error ?? body.resultText ?? `${name} failed`;
        }
        logTurn("tool", "succeeded", name);
        return body.resultText ?? JSON.stringify(body.result ?? {});
      };
    }
    return tools;
  }, [logTurn, persistTranscript, setClaimId]);

  // Vercel Hobby caps request bodies at ~4.5MB. Re-encode oversized images so
  // real phone photos upload instead of failing evidence persistence.
  const downscaleImage = useCallback(async (file: File): Promise<File> => {
    const LIMIT = 3.5 * 1024 * 1024;
    if (file.size <= LIMIT || !file.type.startsWith("image/")) return file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.85),
      );
      if (!blob || blob.size >= file.size) return file;
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", {
        type: "image/jpeg",
      });
    } catch {
      return file;
    }
  }, []);

  const addFiles = useCallback(
    async (list: FileList | File[]) => {
      const incoming = Array.from(list).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (incoming.length === 0) return;

      const room = PHOTO_CAP - photosRef.current.length;
      const accepted = incoming.slice(0, Math.max(0, room));
      if (accepted.length === 0) return;

      const processed = await Promise.all(
        accepted.map((file) => downscaleImage(file)),
      );

      const added: Photo[] = processed.map((file) => ({
        id: newLocalId(),
        file,
        previewUrl: URL.createObjectURL(file),
        uploaded: false,
        uploading: false,
      }));

      setPhotos((prev) => [...prev, ...added]);

      const existingId = claimIdRef.current;
      if (existingId) {
        void (async () => {
          for (const photo of added) {
            const updated = await uploadOne(photo, existingId);
            setPhotos((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item)),
            );
            if (updated.error) setUploadError(updated.error);
          }
        })();
      }
    },
    [setPhotos, downscaleImage, uploadOne],
  );

  const removePhoto = useCallback(
    (id: string) => {
      const photo = photosRef.current.find((item) => item.id === id);
      if (!photo || photo.uploaded || photo.uploading) return;
      URL.revokeObjectURL(photo.previewUrl);
      setPhotos((prev) => prev.filter((item) => item.id !== id));
    },
    [setPhotos],
  );

  const retryPhoto = useCallback(
    async (id: string) => {
      const existingId = claimIdRef.current;
      const photo = photosRef.current.find((item) => item.id === id);
      if (!existingId || !photo || photo.evidenceId) return;
      const updated = await uploadOne(
        { ...photo, error: undefined, uploaded: false },
        existingId,
      );
      setPhotos((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      );
      setUploadError(updated.error ?? null);
    },
    [setPhotos, uploadOne],
  );

  const startCall = useCallback(async () => {
    if (photosRef.current.length === 0) return;
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
    } catch {
      setError(
        "Microphone access was blocked or unavailable. Use localhost or https.",
      );
      return;
    }

    const response = await fetch("/api/elevenlabs/token");
    const body = (await response.json()) as TokenResponse;
    if (!response.ok || (!body.agentId && !body.conversationToken)) {
      setError(body.error ?? "Unable to start the voice session.");
      return;
    }

    const session =
      body.agentId != null
        ? { agentId: body.agentId }
        : { conversationToken: body.conversationToken as string };

    const userId = sessionUserId ?? `session-${newLocalId()}`;
    setSessionUserId(userId);

    startSession({
      ...session,
      userId,
      clientTools,
      onConnect: () => {
        hasConnectedRef.current = true;
        try {
          sendContextualUpdate(
            `Customer mobile on screen: ${phoneRef.current}. ${photosRef.current.length} damage photo(s) are ready locally and will upload after create_claim. You MUST call get_customer with that phone, then create_claim, then attach_evidence and analyse_damage.`,
          );
        } catch {
          // Contextual updates are best-effort.
        }
      },
      onMessage: (message) => {
        logTurn(
          message.source === "user" ? "user" : "agent",
          message.message,
        );
      },
      onError: (message) => {
        setError(typeof message === "string" ? message : String(message));
      },
      onUnhandledClientToolCall: (tool) => {
        setError(`The agent called an unknown tool: ${tool.tool_name}`);
      },
    });
  }, [clientTools, logTurn, sessionUserId, startSession, sendContextualUpdate]);

  const reset = useCallback(() => {
    for (const photo of photosRef.current) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    photosRef.current = [];
    claimIdRef.current = null;
    hasConnectedRef.current = false;
    lodgingFallbackRef.current = false;
    transcriptRef.current = [];
    transcriptSavedRef.current = 0;
    setPhotosState([]);
    setClaimIdState(null);
    setSessionUserId(null);
    setError(null);
    setUploadError(null);
    setLodged(false);
    setFilingFallback(false);
    setElapsed(0);
  }, []);

  const persistedCount = photos.filter((photo) => photo.evidenceId).length;
  const live = status === "connected";
  const connecting = status === "connecting";
  const canStart =
    photos.length > 0 &&
    phone.trim().length >= 8 &&
    status === "disconnected" &&
    !lodged &&
    !filingFallback;

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
          <span>Customer intake</span>
          <Link href={WORKSPACE}>Officer workspace</Link>
        </div>
      </header>

      <main id="cl-main" className="cl-intake" tabIndex={-1}>
        {lodged ? (
          <LodgedView
            headingRef={lodgedHeadingRef}
            claimId={claimId}
            photoCount={persistedCount}
            onReset={reset}
          />
        ) : (
          <>
            <p className="cl-eyebrow">Lodge a claim</p>
            <h1 className="cl-h1">Let&apos;s get your claim started.</h1>
            <p className="cl-sub">
              Show us the damage, then talk us through what happened. It takes
              about three minutes.
            </p>

            <label className="cl-privacy" htmlFor="cl-phone" style={{ display: "block", marginTop: 16 }}>
              Mobile on your policy
            </label>
            <input
              id="cl-phone"
              className="cl-phone-input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0412 000 001"
              aria-describedby="cl-phone-hint"
              style={{
                display: "block",
                width: "100%",
                marginTop: 8,
                marginBottom: 8,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #c9cdd4",
                fontSize: 16,
              }}
            />
            <p id="cl-phone-hint" className="cl-privacy" style={{ marginTop: 0, marginBottom: 16 }}>
              Demo: Maya Chen is <strong>0412 000 001</strong>. If the voice agent
              does not file a claim, we lodge one with this number when the call
              ends.
            </p>

            <div className="cl-step-head">
              <h2>Show us the damage</h2>
              <span>
                {photos.length === 0
                  ? "Up to 8 photos"
                  : `${photos.length} added`}
              </span>
            </div>
            <p
              id="cl-photo-hint"
              className="cl-privacy"
              style={{ marginTop: 0, marginBottom: 12 }}
            >
              Take a clear photo of the damaged area or choose photos you have
              already taken.
            </p>

            <div className="cl-photo-actions">
              <label className="cl-photo-action" htmlFor="cl-photo-camera">
                Take Photo
                <span>Rear camera</span>
                <input
                  id="cl-photo-camera"
                  ref={cameraInputRef}
                  className="cl-visually-hidden"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  aria-describedby="cl-photo-hint"
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
              <label
                className={`cl-photo-action${libraryOver ? " cl-over" : ""}`}
                htmlFor="cl-photo-library"
                onDragOver={(event) => {
                  event.preventDefault();
                  setLibraryOver(true);
                }}
                onDragLeave={() => setLibraryOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setLibraryOver(false);
                  addFiles(event.dataTransfer.files);
                }}
              >
                Choose from Library
                <span>Existing photos</span>
                <input
                  id="cl-photo-library"
                  ref={libraryInputRef}
                  className="cl-visually-hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  aria-describedby="cl-photo-hint"
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            {photos.length > 0 ? (
              <ul className="cl-thumbs">
                {photos.map((photo, index) => (
                  <li key={photo.id} className="cl-thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.previewUrl}
                      alt={`Damage photo ${index + 1} of ${photos.length}`}
                    />
                    {!photo.uploaded && !photo.uploading ? (
                      <button
                        type="button"
                        className="cl-thumb-remove"
                        aria-label={`Remove damage photo ${index + 1}`}
                        onClick={() => removePhoto(photo.id)}
                      >
                        <RemoveIcon />
                      </button>
                    ) : null}
                    {photo.uploading ? (
                      <span className="cl-thumb-status">Uploading</span>
                    ) : null}
                    {photo.evidenceId ? (
                      <span className="cl-thumb-status">Saved</span>
                    ) : null}
                    {photo.error ? (
                      <button
                        type="button"
                        className="cl-thumb-status cl-failed"
                        aria-label={`Retry upload for damage photo ${index + 1}`}
                        onClick={() => void retryPhoto(photo.id)}
                      >
                        Retry
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            {photos.length > 0 ? (
              <p className="cl-privacy" aria-live="polite">
                {photos.length} photo{photos.length === 1 ? "" : "s"} added. You
                can add more before starting your call.
              </p>
            ) : null}

            <div className="cl-step-head">
              <h2>Tell us what happened</h2>
              <span>
                {live ? "In progress" : connecting ? "Connecting" : "About 3 min"}
              </span>
            </div>

            <section
              className="cl-card cl-call-card"
              aria-labelledby="cl-call-title"
              aria-busy={connecting || undefined}
            >
              <div className="cl-orb" aria-hidden="true">
                <OrbBreathe
                  width={180}
                  height={180}
                  dotColor="#16191D"
                  speed={live ? 70 : 45}
                />
              </div>
              <h2 id="cl-call-title">
                {live
                  ? "You're on the call"
                  : "Speak to our claims assistant"}
              </h2>
              <p>
                {live
                  ? "Take your time. If you're not sure about something, just say so — we'll flag it rather than guess."
                  : "The call happens right here in your browser. No phone number, no hold queue."}
              </p>
              {live ? (
                <div className="cl-live-line">
                  <span className="cl-dot cl-pulse" aria-hidden="true" />
                  <span aria-hidden="true">{formatElapsed(elapsed)}</span>
                  <span aria-live="polite">
                    {isSpeaking ? "Assistant speaking" : "Listening"}
                  </span>
                </div>
              ) : connecting ? (
                <div className="cl-live-line" aria-live="polite">
                  Connecting…
                </div>
              ) : null}
              {live ? (
                <button
                  type="button"
                  className="cl-btn cl-btn-danger"
                  onClick={() => endSession()}
                >
                  End the call
                </button>
              ) : (
                <button
                  type="button"
                  className="cl-btn cl-btn-primary"
                  disabled={connecting || filingFallback}
                  aria-disabled={
                    (!canStart && !connecting) || filingFallback
                      ? true
                      : undefined
                  }
                  aria-describedby={
                    [
                      !canStart && !connecting ? "cl-start-hint" : null,
                      error ? "cl-call-error" : null,
                      uploadError ? "cl-upload-error" : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  onClick={() => {
                    if (!canStart || connecting || filingFallback) return;
                    void startCall();
                  }}
                >
                  {filingFallback
                    ? "Filing claim…"
                    : connecting
                      ? "Connecting…"
                      : "Start the call"}
                </button>
              )}
              {filingFallback ? (
                <p className="cl-privacy" aria-live="polite">
                  Voice session ended without a filed claim — lodging with your
                  mobile now…
                </p>
              ) : null}
              {!canStart && !live && !connecting && !filingFallback ? (
                <p id="cl-start-hint" className="cl-privacy">
                  Add at least one photo and keep the policy mobile filled in.
                </p>
              ) : null}
              {error ? (
                <div id="cl-call-error" className="cl-error" role="alert">
                  {error}
                </div>
              ) : null}
              {uploadError ? (
                <div id="cl-upload-error" className="cl-error" role="alert">
                  {uploadError}
                </div>
              ) : null}
            </section>

            {sessionUserId ? (
              <p className="cl-ref-line">Session {sessionUserId}</p>
            ) : (
              <p className="cl-ref-line">A claim number is assigned during the call.</p>
            )}
            <p className="cl-privacy">
              We only record what you tell us, and you can stop at any time.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function LodgedView({
  headingRef,
  claimId,
  photoCount,
  onReset,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>;
  claimId: string | null;
  photoCount: number;
  onReset: () => void;
}) {
  const filed = Boolean(claimId);

  return (
    <>
      <p className="cl-eyebrow">{filed ? "Claim lodged" : "Call ended"}</p>
      <h1 ref={headingRef} className="cl-h1" tabIndex={-1}>
        {filed ? "That's with an officer now." : "No claim was filed."}
      </h1>
      <p className="cl-sub">
        {filed
          ? "Keep this reference handy."
          : "The call ended before a claim number was filed, so nothing was sent to the claims team."}
      </p>

      {filed ? (
        <article className="cl-card cl-card-pad" style={{ marginTop: 20 }}>
          <div className="cl-card-head">
            <h2 className="cl-card-title">Your claim reference</h2>
            <span className="cl-pill cl-pill-blue">Decision ready</span>
          </div>
          <p className="cl-lodged-ref">{claimId}</p>
          <p className="cl-privacy">
            {photoCount} photo{photoCount === 1 ? "" : "s"} received
          </p>
          <p className="cl-privacy">
            Your claim has been sent to the claims team.
          </p>
        </article>
      ) : (
        <article className="cl-card cl-card-pad" style={{ marginTop: 20 }}>
          <div className="cl-card-head">
            <h2 className="cl-card-title">Nothing was sent</h2>
          </div>
          <p className="cl-sub">
            Your photos stayed on your device and were not uploaded.
          </p>
          <p className="cl-privacy">
            To file the claim, lodge again and make sure the mobile number on
            your policy is filled in before the call — the claim is then filed
            from this page even if the call drops.
          </p>
        </article>
      )}

      <h2 className="cl-card-title" style={{ marginTop: 28 }}>
        What happens next
      </h2>
      <article className="cl-card cl-card-pad" style={{ marginTop: 12 }}>
        <ul className="cl-next-list">
          {filed ? (
            <li>
              Your call has been written up as a claim record, not just a
              recording, and your {photoCount}{" "}
              {photoCount === 1 ? "photo is" : "photos are"} attached to it.
            </li>
          ) : (
            <li>
              Because no claim was filed, nothing was assumed from the missing
              photos or the call — an officer will only see what you lodge next.
            </li>
          )}
          <li>
            Anything you were unsure about is flagged for a person to confirm
            with you, rather than assumed.
          </li>
          <li>
            An officer reviews the file and comes back to you with next steps on
            repairs. Nothing here is a coverage decision yet.
          </li>
        </ul>
      </article>

      <div className="cl-text-links">
        <button type="button" onClick={onReset}>
          Lodge another claim
        </button>
        {filed ? (
          <Link href={`${WORKSPACE}/${claimId}`}>View claim</Link>
        ) : null}
        <Link href={WORKSPACE}>See the officer&apos;s view</Link>
      </div>
    </>
  );
}

function RemoveIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path
        d="M2.5 2.5l7 7m0-7l-7 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
