import "dotenv/config";
import type { RequestHandler } from "express";

const apiKey = process.env.API_KEY ?? "";

export const requireApiKey: RequestHandler = (req, res, next) => {
  if (apiKey === "" || req.get("X-API-Key") !== apiKey) {
    return res.status(401).json({ error: "invalid or missing API key" });
  }

  next();
};
