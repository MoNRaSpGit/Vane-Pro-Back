const mysql = require('mysql2');

// Configuración de la conexión
const db = mysql.createConnection({
    host: 'bgitowqf6ymtivd9wzjd-mysql.services.clever-cloud.com',
    user: 'us0fwdi7vvrhtyte',
    password: 'zcM0nR4SUpyoZGCmYDmL',
    database: 'bgitowqf6ymtivd9wzjd',
    port: 3306
});

// Conectar a la base de datos
db.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
    } else {
        console.log('Conexión exitosa a la base de datos.');
    }
});

module.exports = db;
