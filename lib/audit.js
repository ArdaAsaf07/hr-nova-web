const pool = require("../db");

const ACTIONS_BY_METHOD = {
    POST: "WRITE",
    PUT: "UPDATE",
    PATCH: "UPDATE",
    DELETE: "DELETE"
};

function auditMutations(req, res, next) {
    const action = ACTIONS_BY_METHOD[req.method];

    const currentUser = req.currentUser;

    if (!action || !currentUser?.id) {
        return next();
    }

    const auditEntry = {
        actorUserId: currentUser.id,
        actorUsername: String(currentUser.username || "bilinmeyen"),
        action,
        method: req.method,
        path: req.originalUrl.slice(0, 500),
        ipAddress: req.ip || null,
        userAgent: String(req.get("user-agent") || "").slice(0, 500) || null
    };

    res.once("finish", () => {
        pool.query(
            `INSERT INTO audit_logs
                (actor_user_id, actor_username, action, request_method,
                 request_path, response_status, ip_address, user_agent)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                auditEntry.actorUserId,
                auditEntry.actorUsername,
                auditEntry.action,
                auditEntry.method,
                auditEntry.path,
                res.statusCode,
                auditEntry.ipAddress,
                auditEntry.userAgent
            ]
        ).catch((error) => {
            console.error("İşlem günlüğü yazma hatası:", error.message);
        });
    });

    return next();
}

module.exports = {
    auditMutations
};
