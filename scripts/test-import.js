require("dotenv").config();

const crypto = require("crypto");
const ExcelJS = require("exceljs");
const pool = require("../db");
const { hashPassword } = require("../lib/password");

const BASE_URL = process.env.HR_NOVA_BASE_URL || "http://localhost:3000";

async function main() {
    const suffix = Date.now();
    const username = `codex_import_test_${suffix}`;
    const password = `Test-${crypto.randomBytes(16).toString("hex")}Aa1`;
    const testFirstName = `ExcelTest${suffix}`;

    try {
        await pool.query(
            `INSERT INTO users (username, display_name, password_hash, role)
             VALUES ($1, 'Geçici Excel Testi', $2, 'admin')`,
            [username, await hashPassword(password)]
        );

        const login = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            redirect: "manual",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username, password })
        });
        const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Personeller");
        worksheet.columns = [
            { header: "Ad", key: "firstName" },
            { header: "Soyad", key: "lastName" },
            { header: "Cinsiyet", key: "gender" },
            { header: "Eğitim Durumu", key: "educationStatus" }
        ];
        worksheet.addRow({
            firstName: testFirstName,
            lastName: "Personel",
            gender: "Belirtmek istemiyor",
            educationStatus: "Almadı"
        });
        const buffer = await workbook.xlsx.writeBuffer();
        const form = new FormData();
        form.append("excel_file", new Blob([buffer]), "test-personeller.xlsx");

        const preview = await fetch(`${BASE_URL}/employees/import/preview`, {
            method: "POST",
            headers: { cookie, origin: BASE_URL },
            body: form
        });
        const previewHtml = await preview.text();
        const batchToken = previewHtml.match(/name="batch_token" value="([^"]+)"/)?.[1];
        const csrfToken = previewHtml.match(/name="_csrf" value="([^"]+)"/)?.[1];

        if (preview.status !== 200 || !batchToken || !csrfToken) {
            throw new Error("Excel önizleme ve onay bilgileri oluşturulamadı.");
        }

        const confirm = await fetch(`${BASE_URL}/employees/import/confirm`, {
            method: "POST",
            redirect: "manual",
            headers: {
                cookie,
                origin: BASE_URL,
                "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({ batch_token: batchToken, _csrf: csrfToken })
        });

        const employee = await pool.query(
            "SELECT id FROM employees WHERE first_name = $1 AND last_name = 'Personel' AND education_status = 'Almadı'",
            [testFirstName]
        );

        if (confirm.status !== 302 || employee.rows.length !== 1) {
            throw new Error("Onaylanan Excel satırı personel tablosuna aktarılmadı.");
        }

        const secondConfirm = await fetch(`${BASE_URL}/employees/import/confirm`, {
            method: "POST",
            redirect: "manual",
            headers: {
                cookie,
                origin: BASE_URL,
                "content-type": "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({ batch_token: batchToken, _csrf: csrfToken })
        });

        if (secondConfirm.status !== 302) {
            throw new Error("Tekrar kullanılan aktarım paketi güvenli biçimde reddedilmedi.");
        }

        console.log("Excel önizleme, onay, kayıt ve tekrar kullanım koruması başarılı.");
    } finally {
        await pool.query("DELETE FROM employees WHERE first_name = $1 AND last_name = 'Personel'", [testFirstName]);
        await pool.query(
            "DELETE FROM employee_import_batches WHERE created_by IN (SELECT id FROM users WHERE username = $1)",
            [username]
        );
        await pool.query("DELETE FROM audit_logs WHERE actor_username = $1", [username]);
        await pool.query("DELETE FROM users WHERE username = $1", [username]);
        await pool.end();
    }
}

main().catch((error) => {
    console.error("Excel aktarım testi başarısız:", error.message);
    process.exitCode = 1;
});
