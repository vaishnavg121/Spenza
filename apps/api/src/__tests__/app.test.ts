import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("Express API Foundation", () => {
  it("GET /health returns 200 operational liveness probe", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("timestamp");
  });

  it("GET /v1/health returns 200 versioned health contract", async () => {
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("status", "ok");
    expect(res.body.data).toHaveProperty("version", "0.1.0");
    expect(res.body.data).toHaveProperty("environment");
  });

  it("GET /unknown-route returns 404 with error envelope", async () => {
    const res = await request(app).get("/unknown-route");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "NOT_FOUND");
    expect(res.body.error).toHaveProperty("requestId");
  });

  it("propagates provided X-Request-Id header", async () => {
    const customRequestId = "test_req_123456789";
    const res = await request(app).get("/health").set("X-Request-Id", customRequestId);
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe(customRequestId);
  });

  it("generates X-Request-Id header when omitted", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(/^req_/);
  });

  it("handles malformed JSON body with 400 MALFORMED_JSON error envelope", async () => {
    const res = await request(app)
      .post("/health")
      .set("Content-Type", "application/json")
      .send("{ malformed json ");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "MALFORMED_JSON");
  });

  it("includes security headers from helmet and CORS headers", async () => {
    const res = await request(app)
      .get("/v1/health")
      .set("Origin", "http://localhost:3000");
    expect(res.status).toBe(200);
    expect(res.headers["x-dns-prefetch-control"]).toBe("off");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});
