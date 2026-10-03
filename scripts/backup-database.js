require("dotenv").config();

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function resolvePostgresCommand(command) {
    const candidates = [
        command,
        `C:\\Program Files\\PostgreSQL\\18\\bin\\${command}.exe`,
        `C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\${command}.exe`,
        `C:\\Program Files\\PostgreSQL\\17\\bin\\${command}.exe`,
        `C:\\Program Files\\PostgreSQL\\17\\pgAdmin 4\\runtime\\${command}.exe`
    ];

    return candidates.find(candidate => {
        const result = spawnSync(candidate, ["--version"], {
            encoding: "utf8",
            windowsHide: true
        });
        return !result.error && result.status === 0;
    }) || null;
}

function main() {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL bulunamadı.");
    }

    const pgDumpCommand = resolvePostgresCommand("pg_dump");

    if (!pgDumpCommand) {
        throw new Error("pg_dump bulunamadı. Önce PostgreSQL client tools kurulmalıdır.");
    }

    const databaseUrl = new URL(process.env.DATABASE_URL);
    const backupDirectory = path.join(__dirname, "..", "backups");
    fs.mkdirSync(backupDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(backupDirectory, `hr-nova-${timestamp}.dump`);
    const args = [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file", backupPath,
        "--host", databaseUrl.hostname,
        "--port", databaseUrl.port || "5432",
        "--username", decodeURIComponent(databaseUrl.username),
        databaseUrl.pathname.slice(1)
    ];
    const result = spawnSync(pgDumpCommand, args, {
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
        throw new Error("Veritabanı yedeği oluşturulamadı.");
    }

    console.log(`Yedek oluşturuldu: ${backupPath}`);
}

try {
    main();
} catch (error) {
    console.error(`Yedekleme hatası: ${error.message}`);
    process.exitCode = 1;
}
