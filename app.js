const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

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