const mysql = require('mysql2/promise');
require('dotenv').config();

function parseUrl(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'mysql:' && parsed.protocol !== 'mariadb:') return null;
        return {
            host: parsed.hostname,
            port: parseInt(parsed.port, 10) || 3306,
            user: decodeURIComponent(parsed.username || ''),
            password: decodeURIComponent(parsed.password || ''),
            database: decodeURIComponent(parsed.pathname.replace(/^\//, ''))
        };
    } catch (e) {
        return null;
    }
}

function getDbConfig() {
    const fromUrl = parseUrl(
        process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.JAWSDB_URL
    );
    return fromUrl || {
        host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || '3306', 10),
        user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
        password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
        database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'noor_academy'
    };
}

const pool = mysql.createPool({
    ...getDbConfig(),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000
});

module.exports = pool;
module.exports.getDbConfig = getDbConfig;
