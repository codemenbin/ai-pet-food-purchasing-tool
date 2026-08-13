import { testApiHandler } from "next-test-api-route-handler";
import { GET as healthGET } from "@/app/api/health/route";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const ORIG = { ...process.env };

describe("GET /api/health", () => {
  beforeAll(() => {
    process.env.LLM_API_KEY = "sk-test-xxxxxxxxxxxxxxxxxxxxxxxx";
    process.env.LLM_BASE_URL = "https://api.example.com/v1";
    process.env.LLM_MODEL = "test-model";
    process.env.DEMO_MODE = "1";
    process.env.LLM_MOCK = "1";
  });
  afterAll(() => {
    process.env = { ...ORIG };
  });

  it("returns mock=true and hasKey=true (key set, mock mode)", async () => {
    await testApiHandler({
      appHandler: { GET: healthGET },
      async test({ fetch }) {
        const res = await fetch({ method: "GET" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.mock).toBe(true);
        expect(body.hasKey).toBe(true);
        expect(body.baseURL).toBe("https://api.example.com/v1");
        expect(body.model).toBe("test-model");
        // 不暴露真实 Key
        expect(JSON.stringify(body)).not.toMatch(/sk-test-xxxx/);
      },
    });
  });

  it("mock=false when DEMO_MODE=0 and LLM_MOCK=0", async () => {
    const origDemo = process.env.DEMO_MODE;
    const origMock = process.env.LLM_MOCK;
    process.env.DEMO_MODE = "0";
    process.env.LLM_MOCK = "0";
    try {
      // 重新加载模块以让 module-level cache 重新生效
      const { __resetClient } = await import("@/lib/llm");
      __resetClient();
      await testApiHandler({
        appHandler: { GET: healthGET },
        async test({ fetch }) {
          const res = await fetch({ method: "GET" });
          expect(res.status).toBe(200);
          const body = await res.json();
          expect(body.mock).toBe(false);
          expect(body.hasKey).toBe(true);
        },
      });
    } finally {
      process.env.DEMO_MODE = origDemo;
      process.env.LLM_MOCK = origMock;
    }
  });

  it("hasKey=false when LLM_API_KEY unset", async () => {
    const origKey = process.env.LLM_API_KEY;
    delete process.env.LLM_API_KEY;
    try {
      const { __resetClient } = await import("@/lib/llm");
      __resetClient();
      await testApiHandler({
        appHandler: { GET: healthGET },
        async test({ fetch }) {
          const res = await fetch({ method: "GET" });
          const body = await res.json();
          expect(body.hasKey).toBe(false);
        },
      });
    } finally {
      process.env.LLM_API_KEY = origKey;
    }
  });
});
