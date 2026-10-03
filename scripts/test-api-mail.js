require("dotenv").config();

const crypto = require("crypto");
const pool = require("../db");
const { hashPassword } = require("../lib/password");

const BASE_URL = process.env.HR_NOVA_BASE_URL || "http://localhost:3000";

async function main() {
    const username = `codex_api_test_${Date.now()}`;
    const password = `Test-${crypto.randomBytes(16).toString("hex")}Aa1`;

    try {
        await pool.query(
            `INSERT INTO users (username, display_name, password_hash, role)
             VALUES ($1, 'Geçici API Testi', $2, 'admin')`,
            [username, await hashPassword(password)]
        );

        const login = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            redirect: "manual",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username, password })
        });
        const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];

        if (!cookie) {
            throw new Error("API test oturumu açılamadı.");
        }

        const session = await fetch(`${BASE_URL}/api/session`, { headers: { cookie } });
        const sessionJson = await session.json();

        if (session.status !== 200 || !sessionJson.csrfToken) {
            throw new Error("API oturum ve CSRF bilgisi alınamadı.");
        }

        for (const path of ["/api/departments", "/api/employees", "/api/trainings"]) {
            const response = await fetch(`${BASE_URL}${path}`, { headers: { cookie } });

            if (response.status !== 200 || !Array.isArray((await response.json()).data)) {
                throw new Error(`API liste isteği başarısız: ${path}`);
            }
        }

        const blockedWrite = await fetch(`${BASE_URL}/api/departments`, {
            method: "POST",
            headers: { cookie, "content-type": "application/json" },
            body: JSON.stringify({ name: "Engellenmesi Gereken Test" })
        });

        if (blockedWrite.status !== 403) {
            throw new Error("CSRF tokensız API yazma isteği engellenmedi.");
        }

        const mailPage = await fetch(`${BASE_URL}/mail`, { headers: { cookie } });
        const mailHtml = await mailPage.text();

        if (mailPage.status !== 200 || !mailHtml.includes("Mail Merkezi")) {
            throw new Error("Mail Merkezi yüklenemedi.");
        }

        console.log("Mail Merkezi ve korumalı JSON API testleri başarılı.");
    } finally {
        await pool.query("DELETE FROM audit_logs WHERE actor_username = $1", [username]);
        await pool.query("DELETE FROM users WHERE username = $1", [username]);
        await pool.end();
    }
}

main().catch((error) => {
    console.error("API/Mail testi başarısız:", error.message);
    process.exitCode = 1;
});
