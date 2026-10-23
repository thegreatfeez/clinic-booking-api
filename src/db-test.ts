import pool from "./db.js";

async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log(result.rows[0]);
  } catch (err) {
    console.error("Connection failed:", err);
  } finally {
    await pool.end();
  }
}

testConnection();