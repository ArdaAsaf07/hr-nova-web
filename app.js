
const crypto = require("crypto");
const express = require("express");
const path = require("path");
const multer = require("multer");
const ExcelJS = require("exceljs");

require("dotenv").config();

const pool = require("./db");
const departmentRoutes = require("./routes/departmentRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const mailRoutes = require("./routes/mailRoutes");
const systemRoutes = require("./routes/systemRoutes");
const reportRoutes = require("./routes/reportRoutes");
const searchRoutes = require("./routes/searchRoutes");
const trainingStatusRoutes = require("./routes/trainingStatusRoutes");
const apiRoutes = require("./routes/apiRoutes");
const authRoutes = require("./routes/authRoutes");
const { requireAuth, verifyCsrf } = require("./lib/auth");
const { auditMutations } = require("./lib/audit");
const { securityHeaders } = require("./lib/security");
const { notificationCount } = require("./lib/notificationCount");
const { employeeEducationSync } = require("./lib/employeeEducationSync");

const app = express();
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

const PORT = process.env.PORT || 3000;

const excelUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    }
});

/* =========================================
   EJS VE MIDDLEWARE AYARLARI
========================================= */

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(securityHeaders);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(authRoutes);
app.use(requireAuth);
app.use(notificationCount);
app.use(verifyCsrf);
app.use(auditMutations);
app.use("/departments", departmentRoutes);
app.use("/employees", employeeEducationSync, employeeRoutes);
app.use("/mail", mailRoutes);
app.use("/api", apiRoutes);
app.use(systemRoutes);
app.use(reportRoutes);
app.use(searchRoutes);
app.use(trainingStatusRoutes);

/* PostgreSQL bağlantı testi bundan sonra devam edecek */

/* =========================================
   POSTGRESQL BAĞLANTI TESTİ
========================================= */

pool.query("SELECT NOW()")
    .then((result) => {
        console.log("✅ PostgreSQL bağlantısı başarılı!");
        console.log("Sunucu saati:", result.rows[0].now);
    })
    .catch((error) => {
        console.error(
            "❌ PostgreSQL bağlantı hatası:",
            error.message
        );
    });

/* =========================================
   DASHBOARD
========================================= */

app.get("/", async (req, res) => {
    try {
        const [
            employeeCountResult,
            departmentCountResult,
            upcomingTrainingCountResult,
            expiredTrainingCountResult,
            missingTrainingCountResult,
            recentEmployeesResult,
            upcomingTrainingsResult
        ] = await Promise.all([
            pool.query("SELECT COUNT(*)::int AS count FROM employees"),
            pool.query("SELECT COUNT(*)::int AS count FROM departments"),
            pool.query(`
                SELECT COUNT(*)::int AS count
                FROM trainings
                WHERE start_date >= CURRENT_DATE
                  AND LOWER(COALESCE(status, '')) NOT IN ('tamamlandı', 'iptal edildi')
            `),
            pool.query(`
                SELECT COUNT(*)::int AS count
                FROM trainings
                WHERE end_date < CURRENT_DATE
                  AND LOWER(COALESCE(status, '')) NOT IN ('tamamlandı', 'iptal edildi')
            `),
            pool.query(`
                SELECT COUNT(*)::int AS count
                FROM employees
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM trainings
                    WHERE trainings.employee_id = employees.id
                )
            `),
            pool.query(`
                SELECT
                    employees.id,
                    employees.first_name,
                    employees.last_name,
                    employees.email,
                    employees.position,
                    employees.hire_date,
                    departments.name AS department_name
                FROM employees
                LEFT JOIN departments ON departments.id = employees.department_id
                ORDER BY employees.created_at DESC, employees.id DESC
                LIMIT 5
            `),
            pool.query(`
                SELECT
                    trainings.id,
                    trainings.name,
                    trainings.start_date,
                    trainings.end_date,
                    CONCAT(employees.first_name, ' ', employees.last_name) AS employee_name
                FROM trainings
                LEFT JOIN employees ON employees.id = trainings.employee_id
                WHERE trainings.start_date >= CURRENT_DATE
                  AND LOWER(COALESCE(trainings.status, '')) NOT IN ('tamamlandı', 'iptal edildi')
                ORDER BY trainings.start_date ASC, trainings.id ASC
                LIMIT 5
            `)
        ]);

        return res.render("dashboard", {
            totalEmployees: employeeCountResult.rows[0].count,
            totalDepartments: departmentCountResult.rows[0].count,
            upcomingTrainingCount: upcomingTrainingCountResult.rows[0].count,
            expiredTrainings: expiredTrainingCountResult.rows[0].count,
            missingTrainings: missingTrainingCountResult.rows[0].count,
            totalCertificates: 0,
            recentEmployees: recentEmployeesResult.rows,
            upcomingTrainingRecords: upcomingTrainingsResult.rows
        });
    } catch (error) {
        console.error("Dashboard yükleme hatası:", error.message);
        return res.status(500).send("Dashboard yüklenirken hata oluştu.");
    }
});

app.get("/excel", (req, res) => {
    res.render("employee-import");
});


/* =========================================
   EXCEL'DEN PERSONEL AKTARMA
========================================= */

// Excel'den personel aktarma sayfasını aç
app.get("/employees/import", (req, res) => {
    res.render("employee-import");
});
// Excel dosyasını okuyup önizleme sayfasını aç
app.post(
    "/employees/import/preview",
    excelUpload.single("excel_file"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.redirect(
                    "/employees/import?error=Excel dosyası seçilmedi."
                );
            }

            const fileName = req.file.originalname;

            const extension = path
                .extname(fileName)
                .toLowerCase();

            const allowedExtensions = [
                ".xlsx",
                ".xls"
            ];

            if (!allowedExtensions.includes(extension)) {
                return res.redirect(
                    "/employees/import?error=Yalnızca XLSX veya XLS dosyası yükleyebilirsiniz."
                );
            }

            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(req.file.buffer);

            const firstSheet = workbook.worksheets[0];

            if (!firstSheet) {
                return res.redirect(
                    "/employees/import?error=Excel dosyasında çalışma sayfası bulunamadı."
                );
            }

            const firstSheetName = firstSheet.name;
            const sourceHeaders = firstSheet.getRow(1).values
                .slice(1)
                .map(value => String(value || "").trim());

            const allowedHeaders = new Map([
                ["ad", "Ad"], ["adi", "Ad"], ["soyad", "Soyad"], ["soyadi", "Soyad"], ["adisoyadi", "Adı Soyadı"], ["adsoyad", "Adı Soyadı"],
                ["departman", "Departman"], ["departmani", "Departman"], ["departmanadi", "Departman"], ["departmanad", "Departman"],
                ["isegiristarihi", "İşe Giriş Tarihi"], ["isebaslamatarihi", "İşe Giriş Tarihi"], ["isegiris", "İşe Giriş Tarihi"],
                ["dogumtarihi", "Doğum Tarihi"], ["egitimdurumu", "Eğitim Durumu"], ["aldialmadi", "Eğitim Durumu"], ["aldalmad", "Eğitim Durumu"],
                ["egitimadi", "Eğitim Adı"], ["alinanegitim", "Eğitim Adı"], ["alinanegitimadi", "Eğitim Adı"], ["egitim", "Eğitim Adı"],
                ["cinsiyet", "Cinsiyet"], ["cinsiyeti", "Cinsiyet"]
            ]);
            const selectedColumns = sourceHeaders.map((header, index) => ({ index, canonical: allowedHeaders.get(normalizeImportHeader(header)) })).filter(column => column.canonical);
            const headers = [...new Set(selectedColumns.map(column => column.canonical))];

            const excelRows = [];

            for (let rowNumber = 2; rowNumber <= firstSheet.rowCount; rowNumber += 1) {
                const worksheetRow = firstSheet.getRow(rowNumber);
                const row = {};

                selectedColumns.forEach(({ index, canonical }) => {
                    const cellValue = worksheetRow.getCell(index + 1).value;
                    let normalizedValue = cellValue;

                    if (cellValue && typeof cellValue === "object" && !(cellValue instanceof Date)) {
                        normalizedValue = cellValue.text ??
                            cellValue.result ??
                            cellValue.richText?.map(item => item.text).join("") ??
                            "";
                    }

                    row[canonical] = normalizedValue ?? "";
                });

                if (Object.values(row).some(value => String(value).trim() !== "")) {
                    excelRows.push(row);
                }
            }

            if (excelRows.length === 0) {
                return res.redirect(
                    "/employees/import?error=Excel dosyasında personel kaydı bulunamadı."
                );
            }

            const previewRows =
                excelRows.slice(0, 10);

            const batchToken = crypto.randomUUID();

            await pool.query(
                `INSERT INTO employee_import_batches
                    (batch_token, created_by, file_name, sheet_name, rows_json, total_rows)
                 VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
                [
                    batchToken,
                    req.currentUser.id,
                    fileName.slice(0, 255),
                    firstSheetName.slice(0, 255),
                    JSON.stringify(excelRows),
                    excelRows.length
                ]
            );

            return res.render(
                "employee-import-preview",
                {
                    fileName,
                    sheetName: firstSheetName,
                    totalRows: excelRows.length,
                    headers,
                    previewRows,
                    batchToken
                }
            );
        } catch (error) {
            console.error(
                "Excel önizleme hatası:",
                error.message
            );

            return res.redirect(
                "/employees/import?error=Excel dosyası okunamadı."
            );
        }
    }
);
function normalizeImportHeader(value) {
    return String(value || "")
        .toLocaleLowerCase("tr-TR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "");
}

function getImportValue(row, aliases) {
    const normalizedAliases = aliases.map(normalizeImportHeader);

    for (const [header, value] of Object.entries(row)) {
        if (normalizedAliases.includes(normalizeImportHeader(header))) {
            return value;
        }
    }

    return "";
}

function normalizeImportDate(value) {
    if (!value) {
        return null;
    }

    const text = String(value).trim();
    const turkishDate = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);

    if (turkishDate) {
        return `${turkishDate[3]}-${turkishDate[2].padStart(2, "0")}-${turkishDate[1].padStart(2, "0")}`;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? null
        : date.toISOString().slice(0, 10);
}

app.post("/employees/import/confirm", async (req, res) => {
    const batchToken = String(req.body.batch_token || "");
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const batchResult = await client.query(
            `SELECT *
             FROM employee_import_batches
             WHERE batch_token = $1
               AND created_by = $2
               AND processed_at IS NULL
               AND expires_at > NOW()
             FOR UPDATE`,
            [batchToken, req.currentUser.id]
        );

        if (batchResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.redirect("/excel?error=Aktarım paketi bulunamadı, süresi doldu veya daha önce işlendi.");
        }

        const departmentResult = await client.query(
            "SELECT id, name FROM departments"
        );
        const departmentMap = new Map(
            departmentResult.rows.map(department => [
                department.name.toLocaleLowerCase("tr-TR").trim(),
                department.id
            ])
        );

        let importedCount = 0;
        let skippedCount = 0;

        for (const row of batchResult.rows[0].rows_json) {
            let firstName = String(getImportValue(row, ["Ad"]) || "").trim();
            let lastName = String(getImportValue(row, ["Soyad"]) || "").trim();
            if ((!firstName || !lastName) && getImportValue(row,["Adı Soyadı"])) {
                const nameParts=String(getImportValue(row,["Adı Soyadı"])).trim().split(/\s+/);
                lastName=nameParts.length>1?nameParts.pop():"";
                firstName=nameParts.join(" ");
            }

            if (!firstName || !lastName) {
                skippedCount += 1;
                continue;
            }

            const departmentName = String(getImportValue(row, ["Departman"]) || "").trim();
            const departmentId = departmentMap.get(
                departmentName.toLocaleLowerCase("tr-TR")
            ) || null;

            const insertResult = await client.query(
                `INSERT INTO employees
                    (first_name,last_name,birth_date,gender,department_id,hire_date,education_status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)
                 RETURNING id`,
                [
                    firstName,
                    lastName,
                    normalizeImportDate(getImportValue(row, ["Doğum Tarihi"])),
                    String(getImportValue(row, ["Cinsiyet"]) || "").trim() || null,
                    departmentId,
                    normalizeImportDate(getImportValue(row, ["İşe Giriş Tarihi"])),
                    String(getImportValue(row,["Eğitim Durumu"])||"").trim()||null
                ]
            );

            if (insertResult.rows.length === 1) {
                const educationStatus = String(getImportValue(row,["Eğitim Durumu"])||"").trim();
                const trainingName = String(getImportValue(row,["Eğitim Adı"])||"İş Sağlığı ve Güvenliği Eğitimi").trim();
                if (["Aldı","Almadı"].includes(educationStatus) && trainingName) {
                    const catalogResult = await client.query(
                        `INSERT INTO training_catalog(name) VALUES($1)
                         ON CONFLICT(name) DO UPDATE SET is_active=TRUE RETURNING id`,
                        [trainingName.slice(0,255)]
                    );
                    await client.query(
                        `INSERT INTO employee_training_status(employee_id,training_catalog_id,status,completed_at)
                         VALUES($1,$2,$3::varchar,CASE WHEN $3::varchar='Aldı' THEN CURRENT_DATE ELSE NULL END)
                         ON CONFLICT(employee_id,training_catalog_id) DO UPDATE
                         SET status=EXCLUDED.status,completed_at=EXCLUDED.completed_at,updated_at=NOW()`,
                        [insertResult.rows[0].id,catalogResult.rows[0].id,educationStatus]
                    );
                }
                importedCount += 1;
            } else {
                skippedCount += 1;
            }
        }

        await client.query(
            "UPDATE employee_import_batches SET processed_at = NOW() WHERE id = $1",
            [batchResult.rows[0].id]
        );
        await client.query("COMMIT");

        return res.redirect(
            `/employees?success=${importedCount} personel aktarıldı. ${skippedCount} satır atlandı.`
        );
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Excel personel aktarım hatası:", error.message);
        return res.redirect("/excel?error=Personeller aktarılırken hata oluştu.");
    } finally {
        client.release();
    }
});

// =====================================================
// EĞİTİMLER
// =====================================================

// Eğitimleri listele
app.get("/trainings", async (req, res) => {
    try {
        const trainingsResult = await pool.query(`
            SELECT
                trainings.id,
                trainings.employee_id,
                trainings.name,
                trainings.description,
                trainings.start_date,
                trainings.end_date,
                trainings.duration,
                trainings.status,
                trainings.created_at,
                CONCAT(
                    employees.first_name,
                    ' ',
                    employees.last_name
                ) AS employee_name
            FROM trainings
            LEFT JOIN employees
                ON trainings.employee_id = employees.id
            ORDER BY trainings.id DESC
        `);

        const employeesResult = await pool.query(`
            SELECT id, first_name, last_name, education_status
            FROM employees
            ORDER BY first_name ASC, last_name ASC
        `);
        const trainingStatusesResult = await pool.query(`SELECT employee_training_status.id,employee_training_status.status,employee_training_status.completed_at,training_catalog.name AS training_name,employees.first_name,employees.last_name FROM employee_training_status INNER JOIN training_catalog ON training_catalog.id=employee_training_status.training_catalog_id INNER JOIN employees ON employees.id=employee_training_status.employee_id ORDER BY training_catalog.name,employees.first_name,employees.last_name`);

        res.render("trainings", {
            trainings: trainingsResult.rows,
            employees: employeesResult.rows,
            trainingStatuses: trainingStatusesResult.rows,
            success: req.query.success || null,
            error: req.query.error || null
        });
    } catch (error) {
        console.error("Eğitimleri listeleme hatası:", error.message);
        res.status(500).send("Eğitimler yüklenirken hata oluştu.");
    }
});

// Yeni eğitim kaydet
app.post("/trainings", async (req, res) => {
    const {
        employee_id,
        name,
        description,
        start_date,
        end_date,
        duration,
        status
    } = req.body;

    if (!employee_id || !name?.trim() || !start_date) {
        return res.redirect(
            "/trainings?error=Personel, eğitim adı ve başlangıç tarihi zorunludur."
        );
    }

    try {
        const insertResult = await pool.query(
            `
            INSERT INTO trainings
            (
                employee_id,
                name,
                description,
                start_date,
                end_date,
                duration,
                status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING employee_id,name,status
            `,
            [
                employee_id,
                name.trim(),
                description?.trim() || null,
                start_date,
                end_date || null,
                duration ? Number(duration) : null,
                status || "Planlandı"
            ]
        );

        const savedTraining=insertResult.rows[0];
        const catalogResult=await pool.query(
            `INSERT INTO training_catalog(name) VALUES($1)
             ON CONFLICT(name) DO UPDATE SET is_active=TRUE RETURNING id`,
            [savedTraining.name]
        );
        const received=String(savedTraining.status||'').toLocaleLowerCase('tr-TR')==='tamamlandı';
        await pool.query(
            `INSERT INTO employee_training_status(employee_id,training_catalog_id,status,completed_at)
             VALUES($1,$2,$3::varchar,CASE WHEN $3::varchar='Aldı' THEN CURRENT_DATE ELSE NULL END)
             ON CONFLICT(employee_id,training_catalog_id) DO UPDATE
             SET status=EXCLUDED.status,completed_at=EXCLUDED.completed_at,updated_at=NOW()`,
            [savedTraining.employee_id,catalogResult.rows[0].id,received?'Aldı':'Almadı']
        );

        return res.redirect(
            "/trainings?success=Eğitim başarıyla eklendi."
        );
    } catch (error) {
        console.error("Eğitim ekleme hatası:", error.message);

        return res.redirect(
            "/trainings?error=Eğitim eklenemedi."
        );
    }
});

// Eğitim düzenleme sayfası
app.get("/trainings/:id/edit", async (req, res) => {
    try {
        const trainingResult = await pool.query(
            "SELECT * FROM trainings WHERE id = $1",
            [req.params.id]
        );

        if (trainingResult.rows.length === 0) {
            return res.redirect(
                "/trainings?error=Eğitim kaydı bulunamadı."
            );
        }

        const employeesResult = await pool.query(`
            SELECT id, first_name, last_name
            FROM employees
            ORDER BY first_name ASC, last_name ASC
        `);

        return res.render("training-edit", {
            training: trainingResult.rows[0],
            employees: employeesResult.rows,
            error: req.query.error || null
        });
    } catch (error) {
        console.error(
            "Eğitim düzenleme sayfası hatası:",
            error.message
        );

        return res.redirect(
            "/trainings?error=Eğitim bilgileri yüklenemedi."
        );
    }
});

// Eğitimi güncelle
app.post("/trainings/:id/edit", async (req, res) => {
    const {
        employee_id,
        name,
        description,
        start_date,
        end_date,
        duration,
        status
    } = req.body;

    if (!employee_id || !name?.trim() || !start_date) {
        return res.redirect(
            `/trainings/${req.params.id}/edit?error=Zorunlu alanları doldurun.`
        );
    }

    try {
        const result = await pool.query(
            `
            UPDATE trainings
            SET employee_id = $1,
                name = $2,
                description = $3,
                start_date = $4,
                end_date = $5,
                duration = $6,
                status = $7
            WHERE id = $8
            RETURNING id
            `,
            [
                employee_id,
                name.trim(),
                description?.trim() || null,
                start_date,
                end_date || null,
                duration ? Number(duration) : null,
                status || "Planlandı",
                req.params.id
            ]
        );

        if (result.rows.length === 0) {
            return res.redirect(
                "/trainings?error=Eğitim kaydı bulunamadı."
            );
        }

        return res.redirect(
            "/trainings?success=Eğitim başarıyla güncellendi."
        );
    } catch (error) {
        console.error("Eğitim güncelleme hatası:", error.message);

        return res.redirect(
            `/trainings/${req.params.id}/edit?error=Eğitim güncellenemedi.`
        );
    }
});

// Eğitimi sil
app.post("/trainings/:id/delete", async (req, res) => {
    try {
        const result = await pool.query(
            `
            DELETE FROM trainings
            WHERE id = $1
            RETURNING id
            `,
            [req.params.id]
        );

        if (result.rows.length === 0) {
            return res.redirect(
                "/trainings?error=Eğitim kaydı bulunamadı."
            );
        }

        return res.redirect(
            "/trainings?success=Eğitim başarıyla silindi."
        );
    } catch (error) {
        console.error("Eğitim silme hatası:", error.message);

        return res.redirect(
            "/trainings?error=Eğitim silinemedi."
        );
    }
});

// 404 daima bütün rotalardan sonra
app.use((req, res) => {
    res.status(404).send("Sayfa bulunamadı.");
});

app.use((error, req, res, next) => {
    console.error("Beklenmeyen uygulama hatası:", error.message);

    if (res.headersSent) {
        return next(error);
    }

    return res.status(500).send("Beklenmeyen bir hata oluştu.");
});

// Sunucuyu yalnızca bir kere başlat
app.listen(PORT, () => {
    console.log(`HR Nova çalışıyor: http://localhost:${PORT}`);
});
