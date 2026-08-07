import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../app.js";

describe("Web-to-API Authenticated Request Integration", () => {
  it("rejects unauthenticated GET /v1/groups with 401 Unauthorized", async () => {
    const res = await request(app).get("/v1/groups");
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error).toHaveProperty("code", "UNAUTHORIZED");
  });

  it("CORS preflight permits Authorization header and configured origin without wildcard", async () => {
    const res = await request(app)
      .options("/v1/groups")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "Authorization, Content-Type");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-headers"]).toContain("Authorization");
  });
});
