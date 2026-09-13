"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type CaseCarouselRow = {
  label: string;
  value: string;
  derived?: boolean;
  total?: boolean;
};

export type CaseCarouselSlide = {
  eyebrow: string;
  title: string;
  rows?: CaseCarouselRow[];
  body?: string;
  cta?: { label: string; href: string };
};

export function CaseCarousel({ slides }: { slides: CaseCarouselSlide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const track = trackRef.current;
    const target = track?.children[index];
    if (target instanceof HTMLElement) {
      target.scrollIntoView({
        behavior: "smooth",
        inline: "start",
        block: "nearest",
      });
    }
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = track.clientWidth || 1;
        const index = Math.round(track.scrollLeft / width);
        setActive((prev) => (prev === index ? prev : index));
      });
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      track.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div className="case-carousel">
      <div className="case-track" ref={trackRef}>
        {slides.map((slide) => (
          <article className="case-slide" key={slide.title}>
            <span className="case-eyebrow">{slide.eyebrow}</span>
            <h4 className="case-title">{slide.title}</h4>
            {slide.rows ? (
              <div className="case-rows">
                {slide.rows.map((row) => (
                  <div
                    key={row.label}
                    className={`case-row${row.total ? " is-total" : ""}${
                      row.derived ? " is-derived" : ""
                    }`}
                  >
                    <span className="case-row-label">{row.label}</span>
                    <span className="case-row-value">{row.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {slide.body ? <p className="case-body">{slide.body}</p> : null}
            {slide.cta ? (
              <Link className="case-cta" href={slide.cta.href}>
                {slide.cta.label} <span aria-hidden="true">↓</span>
              </Link>
            ) : null}
          </article>
        ))}
      </div>

      <div className="case-controls">
        <button
          type="button"
          className="case-arrow"
          aria-label="Previous"
          onClick={() => scrollToIndex(Math.max(0, active - 1))}
          disabled={active === 0}
        >
          ←
        </button>
        <div className="case-dots" role="tablist" aria-label="Case slides">
          {slides.map((slide, index) => (
            <button
              key={slide.title}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-label={slide.title}
              className={`case-dot${active === index ? " is-active" : ""}`}
              onClick={() => scrollToIndex(index)}
            />
          ))}
        </div>
        <button
          type="button"
          className="case-arrow"
          aria-label="Next"
          onClick={() => scrollToIndex(Math.min(slides.length - 1, active + 1))}
          disabled={active === slides.length - 1}
        >
          →
        </button>
      </div>
    </div>
  );
}
