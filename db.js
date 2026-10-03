const { Pool } = require("pg");

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: true,
    },
});

async function connect() {
    const client = await pool.connect();

    try {
        await client.query("SET search_path TO public");
        return client;
    } catch (error) {
        client.release();
        throw error;
    }
}

async function query(...args) {
    const client = await connect();

    try {
        return await client.query(...args);
    } finally {
        client.release();
    }
}

module.exports = {
    connect,
    query,
    end: () => pool.end()
};
