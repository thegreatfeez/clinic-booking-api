import "dotenv/config";
const apiKey = process.env.API_KEY ?? "";
export const requireApiKey = (req, res, next) => {
    if (apiKey === "" || req.get("X-API-Key") !== apiKey) {
        return res.status(401).json({ error: "invalid or missing API key" });
    }
    next();
};
//# sourceMappingURL=apiKey.js.map