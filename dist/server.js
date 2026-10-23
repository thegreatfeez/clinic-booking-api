import "dotenv/config";
import app from "./app.js";
if (!process.env.API_KEY) {
    console.warn("[auth] API_KEY is not set. Protected API routes will return 401 and /web routes will return 503.");
}
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
//# sourceMappingURL=server.js.map