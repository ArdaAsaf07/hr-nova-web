require("dotenv").config();

const pool = require("../db");

async function main() {
    const result = await pool.query(
        `SELECT id, username, display_name, role, is_active, created_at
         FROM users
         ORDER BY id`
    );

    console.table(result.rows);
    console.log(`Toplam yönetici hesabı: ${result.rows.length}`);
}

main()
    .catch((error) => {
        console.error("Yönetici doğrulama hatası:", error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
