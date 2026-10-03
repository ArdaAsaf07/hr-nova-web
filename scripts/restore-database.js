require("dotenv").config();

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

function askConfirmation() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    return new Promise(resolve => {
        rl.question("Mevcut veriler değiştirilecek. Devam etmek için RESTORE yazın: ", answer => {
            rl.close();
            resolve(answer === "RESTORE");
        });
    });
}

async function main() {
    const inputPath = process.argv[2];

    if (!inputPath) {
        throw new Error("Kullanım: node scripts/restore-database.js <yedek-dosyası> ");
    }

    const backupPath = path.resolve(inputPath);
    const backupRoot = path.resolve(__dirname, "..", "backups");

    if (!backupPath.startsWith(backupRoot + path.sep) || !fs.existsSync(backupPath)) {
        throw new Error("Yedek dosyası proje içindeki backups klasöründe bulunmalıdır.");
    }

    const candidates = [
        "pg_restore",
        "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_restore.exe",
        "C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\pg_restore.exe",
        "C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe",
        "C:\\Program Files\\PostgreSQL\\17\\pgAdmin 4\\runtime\\pg_restore.exe"
    ];
    const pgRestoreCommand = candidates.find(candidate => {
        const version = spawnSync(candidate, ["--version"], { encoding: "utf8", windowsHide: true });
        return !version.error && version.status === 0;
    });

    if (!pgRestoreCommand) {
        throw new Error("pg_restore bulunamadı. Önce PostgreSQL client tools kurulmalıdır.");
    }

    if (!(await askConfirmation())) {
        console.log("Geri yükleme iptal edildi.");
        return;
    }

    const databaseUrl = new URL(process.env.DATABASE_URL);
    const result = spawnSync(pgRestoreCommand, [
        "--clean",
        "--if-exists",
        "--no-owner",
        "--no-privileges",
        "--host", databaseUrl.hostname,
        "--port", databaseUrl.port || "5432",
        "--username", decodeURIComponent(databaseUrl.username),
        "--dbname", databaseUrl.pathname.slice(1),
        backupPath
    ], {
        stdio: "inherit",
        windowsHide: true,
        env: {
            ...process.env,
            PGPASSWORD: decodeURIComponent(databaseUrl.password),
            PGSSLMODE: "require",
            PGCHANNELBINDING: "require"
        }
    });

    if (result.status !== 0) {
        throw new Error("Veritabanı geri yüklenemedi.");
    }

    console.log("Veritabanı geri yüklendi.");
}

main().catch(error => {
    console.error(`Geri yükleme hatası: ${error.message}`);
    process.exitCode = 1;
});
