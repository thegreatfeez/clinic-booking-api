import { readFile } from "node:fs/promises";
import pool from "./db.js";
async function initDb() {
    try {
        const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
        await pool.query(schema);
        console.log("Schema applied");
        await pool.query(`INSERT INTO slots (id, provider, start_time, end_time)
       VALUES
         ('s1', 'Dr Ade', '2026-12-10T09:00:00Z', '2026-12-10T09:30:00Z'),
         ('s2', 'Dr Ade', '2026-12-10T10:00:00Z', '2026-12-10T10:30:00Z'),
         ('s3', 'Dr Bello', '2026-12-10T11:00:00Z', '2026-12-10T11:30:00Z')`);
        console.log("Sample slots inserted");
        const { rows } = await pool.query("SELECT id, provider, start_time, end_time FROM slots ORDER BY start_time");
        console.table(rows);
    }
    catch (err) {
        console.error("Database init failed:", err);
        process.exitCode = 1;
    }
    finally {
        await pool.end();
    }
}
initDb();
//# sourceMappingURL=init-db.js.map