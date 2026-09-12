import { describe, expect, it } from "vitest";
import {
  known,
  mapZone,
  percent,
  pretty,
  routeTone,
  statusTone,
} from "./claim-view";

describe("mapZone", () => {
  it("maps CLM-DEMO-A rear bumper to rear and leaves paintwork unplaced", () => {
    expect(mapZone("rear bumper")).toBe("rear");
    expect(mapZone("paintwork")).toBeNull();
  });

  it("leaves a side panel unplaced when left or right is missing", () => {
    expect(mapZone("side panel")).toBeNull();
  });

  it("maps explicit sides and lights", () => {
    expect(mapZone("left door")).toBe("left side");
    expect(mapZone("right side panel")).toBe("right side");
    expect(mapZone("right headlight")).toBe("right headlight");
    expect(mapZone("windscreen crack")).toBe("windscreen");
    expect(mapZone("roof dent")).toBe("roof");
  });

  it("does not guess when front and rear both appear", () => {
    expect(mapZone("front and rear bumper")).toBeNull();
  });
});

describe("officer view labels", () => {
  it("pretty-prints snake_case", () => {
    expect(pretty("conflicting_accounts")).toBe("Conflicting accounts");
  });

  it("keeps unknown distinct from no", () => {
    expect(known(null)).toBe("Unknown");
    expect(known(false)).toBe("No");
    expect(known(true)).toBe("Yes");
  });

  it("formats confidence and badge tones", () => {
    expect(percent(0.91)).toBe("91%");
    expect(percent(null)).toBe("Unknown");
    expect(statusTone("urgent")).toBe("urgent");
    expect(statusTone("decision_ready")).toBe("info");
    expect(routeTone("auto_path")).toBe("ready");
    expect(routeTone(null)).toBe("processing");
  });
});
