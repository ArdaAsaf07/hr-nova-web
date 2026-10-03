const crypto = require("crypto");
const pool = require("../db");

const COOKIE_NAME = "hr_nova_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

function parseCookies(cookieHeader = "") {
    return cookieHeader.split(";").reduce((cookies, item) => {
        const separatorIndex = item.indexOf("=");

        if (separatorIndex === -1) {
            return cookies;
        }

        const key = item.slice(0, separatorIndex).trim();
        const value = item.slice(separatorIndex + 1).trim();

        if (key) {
            cookies[key] = decodeURIComponent(value);
        }

        return cookies;
    }, {});
}

function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function createCsrfToken(sessionToken) {
    return hashToken(`csrf:${sessionToken}`);
}

function getSessionToken(req) {
    return parseCookies(req.headers.cookie)[COOKIE_NAME] || null;
}

async function createSession(userId, req, res) {
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await pool.query(
        `INSERT INTO admin_sessions
            (user_id, token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5)`,
        [
            userId,
            tokenHash,
            expiresAt,
            req.ip || null,
            String(req.get("user-agent") || "").slice(0, 500) || null
        ]
    );

    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_DURATION_MS,
        path: "/"
    });
}

async function destroySession(req, res) {
    const token = getSessionToken(req);

    if (token) {
        await pool.query(
            "DELETE FROM admin_sessions WHERE token_hash = $1",
            [hashToken(token)]
        );
    }

    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/"
    });
}

async function requireAuth(req, res, next) {
    const token = getSessionToken(req);

    if (!token) {
        return res.redirect("/login");
    }

    try {
        const result = await pool.query(
            `SELECT
                users.id,
                users.username,
                users.display_name,
                users.role
             FROM admin_sessions
             INNER JOIN users ON users.id = admin_sessions.user_id
             WHERE admin_sessions.token_hash = $1
               AND admin_sessions.expires_at > NOW()
               AND users.is_active = TRUE`,
            [hashToken(token)]
        );

        if (result.rows.length === 0) {
            res.clearCookie(COOKIE_NAME, { path: "/" });
            return res.redirect("/login");
        }

        req.currentUser = result.rows[0];
        req.csrfToken = createCsrfToken(token);
        res.locals.currentUser = result.rows[0];
        res.locals.csrfToken = req.csrfToken;

        return next();
    } catch (error) {
        return next(error);
    }
}

function verifyCsrf(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }

    const requestOrigin = req.get("origin");

    if (requestOrigin) {
        try {
            const originUrl = new URL(requestOrigin);
            const expectedHost = req.get("host");

            if (originUrl.host === expectedHost && originUrl.protocol === `${req.protocol}:`) {
                return next();
            }
        } catch (error) {
            return res.status(403).send("Geçersiz istek kaynağı.");
        }
    }

    const submittedToken = String(
        req.body?._csrf || req.get("x-csrf-token") || ""
    );
    const expectedToken = String(req.csrfToken || "");
    const submittedBuffer = Buffer.from(submittedToken);
    const expectedBuffer = Buffer.from(expectedToken);

    if (
        submittedBuffer.length === 0 ||
        submittedBuffer.length !== expectedBuffer.length ||
        !crypto.timingSafeEqual(submittedBuffer, expectedBuffer)
    ) {
        return res.status(403).send(
            "Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin."
        );
    }

    return next();
}

module.exports = {
    createSession,
    destroySession,
    requireAuth,
    verifyCsrf
};
