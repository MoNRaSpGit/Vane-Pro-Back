const mysql = require('mysql2');

// Configuración del pool
const pool = mysql.createPool({
    host: 'bgitowqf6ymtivd9wzjd-mysql.services.clever-cloud.com',
    user: 'us0fwdi7vvrhtyte',
    password: 'zcM0nR4SUpyoZGCmYDmL',
    database: 'bgitowqf6ymtivd9wzjd',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Exportar el pool para usar en el resto del proyecto
module.exports = pool;
