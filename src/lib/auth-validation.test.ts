import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validateNewPassword,
  validateConfirmPassword,
  pluralizeZnak,
} from "./auth-validation";

describe("validateEmail", () => {
  it("empty string → wymagany", () => {
    expect(validateEmail("")).toBe("Email jest wymagany");
  });
  it("whitespace-only → wymagany", () => {
    expect(validateEmail("  ")).toBe("Email jest wymagany");
  });
  it("missing @ → niepoprawny", () => {
    expect(validateEmail("notanemail")).toBe("Podaj poprawny adres email");
  });
  it("missing TLD → niepoprawny", () => {
    expect(validateEmail("a@b")).toBe("Podaj poprawny adres email");
  });
  it("valid email → undefined", () => {
    expect(validateEmail("user@example.com")).toBeUndefined();
  });
  it("subdomain email → undefined", () => {
    expect(validateEmail("a@b.c")).toBeUndefined();
  });
});

describe("validatePassword (sign-in)", () => {
  it("empty → wymagane", () => {
    expect(validatePassword("")).toBe("Hasło jest wymagane");
  });
  it("non-empty → undefined", () => {
    expect(validatePassword("anyvalue")).toBeUndefined();
  });
});

describe("validateNewPassword", () => {
  it("empty → wymagane", () => {
    expect(validateNewPassword("", 6)).toBe("Hasło jest wymagane");
  });
  it("too short → co najmniej N znaków", () => {
    expect(validateNewPassword("abc", 6)).toBe("Hasło musi mieć co najmniej 6 znaków");
  });
  it("exact min length → undefined", () => {
    expect(validateNewPassword("abcdef", 6)).toBeUndefined();
  });
  it("longer than min → undefined", () => {
    expect(validateNewPassword("abcdefgh", 6)).toBeUndefined();
  });
  it("respects custom minLength", () => {
    expect(validateNewPassword("ab", 3)).toBe("Hasło musi mieć co najmniej 3 znaków");
  });
});

describe("validateConfirmPassword", () => {
  it("empty → Potwierdź", () => {
    expect(validateConfirmPassword("abc", "")).toBe("Potwierdź swoje hasło");
  });
  it("mismatch → nie zgadzają się", () => {
    expect(validateConfirmPassword("abc", "xyz")).toBe("Hasła się nie zgadzają");
  });
  it("match → undefined", () => {
    expect(validateConfirmPassword("abc", "abc")).toBeUndefined();
  });
});

describe("pluralizeZnak — all three Polish plural forms", () => {
  it("1 → znak", () => {
    expect(pluralizeZnak(1)).toBe("znak");
  });
  it("2 → znaki", () => {
    expect(pluralizeZnak(2)).toBe("znaki");
  });
  it("3 → znaki", () => {
    expect(pluralizeZnak(3)).toBe("znaki");
  });
  it("4 → znaki", () => {
    expect(pluralizeZnak(4)).toBe("znaki");
  });
  it("5 → znaków (was broken before fix)", () => {
    expect(pluralizeZnak(5)).toBe("znaków");
  });
  it("6 → znaków", () => {
    expect(pluralizeZnak(6)).toBe("znaków");
  });
  it("10 → znaków", () => {
    expect(pluralizeZnak(10)).toBe("znaków");
  });
});
