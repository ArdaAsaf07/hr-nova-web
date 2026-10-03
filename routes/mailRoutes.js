const express = require("express");
const pool = require("../db");
const { isMailConfigured, sendMail } = require("../lib/mailer");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const [employeesResult, historyResult] = await Promise.all([
            pool.query(
                `SELECT id, first_name, last_name, email
                 FROM employees
                 WHERE email IS NOT NULL AND TRIM(email) <> ''
                 ORDER BY first_name, last_name`
            ),
            pool.query(
                `SELECT
                    mail_history.*,
                    users.display_name AS sender_name
                 FROM mail_history
                 INNER JOIN users ON users.id = mail_history.sent_by
                 WHERE mail_history.deleted_at IS NULL
                   AND (($1 = 'archive' AND mail_history.archived_at IS NOT NULL) OR ($1 <> 'archive' AND mail_history.archived_at IS NULL))
                 ORDER BY mail_history.created_at DESC
                 LIMIT 50`
                , [req.query.view === "archive" ? "archive" : "inbox"]
            )
        ]);

        return res.render("mail", {
            employees: employeesResult.rows,
            history: historyResult.rows,
            mailConfigured: isMailConfigured(),
            success: req.query.success || null,
            error: req.query.error || null
            , archiveView: req.query.view === "archive"
        });
    } catch (error) {
        console.error("Mail Merkezi yükleme hatası:", error.message);
        return res.status(500).send("Mail Merkezi yüklenemedi.");
    }
});

router.post("/:id/archive", async (req,res)=>{await pool.query("UPDATE mail_history SET archived_at=NOW() WHERE id=$1 AND deleted_at IS NULL",[req.params.id]);res.redirect("/mail?success=Mail arşivlendi.");});
router.post("/:id/restore", async (req,res)=>{await pool.query("UPDATE mail_history SET archived_at=NULL WHERE id=$1 AND deleted_at IS NULL",[req.params.id]);res.redirect("/mail?view=archive&success=Mail arşivden çıkarıldı.");});
router.post("/:id/delete", async (req,res)=>{await pool.query("UPDATE mail_history SET deleted_at=NOW() WHERE id=$1",[req.params.id]);res.redirect(`/mail${req.body.from_archive==='1'?'?view=archive&success=Mail silindi.':'?success=Mail silindi.'}`);});

router.post("/send", async (req, res) => {
    const employeeId = String(req.body.employee_id || "");
    const directEmail = String(req.body.recipient_email || "").trim().toLowerCase();
    const subject = String(req.body.subject || "").trim();
    const message = String(req.body.message || "").trim();

    if ((!employeeId && !directEmail) || !subject || !message) {
        return res.redirect("/mail?error=Personel veya alıcı e-posta adresi, konu ve mesaj zorunludur.");
    }

    if (directEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(directEmail)) {
        return res.redirect("/mail?error=Geçerli bir alıcı e-posta adresi girin.");
    }

    if (subject.length > 255 || message.length > 10000) {
        return res.redirect("/mail?error=Mail içeriği izin verilen uzunluğu aşıyor.");
    }

    let employee;

    try {
        const employeeResult = employeeId ? await pool.query(
            `SELECT id, first_name, last_name, email
             FROM employees
             WHERE id = $1 AND email IS NOT NULL AND TRIM(email) <> ''`,
            [employeeId]
        ) : { rows: [] };
        employee = employeeResult.rows[0];

        if (employeeId && !employee) {
            return res.redirect("/mail?error=Geçerli e-posta adresi olan personel bulunamadı.");
        }

        const recipientEmail = directEmail || employee.email;

        await sendMail({
            to: recipientEmail,
            subject,
            text: message
        });

        await pool.query(
            `INSERT INTO mail_history
                (employee_id, recipient_email, subject, message_text, status, sent_by, sent_at)
             VALUES ($1, $2, $3, $4, 'sent', $5, NOW())`,
            [employee?.id || null, recipientEmail, subject, message, req.currentUser.id]
        );

        return res.redirect("/mail?success=Mail başarıyla gönderildi.");
    } catch (error) {
        console.error("Mail gönderme hatası:", error.message);

        if (employee || directEmail) {
            const recipientEmail = directEmail || employee.email;
            await pool.query(
                `INSERT INTO mail_history
                    (employee_id, recipient_email, subject, message_text, status, error_message, sent_by)
                 VALUES ($1, $2, $3, $4, 'failed', $5, $6)`,
                [employee?.id || null, recipientEmail, subject, message, error.message.slice(0, 500), req.currentUser.id]
            ).catch(() => {});
        }

        return res.redirect("/mail?error=Mail gönderilemedi. SMTP ayarlarını kontrol edin.");
    }
});

module.exports = router;
