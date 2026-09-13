"use client";

import { useId, useState, type ReactNode } from "react";

export function ReadMore({
  intro,
  more,
  moreLabel = "Read the full picture",
  lessLabel = "Show less",
}: {
  intro?: ReactNode;
  more: ReactNode;
  moreLabel?: string;
  lessLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="read-more">
      {intro ? <div className="read-more-intro">{intro}</div> : null}
      <div
        id={panelId}
        className={`read-more-panel${open ? " is-open" : ""}`}
        aria-hidden={!open}
      >
        <div className="read-more-panel-inner">{more}</div>
      </div>
      <button
        type="button"
        className="read-more-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? lessLabel : moreLabel}
        <span
          className={`read-more-chevron${open ? " is-open" : ""}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>
    </div>
  );
}
