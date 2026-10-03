const express = require("express");
const pool = require("../db");

const router = express.Router();

// Departmanları listele
router.get("/", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM departments ORDER BY id ASC"
        );

        return res.render("departments", {
            departments: result.rows,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(
            "Departmanları listeleme hatası:",
            error.message
        );

        return res.status(500).send(
            "Departmanlar yüklenirken hata oluştu."
        );
    }
});

// Yeni departman ekle
router.post("/", async (req, res) => {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
        return res.redirect(
            "/departments?error=Departman adı boş bırakılamaz."
        );
    }

    try {
        await pool.query(
            `
            INSERT INTO departments (name, description)
            VALUES ($1, $2)
            `,
            [
                name.trim(),
                description?.trim() || null
            ]
        );

        return res.redirect(
            "/departments?success=Departman başarıyla eklendi."
        );
    } catch (error) {
        console.error(
            "Departman ekleme hatası:",
            error.message
        );

        if (error.code === "23505") {
            return res.redirect(
                "/departments?error=Bu departman adı zaten kullanılıyor."
            );
        }

        return res.redirect(
            "/departments?error=Departman eklenemedi."
        );
    }
});

// Departman düzenleme sayfasını aç
router.get("/:id/edit", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            "SELECT * FROM departments WHERE id = $1",
            [id]
        );

        if (result.rows.length === 0) {
            return res.redirect(
                "/departments?error=Departman bulunamadı."
            );
        }

        return res.render("department-edit", {
            department: result.rows[0],
            error: req.query.error || null
        });
    } catch (error) {
        console.error(
            "Departman düzenleme sayfası hatası:",
            error.message
        );

        return res.redirect(
            "/departments?error=Departman düzenleme sayfası açılamadı."
        );
    }
});

// Departmanı güncelle
router.post("/:id/update", async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
        return res.redirect(
            `/departments/${id}/edit?error=Departman adı boş bırakılamaz.`
        );
    }

    try {
        const result = await pool.query(
            `
            UPDATE departments
            SET name = $1,
                description = $2
            WHERE id = $3
            RETURNING id
            `,
            [
                name.trim(),
                description?.trim() || null,
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.redirect(
                "/departments?error=Departman bulunamadı."
            );
        }

        return res.redirect(
            "/departments?success=Departman başarıyla güncellendi."
        );
    } catch (error) {
        console.error(
            "Departman güncelleme hatası:",
            error.message
        );

        if (error.code === "23505") {
            return res.redirect(
                `/departments/${id}/edit?error=Bu departman adı zaten kullanılıyor.`
            );
        }

        return res.redirect(
            `/departments/${id}/edit?error=Departman güncellenemedi.`
        );
    }
});

// Departmanı sil
router.post("/:id/delete", async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query(
            `
            DELETE FROM departments
            WHERE id = $1
            RETURNING id
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.redirect(
                "/departments?error=Departman bulunamadı."
            );
        }

        return res.redirect(
            "/departments?success=Departman başarıyla silindi."
        );
    } catch (error) {
        console.error(
            "Departman silme hatası:",
            error.message
        );

        if (error.code === "23503") {
            return res.redirect(
                "/departments?error=Bu departmana bağlı personeller olduğu için departman silinemez."
            );
        }

        return res.redirect(
            "/departments?error=Departman silinemedi."
        );
    }
});

module.exports = router;