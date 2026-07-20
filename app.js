const express = require("express");
const path = require("path");
require("dotenv").config();

const pool = require("./db");

const app = express();
const PORT = 3000;

// PostgreSQL bağlantı testi
pool.query("SELECT NOW()")
  .then((result) => {
    console.log("✅ PostgreSQL bağlantısı başarılı!");
    console.log("Sunucu saati:", result.rows[0].now);
  })
  .catch((err) => {
    console.error("❌ PostgreSQL bağlantı hatası:", err.message);
  });

// EJS ayarları
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Form ve JSON verilerini okuyabilmek için
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// CSS, JS ve resim dosyaları
app.use(express.static(path.join(__dirname, "public")));

// Ana sayfa
app.get("/", (req, res) => {
    res.render("dashboard");
});

// Sunucuyu başlat
app.listen(PORT, () => {
    console.log(`HR Nova çalışıyor: http://localhost:${PORT}`);
});
// Departmanları listele
app.get("/departments", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM departments ORDER BY id ASC"
        );

        res.render("departments", {
            departments: result.rows,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("Departmanlar alınamadı:", error.message);
        res.status(500).send("Departmanlar yüklenirken hata oluştu.");
    }
});

// Yeni departman ekle
app.post("/departments", async (req, res) => {
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
        return res.redirect(
            "/departments?error=Departman adı boş bırakılamaz."
        );
    }

    try {
        await pool.query(
            `INSERT INTO departments (name, description)
             VALUES ($1, $2)`,
            [name.trim(), description?.trim() || null]
        );

        res.redirect("/departments?success=Departman başarıyla eklendi.");
    } catch (error) {
        console.error("Departman ekleme hatası:", error.message);

        if (error.code === "23505") {
            return res.redirect(
                "/departments?error=Bu departman adı zaten kullanılıyor."
            );
        }

        res.redirect("/departments?error=Departman eklenemedi.");
    }
});

// Departman düzenleme sayfası
app.get("/departments/:id/edit", async (req, res) => {
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

        res.render("department-edit", {
            department: result.rows[0],
            error: null
        });
    } catch (error) {
        console.error("Departman bulma hatası:", error.message);
        res.redirect("/departments?error=Departman açılamadı.");
    }
});

// Departmanı güncelle
app.post("/departments/:id/update", async (req, res) => {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name || name.trim() === "") {
        return res.redirect(
            "/departments?error=Departman adı boş bırakılamaz."
        );
    }

    try {
        await pool.query(
            `UPDATE departments
             SET name = $1, description = $2
             WHERE id = $3`,
            [name.trim(), description?.trim() || null, id]
        );

        res.redirect("/departments?success=Departman güncellendi.");
    } catch (error) {
        console.error("Departman güncelleme hatası:", error.message);

        if (error.code === "23505") {
            return res.redirect(
                "/departments?error=Bu departman adı zaten kullanılıyor."
            );
        }

        res.redirect("/departments?error=Departman güncellenemedi.");
    }
});

// Departmanı sil
app.post("/departments/:id/delete", async (req, res) => {
    const { id } = req.params;

    try {
        await pool.query(
            "DELETE FROM departments WHERE id = $1",
            [id]
        );

        res.redirect("/departments?success=Departman silindi.");
    } catch (error) {
        console.error("Departman silme hatası:", error.message);
        res.redirect("/departments?error=Departman silinemedi.");
    }
});