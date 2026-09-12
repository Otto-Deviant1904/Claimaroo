"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AudioFormat, CommitStrategy, useScribe } from "@elevenlabs/react";

export default function ScribePage() {
  const [isStarting, setIsStarting] = useState(false);
  const [isStreamingUrl, setIsStreamingUrl] = useState(false);
  const [audioUrl, setAudioUrl] = useState(
    "https://storage.googleapis.com/eleven-public-cdn/audio/marketing/nicole.mp3",
  );
  const [requestError, setRequestError] = useState<string | null>(null);
  const sessionReadyRef = useRef<{
    resolve: () => void;
    reject: (error: Error) => void;
  } | null>(null);
  const urlAbortRef = useRef<AbortController | null>(null);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    includeTimestamps: false,
    audioFormat: AudioFormat.PCM_16000,
    sampleRate: 16000,
    commitStrategy: CommitStrategy.MANUAL,
    onSessionStarted: () => {
      sessionReadyRef.current?.resolve();
      sessionReadyRef.current = null;
    },
    onError: (error) => {
      sessionReadyRef.current?.reject(
        error instanceof Error ? error : new Error("The Scribe connection failed."),
      );
      sessionReadyRef.current = null;
    },
  });
  const disconnect = scribe.disconnect;

  const startRecording = useCallback(async () => {
    setIsStarting(true);
    setRequestError(null);

    try {
      const response = await fetch("/api/scribe-token");
      const body = (await response.json()) as { token?: string; error?: string };

      if (!response.ok || !body.token) {
        throw new Error(body.error ?? "Unable to create a transcription session.");
      }

      await scribe.connect({
        token: body.token,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch (error) {
      setRequestError(
        error instanceof Error ? error.message : "Unable to start recording.",
      );
    } finally {
      setIsStarting(false);
    }
  }, [scribe]);

  const transcribeUrl = useCallback(async () => {
    const abortController = new AbortController();
    urlAbortRef.current = abortController;
    setIsStarting(true);
    setIsStreamingUrl(true);
    setRequestError(null);
    scribe.clearTranscripts();
    let audioContext: AudioContext | null = null;

    const cleanup = async () => {
      try {
        await audioContext?.close();
      } catch {
        // ignore close errors on abort
      }
      audioContext = null;
      scribe.disconnect();
      setIsStreamingUrl(false);
    };

    try {
      const response = await fetch("/api/scribe-token", {
        signal: abortController.signal,
      });
      const body = (await response.json()) as { token?: string; error?: string };

      if (!response.ok || !body.token) {
        throw new Error(body.error ?? "Unable to create a transcription session.");
      }

      const audioResponse = await fetch(audioUrl, {
        signal: abortController.signal,
      });
      if (!audioResponse.ok) {
        throw new Error("Unable to fetch the audio URL.");
      }

      const audioBuffer = await audioResponse.arrayBuffer();
      if (abortController.signal.aborted) {
        await cleanup();
        return;
      }
      audioContext = new AudioContext({ sampleRate: 16000 });
      const decodedAudio = await audioContext.decodeAudioData(audioBuffer);
      const channelData = decodedAudio.getChannelData(0);
      const pcmData = new Int16Array(channelData.length);

      for (let index = 0; index < channelData.length; index += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[index]));
        pcmData[index] = sample < 0 ? sample * 32768 : sample * 32767;
      }

      const sessionReady = new Promise<void>((resolve, reject) => {
        sessionReadyRef.current = { resolve, reject };
      });
      await scribe.connect({ token: body.token });
      await sessionReady;

      const chunkSize = 4096;
      for (let offset = 0; offset < pcmData.length; offset += chunkSize) {
        if (abortController.signal.aborted) {
          await cleanup();
          return;
        }
        const chunk = new Uint8Array(
          pcmData.slice(offset, offset + chunkSize).buffer,
        );
        let binary = "";
        for (const byte of chunk) {
          binary += String.fromCharCode(byte);
        }
        scribe.sendAudio(btoa(binary));
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      scribe.commit();
      await audioContext.close();
      audioContext = null;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      scribe.disconnect();
      setIsStreamingUrl(false);
    } catch (error) {
      await cleanup();
      if (abortController.signal.aborted) {
        return;
      }
      setRequestError(
        error instanceof Error ? error.message : "Unable to transcribe this audio URL.",
      );
    } finally {
      if (urlAbortRef.current === abortController) {
        urlAbortRef.current = null;
      }
      setIsStarting(false);
    }
  }, [audioUrl, scribe]);

  useEffect(() => {
    return () => {
      urlAbortRef.current?.abort();
      sessionReadyRef.current?.reject(new Error("Transcription cancelled."));
      sessionReadyRef.current = null;
      disconnect();
    };
  }, [disconnect]);

  const isActive = scribe.isConnected || isStarting;
  const displayedTranscripts = scribe.committedTranscripts.filter(
    (transcript, index, transcripts) =>
      index === 0 || transcript.text !== transcripts[index - 1].text,
  );
  const status =
    isStreamingUrl
      ? "Streaming audio"
      : scribe.status === "transcribing"
      ? "Listening"
      : scribe.status === "connecting" || isStarting
        ? "Connecting"
        : scribe.status === "error"
          ? "Connection error"
          : "Ready";
  const error = requestError ?? scribe.error;

  return (
    <main className="min-h-screen bg-[#f5f7fb] px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">
              F
            </div>
            <div>
              <p className="font-semibold tracking-tight">Forward AI</p>
              <p className="text-xs text-slate-500">Realtime conversation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm"
            >
              ← Status home
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              <span
                className={`size-2 rounded-full ${
                  scribe.isTranscribing ? "animate-pulse bg-emerald-500" : "bg-slate-300"
                }`}
              />
              {status}
            </div>
          </div>
        </header>

        <section className="my-auto grid gap-6 py-12 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/50 sm:p-10">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Scribe Realtime
            </p>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
              Talk naturally. See every word.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
              Stream your microphone directly to ElevenLabs and get a live
              transcript with low latency. Your API key stays safely on the server.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={
                  isActive
                    ? () => {
                        urlAbortRef.current?.abort();
                        urlAbortRef.current = null;
                        sessionReadyRef.current?.reject(
                          new Error("Transcription cancelled."),
                        );
                        sessionReadyRef.current = null;
                        scribe.disconnect();
                        setIsStreamingUrl(false);
                        setIsStarting(false);
                      }
                    : startRecording
                }
                disabled={isStarting && !isStreamingUrl}
                className={`rounded-full px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${
                  isActive
                    ? "bg-slate-900 hover:bg-slate-800"
                    : "bg-indigo-600 shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                }`}
              >
                {isStarting ? "Starting..." : isActive ? "Stop recording" : "Start recording"}
              </button>
              {scribe.committedTranscripts.length > 0 && (
                <button
                  type="button"
                  onClick={scribe.clearTranscripts}
                  className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Clear transcript
                </button>
              )}
            </div>

            <div className="mt-8 border-t border-slate-100 pt-6">
              <label
                htmlFor="audio-url"
                className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500"
              >
                Test with an audio URL
              </label>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  id="audio-url"
                  type="url"
                  value={audioUrl}
                  onChange={(event) => setAudioUrl(event.target.value)}
                  disabled={isActive}
                  className="min-w-0 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none ring-indigo-500 focus:ring-2 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={transcribeUrl}
                  disabled={isActive || !audioUrl.trim()}
                  className="rounded-full border border-indigo-200 px-5 py-3 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Transcribe URL
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                The URL must allow browser CORS requests.
              </p>
            </div>

            {error && (
              <p role="alert" className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}
          </div>

          <div className="flex min-h-[360px] flex-col rounded-3xl bg-slate-950 p-7 text-white shadow-xl shadow-slate-300/40 sm:p-8">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Live transcript</h2>
              <span className="text-xs text-slate-400">
                {displayedTranscripts.length}{" "}
                {displayedTranscripts.length === 1 ? "segment" : "segments"}
              </span>
            </div>
            <div className="mt-6 flex-1 space-y-4 overflow-auto">
              {scribe.committedTranscripts.length === 0 && !scribe.partialTranscript ? (
                <p className="text-sm leading-6 text-slate-500">
                  Your transcript will appear here once you start speaking.
                </p>
              ) : (
                <>
                  {displayedTranscripts.map((transcript) => (
                    <p key={transcript.id} className="text-sm leading-6 text-slate-200">
                      {transcript.text}
                    </p>
                  ))}
                  {scribe.partialTranscript && (
                    <p className="border-l-2 border-indigo-400 pl-3 text-sm leading-6 text-indigo-200">
                      {scribe.partialTranscript}
                    </p>
                  )}
                </>
              )}
            </div>
            <p className="mt-6 border-t border-white/10 pt-4 text-xs text-slate-500">
              Audio is streamed only while recording is active.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
