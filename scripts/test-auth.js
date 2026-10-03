require("dotenv").config();

const crypto = require("crypto");
const pool = require("../db");
const { hashPassword } = require("../lib/password");

const BASE_URL = "http://localhost:3000";

async function main() {
    const username = `codex_auth_test_${Date.now()}`;
    const displayName = "Geçici Güvenlik Testi";
    const password = `Test-${crypto.randomBytes(16).toString("hex")}Aa1`;

    try {
        const passwordHash = await hashPassword(password);

        await pool.query(
            `INSERT INTO users (username, display_name, password_hash, role)
             VALUES ($1, $2, $3, 'admin')`,
            [username, displayName, passwordHash]
        );

        const loginResponse = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            redirect: "manual",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username, password })
        });

        if (loginResponse.status !== 302) {
            throw new Error(`Başarılı giriş 302 yerine ${loginResponse.status} döndürdü.`);
        }

        const setCookie = loginResponse.headers.get("set-cookie");
        const cookie = setCookie && setCookie.split(";", 1)[0];

        if (!cookie) {
            throw new Error("Giriş yanıtında güvenli oturum çerezi bulunamadı.");
        }

        const dashboardResponse = await fetch(`${BASE_URL}/`, {
            redirect: "manual",
            headers: { cookie, origin: BASE_URL }
        });
        const dashboardHtml = await dashboardResponse.text();

        if (dashboardResponse.status !== 200 || !dashboardHtml.includes(displayName)) {
            throw new Error("Oturum açıldıktan sonra yönetici ekranı doğrulanamadı.");
        }

        const employeesResponse = await fetch(`${BASE_URL}/employees`, {
            headers: { cookie }
        });
        const employeesHtml = await employeesResponse.text();
        if (employeesResponse.status !== 200 || !employeesHtml.includes("Personel Yönetimi") || !employeesHtml.includes("/notifications")) {
            throw new Error("Ortak menülü Personel ekranı doğrulanamadı.");
        }

        const auditedResponse = await fetch(`${BASE_URL}/audit-test-not-a-route`, {
            method: "POST",
            redirect: "manual",
            headers: { cookie, origin: BASE_URL }
        });

        if (auditedResponse.status !== 404) {
            throw new Error("İşlem günlüğü test isteği beklenen 404 sonucunu vermedi.");
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const auditResult = await pool.query(
            `SELECT response_status
             FROM audit_logs
             WHERE actor_username = $1
               AND request_path = '/audit-test-not-a-route'
             ORDER BY id DESC
             LIMIT 1`,
            [username]
        );

        if (auditResult.rows[0]?.response_status !== 404) {
            throw new Error("Yönetici yazma isteği işlem günlüğüne kaydedilmedi.");
        }

        const logoutResponse = await fetch(`${BASE_URL}/logout`, {
            method: "POST",
            redirect: "manual",
            headers: { cookie, origin: BASE_URL }
        });

        if (logoutResponse.status !== 302) {
            throw new Error("Çıkış işlemi doğrulanamadı.");
        }

        const afterLogoutResponse = await fetch(`${BASE_URL}/`, {
            redirect: "manual",
            headers: { cookie }
        });

        if (afterLogoutResponse.status !== 302 || afterLogoutResponse.headers.get("location") !== "/login") {
            throw new Error("Çıkıştan sonra eski oturum geçersiz kılınmadı.");
        }

        console.log("Giriş, korunan ekran ve çıkış akışı başarılı.");
    } finally {
        await pool.query("DELETE FROM audit_logs WHERE actor_username = $1", [username]);
        await pool.query("DELETE FROM users WHERE username = $1", [username]);
        await pool.end();
    }
}

main().catch((error) => {
    console.error("Kimlik doğrulama testi başarısız:", error.message);
    process.exitCode = 1;
});
