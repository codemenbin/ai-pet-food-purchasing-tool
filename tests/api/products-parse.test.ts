import { testApiHandler } from "next-test-api-route-handler";
import { POST as parsePOST } from "@/app/api/products/parse/route";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ORIG = { ...process.env };

describe("POST /api/products/parse", () => {
  beforeAll(() => {
    process.env.DEMO_MODE = "1";
    process.env.LLM_MOCK = "1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("brand + name -> 200 with rule-based product", async () => {
    await testApiHandler({
      appHandler: { POST: parsePOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brand: "Acme", name: "Salmon Cat" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.product.id).toMatch(/^user-acme-salmon-cat-/);
        expect(body.source).toBe("rule");
        expect(body.confidence).toBeLessThanOrEqual(0.5);
      },
    });
  });

  it("missing brand -> 400", async () => {
    await testApiHandler({
      appHandler: { POST: parsePOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Y" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("invalid species enum -> 400", async () => {
    await testApiHandler({
      appHandler: { POST: parsePOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brand: "X", name: "Y", species: "fish" }),
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("invalid JSON -> 400", async () => {
    await testApiHandler({
      appHandler: { POST: parsePOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "not-json",
        });
        expect(res.status).toBe(400);
      },
    });
  });

  it("with ingredients: split into array", async () => {
    await testApiHandler({
      appHandler: { POST: parsePOST },
      async test({ fetch }) {
        const res = await fetch({
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ brand: "X", name: "Y", ingredients: "chicken, rice, fish oil" }),
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.product.ingredients).toEqual(["chicken", "rice", "fish oil"]);
      },
    });
  });
});
