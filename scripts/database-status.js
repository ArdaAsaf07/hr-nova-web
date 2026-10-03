require("dotenv").config();

const pool = require("../db");

async function main() {
    const connection = await pool.query(
        "SELECT current_database() AS database_name, current_schema() AS schema_name, current_user AS database_user"
    );
    const tables = await pool.query(
        `SELECT schemaname, tablename
         FROM pg_tables
         WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
         ORDER BY schemaname, tablename`
    );
    const searchPath = await pool.query("SHOW search_path");

    console.log(connection.rows[0]);
    console.log({ search_path: searchPath.rows[0].search_path });
    console.table(tables.rows);
}

main()
    .catch(error => {
        console.error("Veritabanı durum hatası:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
