import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, test } from "node:test";
import express from "express";

// Synthetic value only. Tests must never use the real API_KEY.
const TEST_API_KEY = "test-key-not-a-real-credential";
process.env.API_KEY = TEST_API_KEY;

const { requireApiKey } = await import("../src/middleware/apiKey.js");
const { webBridge } = await import("../src/middleware/webBridge.js");

const app = express();

app.get("/protected", requireApiKey, (req, res) => {
  res.json({ ok: true });
});

app.use("/web", webBridge);
app.get("/web/protected", requireApiKey, (req, res) => {
  res.json({ ok: true });
});
app.post("/web/reset", (req, res) => {
  res.json({ reset: true });
});

const server = app.listen(0);
const { port } = server.address() as AddressInfo;

function url(path: string): string {
  return `http://127.0.0.1:${port}${path}`;
}

function restoreApiKey(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.API_KEY;
  } else {
    process.env.API_KEY = value;
  }
}

after(() => {
  server.closeAllConnections();
  server.close();
});

test("missing key returns 401 JSON", async () => {
  const response = await fetch(url("/protected"));

  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);
  assert.deepEqual(await response.json(), { error: "invalid or missing API key" });
});

test("invalid key returns 401", async () => {
  const response = await fetch(url("/protected"), {
    headers: { "x-api-key": "definitely-wrong" }
  });

  assert.equal(response.status, 401);
});

test("valid key reaches the route", async () => {
  const response = await fetch(url("/protected"), {
    headers: { "x-api-key": TEST_API_KEY }
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("header name is case-insensitive", async () => {
  const response = await fetch(url("/protected"), {
    headers: { "X-API-KEY": TEST_API_KEY }
  });

  assert.equal(response.status, 200);
});

test("fails closed when API_KEY is not configured", async () => {
  const saved = process.env.API_KEY;
  delete process.env.API_KEY;

  try {
    const response = await fetch(url("/protected"), {
      headers: { "x-api-key": TEST_API_KEY }
    });

    assert.equal(response.status, 401);
  } finally {
    restoreApiKey(saved);
  }
});

test("web bridge authorizes browser requests without a client key", async () => {
  const response = await fetch(url("/web/protected"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("web bridge overrides a client-supplied key", async () => {
  const response = await fetch(url("/web/protected"), {
    headers: { "x-api-key": "client-supplied-value" }
  });

  assert.equal(response.status, 200);
});

test("web bridge never exposes the reset route", async () => {
  const response = await fetch(url("/web/reset"), { method: "POST" });

  assert.equal(response.status, 404);
});

test("web bridge returns 503 when API_KEY is missing", async () => {
  const saved = process.env.API_KEY;
  delete process.env.API_KEY;

  try {
    const response = await fetch(url("/web/protected"));

    assert.equal(response.status, 503);
  } finally {
    restoreApiKey(saved);
  }
});
