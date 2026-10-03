require("dotenv").config();

const readline = require("readline");
const pool = require("../db");
const { hashPassword } = require("../lib/password");

function prompt(question, hidden = false) {
    return new Promise((resolve) => {
        const input = process.stdin;
        const output = process.stdout;

        if (!hidden || !input.isTTY) {
            const rl = readline.createInterface({ input, output });

            rl.question(question, (answer) => {
                rl.close();
                resolve(answer);
            });
            return;
        }

        output.write(question);
        input.setRawMode(true);
        input.resume();
        input.setEncoding("utf8");
        let value = "";

        function onData(character) {
            if (character === "\r" || character === "\n") {
                input.setRawMode(false);
                input.pause();
                input.removeListener("data", onData);
                output.write("\n");
                resolve(value);
                return;
            }

            if (character === "\u0003") {
                process.exit(130);
            }

            if (character === "\u007f" || character === "\b") {
                value = value.slice(0, -1);
                return;
            }

            value += character;
        }

        input.on("data", onData);
    });
}

function validatePassword(password) {
    return password.length >= 8;
}

async function main() {
    const username = (await prompt("Kullanıcı adı: ")).trim().toLowerCase();
    const displayName = (await prompt("Görünen ad: ")).trim();
    const password = await prompt("Parola (ekranda görünmez): ", true);
    const confirmation = await prompt("Parolayı tekrar girin: ", true);

    if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
        throw new Error("Kullanıcı adı 3-50 karakter olmalı ve yalnızca küçük harf, rakam, nokta, alt çizgi veya tire içermelidir.");
    }

    if (!displayName || displayName.length > 100) {
        throw new Error("Görünen ad 1-100 karakter olmalıdır.");
    }

    if (!validatePassword(password)) {
        throw new Error("Parola en az 8 karakter olmalıdır.");
    }

    if (password !== confirmation) {
        throw new Error("Parolalar eşleşmiyor.");
    }

    const passwordHash = await hashPassword(password);

    await pool.query(
        `INSERT INTO users (username, display_name, password_hash, role)
         VALUES ($1, $2, $3, 'admin')`,
        [username, displayName, passwordHash]
    );

    console.log(`Yönetici hesabı oluşturuldu: ${username}`);
}

main()
    .catch((error) => {
        if (error.code === "23505") {
            console.error("Bu kullanıcı adı zaten kullanılıyor.");
        } else {
            console.error(error.message);
        }

        process.exitCode = 1;
    })
    .finally(() => pool.end());
