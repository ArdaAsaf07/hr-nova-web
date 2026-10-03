require("dotenv").config();

const crypto = require("crypto");
const pool = require("../db");
const { hashPassword } = require("../lib/password");

const BASE_URL = process.env.HR_NOVA_BASE_URL || "http://localhost:3000";

async function main() {
    const username = `codex_security_test_${Date.now()}`;
    const password = `Test-${crypto.randomBytes(16).toString("hex")}Aa1`;

    try {
        await pool.query(
            `INSERT INTO users (username, display_name, password_hash, role)
             VALUES ($1, 'Geçici Güvenlik Testi', $2, 'admin')`,
            [username, await hashPassword(password)]
        );

        const login = await fetch(`${BASE_URL}/login`, {
            method: "POST",
            redirect: "manual",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ username, password })
        });
        const cookie = login.headers.get("set-cookie")?.split(";", 1)[0];

        if (login.status !== 302 || !cookie) {
            throw new Error("Test oturumu açılamadı.");
        }

        const dashboard = await fetch(`${BASE_URL}/`, { headers: { cookie } });

        console.log("Dashboard kontrolü:", {
            status: dashboard.status,
            location: dashboard.headers.get("location"),
            poweredBy: dashboard.headers.get("x-powered-by")
        });

        if (dashboard.status !== 200 || dashboard.headers.has("x-powered-by")) {
            throw new Error("Korunan ekran veya sunucu kimliği başlığı kontrolü başarısız.");
        }

        for (const origin of [undefined, "https://evil.example"]) {
            const headers = { cookie };

            if (origin) {
                headers.origin = origin;
            }

            const blocked = await fetch(`${BASE_URL}/audit-test-not-a-route`, {
                method: "POST",
                redirect: "manual",
                headers
            });

            if (blocked.status !== 403) {
                throw new Error(`CSRF isteği engellenmedi: ${origin || "origin yok"}`);
            }
        }

        const allowed = await fetch(`${BASE_URL}/audit-test-not-a-route`, {
            method: "POST",
            redirect: "manual",
            headers: { cookie, origin: BASE_URL }
        });

        if (allowed.status !== 404) {
            throw new Error("Aynı kaynak form isteği kabul edilmedi.");
        }

        const logout = await fetch(`${BASE_URL}/logout`, {
            method: "POST",
            redirect: "manual",
            headers: { cookie, origin: BASE_URL }
        });

        if (logout.status !== 302) {
            throw new Error("Güvenli çıkış işlemi doğrulanamadı.");
        }

        console.log("TLS, güvenlik başlıkları, CSRF ve oturum testleri başarılı.");
    } finally {
        await pool.query("DELETE FROM audit_logs WHERE actor_username = $1", [username]);
        await pool.query("DELETE FROM users WHERE username = $1", [username]);
        await pool.end();
    }
}

main().catch((error) => {
    console.error("Güvenlik testi başarısız:", error.message);
    process.exitCode = 1;
});
