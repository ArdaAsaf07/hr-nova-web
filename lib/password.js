const crypto = require("crypto");
const { promisify } = require("util");

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const derivedKey = await scrypt(password, salt, KEY_LENGTH);

    return [
        "scrypt",
        salt.toString("hex"),
        derivedKey.toString("hex")
    ].join("$");
}

async function verifyPassword(password, storedHash) {
    const [algorithm, saltHex, hashHex] = String(storedHash || "").split("$");

    if (algorithm !== "scrypt" || !saltHex || !hashHex) {
        return false;
    }

    const expectedHash = Buffer.from(hashHex, "hex");
    const actualHash = await scrypt(password, Buffer.from(saltHex, "hex"), expectedHash.length);

    return expectedHash.length === actualHash.length &&
        crypto.timingSafeEqual(expectedHash, actualHash);
}

module.exports = {
    hashPassword,
    verifyPassword
};
