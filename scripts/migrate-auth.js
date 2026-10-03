require("dotenv").config();

const fs = require("fs");
const path = require("path");
const pool = require("../db");

async function main() {
    const migrationsDirectory = path.join(__dirname, "..", "migrations");
    const migrationFiles = fs.readdirSync(migrationsDirectory)
        .filter(fileName => fileName.endsWith(".sql"))
        .sort();

    for (const migrationFile of migrationFiles) {
        const migrationPath = path.join(migrationsDirectory, migrationFile);
        const sql = fs.readFileSync(migrationPath, "utf8");

        await pool.query(sql);
        console.log(`Migration hazır: ${migrationFile}`);
    }

    const result = await pool.query(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('users', 'admin_sessions', 'audit_logs')
         ORDER BY table_name`
    );

    console.log("Kimlik doğrulama tabloları hazır:", result.rows.map(row => row.table_name).join(", "));
}

main()
    .catch((error) => {
        console.error("Migration hatası:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
