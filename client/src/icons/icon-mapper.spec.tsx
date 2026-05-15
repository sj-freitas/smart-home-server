import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { getIconFromId } from "./icon-mapper";

function renderIcon(icon?: string, size?: string) {
  const { container } = render(<>{getIconFromId(icon, size)}</>);
  return container.querySelector("svg");
}

describe("getIconFromId", () => {
  it("returns an SVG element for a known icon id", () => {
    expect(renderIcon("lamp")).not.toBeNull();
  });

  it("returns an SVG element for every registered icon id", () => {
    const knownIds = [
      "wind", "lamp", "music_note", "television", "ceiling_light",
      "desk_lamp", "ceiling_lamp", "sofa", "single_bed", "double_bed",
      "pan", "air_conditioner", "fan", "bathtub", "recessed_light",
      "dining_table", "heater", "thermometer", "water_drop",
    ];
    for (const id of knownIds) {
      expect(renderIcon(id), `expected SVG for icon "${id}"`).not.toBeNull();
    }
  });

  it("falls back to a home icon for an unknown id", () => {
    // Unknown IDs and undefined both render the fallback — we just check an
    // SVG is returned rather than null/undefined.
    expect(renderIcon("does_not_exist")).not.toBeNull();
  });

  it("falls back gracefully when icon is undefined", () => {
    expect(renderIcon(undefined)).not.toBeNull();
  });

  it("passes the size string through to the SVG", () => {
    const { container } = render(<>{getIconFromId("lamp", "32")}</>);
    const svg = container.querySelector("svg");
    // react-icons sets width/height attributes from the size prop
    expect(svg?.getAttribute("width") ?? svg?.getAttribute("height")).toBe("32");
  });

  it("uses 18 as the default size", () => {
    const { container } = render(<>{getIconFromId("lamp")}</>);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width") ?? svg?.getAttribute("height")).toBe("18");
  });
});
