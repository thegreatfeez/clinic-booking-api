import type { RequestHandler } from "express";

/**
 * Lets the browser page call the same API routes without ever receiving the
 * server-side API key. The key is injected here, on the server, and the
 * destructive /reset route is not exposed through this bridge.
 */
export const webBridge: RequestHandler = (req, res, next) => {
  if (req.path === "/reset" || req.path.startsWith("/reset/")) {
    return res.status(404).json({ error: "not found" });
  }

  const key = process.env.API_KEY ?? "";

  if (key === "") {
    return res.status(503).json({ error: "booking service is not configured" });
  }

  req.headers["x-api-key"] = key;
  next();
};
