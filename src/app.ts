import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import type { ErrorRequestHandler } from "express";
import bookingsRouter from "./routes/bookings.js";
import slotsRouter from "./routes/slots.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use(slotsRouter);
app.use(bookingsRouter);

const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../client/dist");
app.use(express.static(clientDist));

app.use((req, res) => {
  res.status(404).json({ error: "not found" });
});

app.use(((err, req, res, next) => {
  const status = (err as { status?: unknown } | null)?.status;
  const code = typeof status === "number" && status >= 400 && status < 500 ? status : 500;

  if (code === 500) {
    console.error(err);
  }

  res.status(code).json({
    error: code === 500 ? "internal server error" : "invalid request"
  });
}) satisfies ErrorRequestHandler);

export default app;
