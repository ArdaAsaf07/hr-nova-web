require("dotenv").config();
const pool = require("../db");

(async () => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const employee = await client.query("SELECT id FROM employees ORDER BY id LIMIT 1");
        if (!employee.rowCount) throw new Error("Test için personel yok");
        const catalog = await client.query(
            "INSERT INTO training_catalog(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET is_active=TRUE RETURNING id",
            ["Yangın Eğitimi Test"]
        );
        await client.query(
            "INSERT INTO employee_training_status(employee_id,training_catalog_id,status) VALUES($1,$2,$3) ON CONFLICT(employee_id,training_catalog_id) DO UPDATE SET status=EXCLUDED.status",
            [employee.rows[0].id, catalog.rows[0].id, "Aldı"]
        );
        const linked = await client.query(
            "SELECT training_catalog.name FROM employee_training_status JOIN training_catalog ON training_catalog.id=employee_training_status.training_catalog_id WHERE employee_id=$1 AND training_catalog_id=$2",
            [employee.rows[0].id, catalog.rows[0].id]
        );
        if (linked.rows[0]?.name !== "Yangın Eğitimi Test") throw new Error("Bağlantı doğrulanamadı");
        await client.query("ROLLBACK");
        console.log("Personel-eğitim adı bağlantısı başarılı; test geri alındı.");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
