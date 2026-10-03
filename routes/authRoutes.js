const express = require("express");
const pool = require("../db");
const { verifyPassword } = require("../lib/password");
const {
    createSession,
    destroySession,
    requireAuth,
    verifyCsrf
} = require("../lib/auth");

const router = express.Router();
const attempts = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function attemptKey(req, username) {
    return `${req.ip || "unknown"}:${username}`;
}

function getAttemptState(key) {
    const state = attempts.get(key);

    if (!state || state.resetAt <= Date.now()) {
        attempts.delete(key);
        return { count: 0, resetAt: Date.now() + ATTEMPT_WINDOW_MS };
    }

    return state;
}

router.get("/login", (req, res) => {
    return res.render("login", {
        error: req.query.error || null
    });
});

router.post("/login", async (req, res) => {
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const key = attemptKey(req, username);
    const state = getAttemptState(key);

    if (state.count >= MAX_ATTEMPTS) {
        return res.status(429).render("login", {
            error: "Çok fazla başarısız deneme yapıldı. 15 dakika sonra tekrar deneyin."
        });
    }

    try {
        const result = await pool.query(
            `SELECT id, username, display_name, role, password_hash
             FROM users
             WHERE username = $1 AND is_active = TRUE`,
            [username]
        );

        const user = result.rows[0];
        const passwordIsValid = user && await verifyPassword(password, user.password_hash);

        if (!passwordIsValid) {
            attempts.set(key, {
                count: state.count + 1,
                resetAt: state.resetAt
            });

            return res.status(401).render("login", {
                error: "Kullanıcı adı veya parola hatalı."
            });
        }

        attempts.delete(key);
        await createSession(user.id, req, res);

        await pool.query(
            "UPDATE users SET last_login_at = NOW() WHERE id = $1",
            [user.id]
        );

        return res.redirect("/");
    } catch (error) {
        console.error("Giriş hatası:", error.message);

        return res.status(500).render("login", {
            error: "Giriş işlemi şu anda tamamlanamadı."
        });
    }
});

router.post("/logout", requireAuth, verifyCsrf, async (req, res) => {
    try {
        await destroySession(req, res);
    } catch (error) {
        console.error("Çıkış hatası:", error.message);
    }

    return res.redirect("/login");
});

module.exports = router;
