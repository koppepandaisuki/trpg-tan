import { describe, it, expect } from "vitest";
import { loginSchema, signupSchema } from "@/lib/validators/auth";

describe("loginSchema", () => {
  it("accepts a valid email + password", () => {
    const result = loginSchema.safeParse({
      email: "alice@example.com",
      password: "verysecret",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email format", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "verysecret" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "verysecret" });
    expect(result.success).toBe(false);
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = loginSchema.safeParse({ email: "a@b.co", password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects passwords longer than 72 characters (bcrypt limit)", () => {
    const result = loginSchema.safeParse({
      email: "a@b.co",
      password: "x".repeat(73),
    });
    expect(result.success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts a valid signup payload", () => {
    const result = signupSchema.safeParse({
      email: "alice@example.com",
      password: "verysecret",
      displayName: "Alice",
      agreedToTerms: true,
    });
    expect(result.success).toBe(true);
  });

  it("trims whitespace around displayName", () => {
    const result = signupSchema.safeParse({
      email: "a@b.co",
      password: "verysecret",
      displayName: "  Alice  ",
      agreedToTerms: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.displayName).toBe("Alice");
  });

  it("rejects empty displayName after trim", () => {
    const result = signupSchema.safeParse({
      email: "a@b.co",
      password: "verysecret",
      displayName: "   ",
      agreedToTerms: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects displayName longer than 50 characters", () => {
    const result = signupSchema.safeParse({
      email: "a@b.co",
      password: "verysecret",
      displayName: "x".repeat(51),
      agreedToTerms: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when agreedToTerms is false (TTTTT)", () => {
    const result = signupSchema.safeParse({
      email: "a@b.co",
      password: "verysecret",
      displayName: "Alice",
      agreedToTerms: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when agreedToTerms is missing", () => {
    const result = signupSchema.safeParse({
      email: "a@b.co",
      password: "verysecret",
      displayName: "Alice",
    });
    expect(result.success).toBe(false);
  });
});
