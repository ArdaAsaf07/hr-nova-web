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
app.get("/departments", async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM departments ORDER BY id ASC"
        );

        res.render("departments", {
            departments: result.rows
        });
    } catch (error) {
        console.error("Departmanlar alınamadı:", error.message);
        res.status(500).send("Departmanlar yüklenirken hata oluştu.");
    }
});