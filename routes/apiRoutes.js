const express = require("express");
const pool = require("../db");

const router = express.Router();

router.get("/session", (req, res) => {
    return res.json({
        user: req.currentUser,
        csrfToken: req.csrfToken
    });
});

router.get("/departments", async (req, res, next) => {
    try {
        const result = await pool.query("SELECT * FROM departments ORDER BY id");
        return res.json({ data: result.rows });
    } catch (error) {
        return next(error);
    }
});

router.post("/departments", async (req, res, next) => {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim() || null;

    if (!name) {
        return res.status(400).json({ error: "Departman adı zorunludur." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO departments (name, description)
             VALUES ($1, $2) RETURNING *`,
            [name, description]
        );
        return res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "Departman adı zaten kullanılıyor." });
        }
        return next(error);
    }
});

router.patch("/departments/:id", async (req, res, next) => {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim() || null;

    if (!name) {
        return res.status(400).json({ error: "Departman adı zorunludur." });
    }

    try {
        const result = await pool.query(
            `UPDATE departments SET name = $1, description = $2
             WHERE id = $3 RETURNING *`,
            [name, description, req.params.id]
        );
        return result.rows[0]
            ? res.json({ data: result.rows[0] })
            : res.status(404).json({ error: "Departman bulunamadı." });
    } catch (error) {
        return next(error);
    }
});

router.delete("/departments/:id", async (req, res, next) => {
    try {
        const result = await pool.query(
            "DELETE FROM departments WHERE id = $1 RETURNING id",
            [req.params.id]
        );
        return result.rows[0]
            ? res.status(204).end()
            : res.status(404).json({ error: "Departman bulunamadı." });
    } catch (error) {
        if (error.code === "23503") {
            return res.status(409).json({ error: "Departmana bağlı kayıtlar var." });
        }
        return next(error);
    }
});

router.get("/employees", async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT employees.*, departments.name AS department_name
             FROM employees
             LEFT JOIN departments ON departments.id = employees.department_id
             ORDER BY employees.id`
        );
        return res.json({ data: result.rows });
    } catch (error) {
        return next(error);
    }
});

router.post("/employees", async (req, res, next) => {
    const firstName = String(req.body.first_name || "").trim();
    const lastName = String(req.body.last_name || "").trim();

    if (!firstName || !lastName) {
        return res.status(400).json({ error: "Ad ve soyad zorunludur." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO employees
                (first_name, last_name, email, phone, birth_date, gender,
                 department_id, position, hire_date)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [
                firstName, lastName,
                String(req.body.email || "").trim() || null,
                String(req.body.phone || "").trim() || null,
                req.body.birth_date || null,
                req.body.gender || null,
                req.body.department_id || null,
                String(req.body.position || "").trim() || null,
                req.body.hire_date || null
            ]
        );
        return res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({ error: "E-posta adresi zaten kullanılıyor." });
        }
        return next(error);
    }
});

router.patch("/employees/:id", async (req, res, next) => {
    const allowedFields = ["first_name", "last_name", "email", "phone", "birth_date", "gender", "department_id", "position", "hire_date"];
    const entries = Object.entries(req.body).filter(([key]) => allowedFields.includes(key));

    if (entries.length === 0) {
        return res.status(400).json({ error: "Güncellenecek alan bulunamadı." });
    }

    const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
    const values = entries.map(([, value]) => value === "" ? null : value);
    values.push(req.params.id);

    try {
        const result = await pool.query(
            `UPDATE employees SET ${assignments.join(", ")}
             WHERE id = $${values.length} RETURNING *`,
            values
        );
        return result.rows[0]
            ? res.json({ data: result.rows[0] })
            : res.status(404).json({ error: "Personel bulunamadı." });
    } catch (error) {
        return next(error);
    }
});

router.delete("/employees/:id", async (req, res, next) => {
    try {
        const result = await pool.query("DELETE FROM employees WHERE id = $1 RETURNING id", [req.params.id]);
        return result.rows[0] ? res.status(204).end() : res.status(404).json({ error: "Personel bulunamadı." });
    } catch (error) {
        return next(error);
    }
});

router.get("/trainings", async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT trainings.*, CONCAT(employees.first_name, ' ', employees.last_name) AS employee_name
             FROM trainings
             LEFT JOIN employees ON employees.id = trainings.employee_id
             ORDER BY trainings.id DESC`
        );
        return res.json({ data: result.rows });
    } catch (error) {
        return next(error);
    }
});

router.post("/trainings", async (req, res, next) => {
    const name = String(req.body.name || "").trim();

    if (!req.body.employee_id || !name || !req.body.start_date) {
        return res.status(400).json({ error: "Personel, eğitim adı ve başlangıç tarihi zorunludur." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO trainings
                (employee_id, name, description, start_date, end_date, duration, status)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [req.body.employee_id, name, req.body.description || null, req.body.start_date,
             req.body.end_date || null, req.body.duration || null, req.body.status || "Planlandı"]
        );
        return res.status(201).json({ data: result.rows[0] });
    } catch (error) {
        return next(error);
    }
});

router.patch("/trainings/:id", async (req, res, next) => {
    const allowedFields = ["employee_id", "name", "description", "start_date", "end_date", "duration", "status"];
    const entries = Object.entries(req.body).filter(([key]) => allowedFields.includes(key));

    if (entries.length === 0) {
        return res.status(400).json({ error: "Güncellenecek alan bulunamadı." });
    }

    const assignments = entries.map(([key], index) => `${key} = $${index + 1}`);
    const values = entries.map(([, value]) => value === "" ? null : value);
    values.push(req.params.id);

    try {
        const result = await pool.query(
            `UPDATE trainings SET ${assignments.join(", ")}
             WHERE id = $${values.length} RETURNING *`,
            values
        );
        return result.rows[0] ? res.json({ data: result.rows[0] }) : res.status(404).json({ error: "Eğitim bulunamadı." });
    } catch (error) {
        return next(error);
    }
});

router.delete("/trainings/:id", async (req, res, next) => {
    try {
        const result = await pool.query("DELETE FROM trainings WHERE id = $1 RETURNING id", [req.params.id]);
        return result.rows[0] ? res.status(204).end() : res.status(404).json({ error: "Eğitim bulunamadı." });
    } catch (error) {
        return next(error);
    }
});

module.exports = router;
