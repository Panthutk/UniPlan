import { describe, it, expect } from 'vitest';

const ALLOWED = new Set(["text/csv","application/csv","application/vnd.ms-excel"]);
const isOk = (name: string, type: string, size: number) =>
  name.toLowerCase().endsWith(".csv") && (!type || ALLOWED.has(type)) && size <= 1_000_000;

describe("import guard", () => {
  it("accepts csv", () => {
    expect(isOk("a.csv","text/csv",123)).toBe(true);
  });
  it("rejects mp4", () => {
    expect(isOk("v.mp4","video/mp4",123)).toBe(false);
  });
  it("rejects large files", () => {
    expect(isOk("a.csv","text/csv",2_000_000)).toBe(false);
  });
});
