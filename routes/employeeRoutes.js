const express = require("express");
const pool = require("../db");
const { protectNationalId } = require("../lib/personalDataCrypto");

const router = express.Router();

/* =========================================
   PERSONEL CRUD İŞLEMLERİ
========================================= */

// Personelleri listele
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                employees.id,
                employees.first_name,
                employees.last_name,
                employees.email,
                employees.phone,
                employees.birth_date,
                employees.gender,
                employees.department_id,
                employees.position,
                employees.hire_date,
                employees.education_status,
                employees.created_at,
                departments.name AS department_name
            FROM employees
            LEFT JOIN departments
                ON employees.department_id = departments.id
            ORDER BY employees.id ASC
        `);

        res.render("employees", {
            employees: result.rows,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(
            "Personelleri listeleme hatası:",
            error.message
        );

        res.status(500).send(
            "Personeller yüklenirken hata oluştu."
        );
    }
});

// Yeni personel sayfasını aç
router.get("/new", async (req, res) => {
    try {
        const departmentsResult = await pool.query(
            "SELECT id, name FROM departments ORDER BY name ASC"
        );

        res.render("employee-new", {
            departments: departmentsResult.rows,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(
            "Personel ekleme sayfası hatası:",
            error.message
        );

        res.status(500).send(
            "Personel ekleme sayfası açılamadı."
        );
    }
});

// Yeni personel kaydet
router.post("/", async (req, res) => {
    const {
        first_name,
        last_name,
        email,
        phone,
        birth_date,
        gender,
        department_id,
        position,
        hire_date
    } = req.body;
    const nationalId=String(req.body.national_id||"").trim();

    if (!first_name || first_name.trim() === "") {
        return res.redirect(
            "/employees/new?error=Personel adı boş bırakılamaz."
        );
    }

    if (!last_name || last_name.trim() === "") {
        return res.redirect(
            "/employees/new?error=Personel soyadı boş bırakılamaz."
        );
    }

    try {
        const protectedId=nationalId?protectNationalId(nationalId):null;
        await pool.query(
            `INSERT INTO employees
            (
                first_name,
                last_name,
                email,
                phone,
                birth_date,
                gender,
                department_id,
                position,
                hire_date,national_id_ciphertext,national_id_iv,national_id_auth_tag,national_id_hash,national_id_last4
            )
            VALUES
            (
                $1, $2, $3, $4, $5,
                $6,$7,$8,$9,$10,$11,$12,$13,$14
            )`,
            [
                first_name.trim(),
                last_name.trim(),
                email?.trim() || null,
                phone?.trim() || null,
                birth_date || null,
                gender || null,
                department_id || null,
                position?.trim() || null,
                hire_date||null,protectedId?.ciphertext||null,protectedId?.iv||null,protectedId?.authTag||null,protectedId?.hash||null,protectedId?.last4||null
            ]
        );

        res.redirect(
            "/employees?success=Personel başarıyla eklendi."
        );
    } catch (error) {
        console.error(
            "Personel ekleme hatası:",
            error.message
        );

        if (error.code === "23505") {
            return res.redirect(
                "/employees/new?error=Bu e-posta adresi zaten kullanılıyor."
            );
        }

        res.redirect(
            "/employees/new?error=Personel eklenemedi."
        );
    }
});

// Personel düzenleme sayfası
router.get("/:id/edit", async (req, res) => {
    const { id } = req.params;

    try {
        const employeeResult = await pool.query(
            "SELECT * FROM employees WHERE id = $1",
            [id]
        );

        if (employeeResult.rows.length === 0) {
            return res.redirect(
                "/employees?error=Personel bulunamadı."
            );
        }

        const departmentsResult = await pool.query(
            "SELECT id, name FROM departments ORDER BY name ASC"
        );

        res.render("employee-edit", {
            employee: employeeResult.rows[0],
            departments: departmentsResult.rows,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(
            "Personel düzenleme sayfası hatası:",
            error.message
        );

        res.redirect(
            "/employees?error=Personel düzenleme sayfası açılamadı."
        );
    }
});

// Personeli güncelle
router.post("/:id/update", async (req, res) => {
    const { id } = req.params;

    const {
        first_name,
        last_name,
        email,
        phone,
        birth_date,
        gender,
        department_id,
        position,
        hire_date
    } = req.body;
    const nationalId=String(req.body.national_id||"").trim();

    if (!first_name || first_name.trim() === "") {
        return res.redirect(
            `/employees/${id}/edit?error=Personel adı boş bırakılamaz.`
        );
    }

    if (!last_name || last_name.trim() === "") {
        return res.redirect(
            `/employees/${id}/edit?error=Personel soyadı boş bırakılamaz.`
        );
    }

    try {
        const protectedId=nationalId?protectNationalId(nationalId):null;
        const result = await pool.query(
            `UPDATE employees
             SET first_name = $1,
                 last_name = $2,
                 email = $3,
                 phone = $4,
                 birth_date = $5,
                 gender = $6,
                 department_id = $7,
                 position = $8,
                 hire_date=$9,national_id_ciphertext=COALESCE($10,national_id_ciphertext),national_id_iv=COALESCE($11,national_id_iv),national_id_auth_tag=COALESCE($12,national_id_auth_tag),national_id_hash=COALESCE($13,national_id_hash),national_id_last4=COALESCE($14,national_id_last4)
             WHERE id=$15
             RETURNING id`,
            [
                first_name.trim(),
                last_name.trim(),
                email?.trim() || null,
                phone?.trim() || null,
                birth_date || null,
                gender || null,
                department_id || null,
                position?.trim() || null,
                hire_date||null,protectedId?.ciphertext||null,protectedId?.iv||null,protectedId?.authTag||null,protectedId?.hash||null,protectedId?.last4||null,id
            ]
        );

        if (result.rows.length === 0) {
            return res.redirect(
                "/employees?error=Personel bulunamadı."
            );
        }

        res.redirect(
            "/employees?success=Personel başarıyla güncellendi."
        );
    } catch (error) {
        console.error(
            "Personel güncelleme hatası:",
            error.message
        );

        if (error.code === "23505") {
            return res.redirect(
                `/employees/${id}/edit?error=Bu e-posta adresi başka bir personelde kullanılıyor.`
            );
        }

        res.redirect(
            `/employees/${id}/edit?error=Personel güncellenemedi.`
        );
    }
});

// Personeli sil
router.post("/:id/delete", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `DELETE FROM employees
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.redirect(
                "/employees?error=Personel bulunamadı."
            );
        }

        res.redirect(
            "/employees?success=Personel başarıyla silindi."
        );
    } catch (error) {
        console.error(
            "Personel silme hatası:",
            error.message
        );

        res.redirect(
            "/employees?error=Personel silinemedi."
        );
    }
});

module.exports = router;
