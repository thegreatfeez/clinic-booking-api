import "dotenv/config";
import { timingSafeEqual } from "node:crypto";
function keysMatch(provided, expected) {
    const providedBuffer = Buffer.from(provided, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (providedBuffer.length !== expectedBuffer.length) {
        return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
}
export const requireApiKey = (req, res, next) => {
    const expected = process.env.API_KEY ?? "";
    const provided = req.get("x-api-key") ?? "";
    if (expected === "" || provided === "" || !keysMatch(provided, expected)) {
        return res.status(401).json({ error: "invalid or missing API key" });
    }
    next();
};
//# sourceMappingURL=apiKey.js.map