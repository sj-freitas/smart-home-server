import { toUuid, toSequence } from "./uuid.helper";

describe("toUuid", () => {
  it("converts a 32-hex string to a dashed UUID", () => {
    expect(toUuid("550e8400e29b41d4a716446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("normalises an already-dashed UUID to lowercase", () => {
    expect(toUuid("550E8400-E29B-41D4-A716-446655440000")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("strips surrounding braces", () => {
    expect(toUuid("{550e8400e29b41d4a716446655440000}")).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("throws when given fewer than 32 hex chars", () => {
    expect(() => toUuid("abc123")).toThrow(TypeError);
  });

  it("throws when given non-hex characters", () => {
    expect(() => toUuid("gggggggggggggggggggggggggggggggg")).toThrow(TypeError);
  });

  it("throws when input is not a string", () => {
    expect(() => toUuid(null as any)).toThrow(TypeError);
  });
});

describe("toSequence", () => {
  it("strips dashes from a UUID", () => {
    expect(toSequence("550e8400-e29b-41d4-a716-446655440000")).toBe(
      "550e8400e29b41d4a716446655440000",
    );
  });

  it("returns already-undashed input unchanged (lowercased)", () => {
    expect(toSequence("550E8400E29B41D4A716446655440000")).toBe(
      "550e8400e29b41d4a716446655440000",
    );
  });

  it("strips surrounding braces", () => {
    expect(toSequence("{550e8400-e29b-41d4-a716-446655440000}")).toBe(
      "550e8400e29b41d4a716446655440000",
    );
  });

  it("throws for invalid input", () => {
    expect(() => toSequence("not-a-uuid")).toThrow(TypeError);
  });

  it("throws when input is not a string", () => {
    expect(() => toSequence(42 as any)).toThrow(TypeError);
  });

  it("is the inverse of toUuid", () => {
    const seq = "550e8400e29b41d4a716446655440000";
    expect(toSequence(toUuid(seq))).toBe(seq);
  });
});
