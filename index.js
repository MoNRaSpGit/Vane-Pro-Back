const express = require('express');
const cors = require('cors');
const db = require('./db'); // Conexión a tu base de datos
const app = express();

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Habilitar CORS para todas las solicitudes
app.use(express.json()); // Parsear cuerpos JSON

/*************************************
 *      RUTA DE LOGIN
 *************************************/
app.post('/api/login', (req, res) => {
    const { nombre, password } = req.body;

    console.log('[LOGIN] Datos recibidos:', { nombre, password });

    if (!nombre || !password) {
        return res.status(400).json({ message: 'Faltan datos: nombre o password' });
    }

    const query = 'SELECT id, nombre, rol FROM usuarios WHERE nombre = ? AND password = ?';

    console.log('[LOGIN] Ejecutando consulta:', query);
    db.query(query, [nombre, password], (err, results) => {
        if (err) {
            console.error('[LOGIN] Error al consultar la base de datos:', err.message);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }

        console.log('[LOGIN] Resultados de la consulta:', results);

        if (results.length > 0) {
            const user = results[0];
            console.log('[LOGIN] Usuario autenticado:', user);
            return res.status(200).json(user);
        } else {
            console.log('[LOGIN] Credenciales incorrectas para:', { nombre });
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
        }
    });
});

/*************************************
 *  RUTA PARA INSERTAR CONTROL-OPERACIONAL
 *************************************/
app.post('/api/control-operacional', (req, res) => {
    const {
        empresa,
        obra,
        nucleo,
        fecha,
        hora,
        rut,
        observaciones,
        items
    } = req.body;

    // Calcular totales
    const total_correctos = items.reduce((sum, item) => sum + item.correctos, 0);
    const total_incorrectos = items.reduce((sum, item) => sum + item.incorrectos, 0);
    const indice_co = (total_correctos + total_incorrectos) > 0 
        ? ((total_correctos / (total_correctos + total_incorrectos)) * 100).toFixed(2)
        : 0.00;

    // Insertar en la tabla maestra
    const queryMaestro = `
        INSERT INTO control_operacional_maestro
            (empresa, obra, nucleo, fecha, hora, rut, observaciones, total_correctos, total_incorrectos, indice_co)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresMaestro = [
        empresa, obra, nucleo,
        fecha, hora, rut,
        observaciones, total_correctos,
        total_incorrectos, indice_co
    ];

    console.log('[control-operacional] Consulta SQL (maestro):', queryMaestro);
    console.log('[control-operacional] Valores (maestro):', valoresMaestro);

    db.query(queryMaestro, valoresMaestro, (err, result) => {
        if (err) {
            console.error('[control-operacional] Error al insertar en la tabla maestra:', err.message);
            return res.status(500).json({ message: 'Error al guardar los datos en la tabla maestra.' });
        }

        const maestroId = result.insertId;
        console.log('[control-operacional] Registro maestro insertado con ID:', maestroId);

        if (!items || items.length === 0) {
            console.log('[control-operacional] Sin items en la solicitud.');
            return res.status(200).json({ message: 'Datos guardados correctamente (sin items).', id: maestroId });
        }

        // Preparar la inserción masiva de items
        const queryItems = `
            INSERT INTO control_operacional_items
                (maestro_id, item_principal, item_secundario, correctos, incorrectos, estado_correctos, estado_incorrectos)
            VALUES ?
        `;

        const valoresItems = items.map(item => ([
            maestroId,
            item.item_principal,
            item.item_secundario,
            item.correctos,
            item.incorrectos,
            item.correctos > 0 ? 'verde' : '',
            item.incorrectos > 0 ? 'rojo' : ''
        ]));

        console.log('[control-operacional] Consulta SQL (items):', queryItems);
        console.log('[control-operacional] Valores (items):', valoresItems);

        db.query(queryItems, [valoresItems], (errItems) => {
            if (errItems) {
                console.error('[control-operacional] Error al insertar en la tabla de items:', errItems.message);
                return res.status(500).json({ message: 'Error al guardar los datos en la tabla de items.' });
            }

            console.log('[control-operacional] Items insertados correctamente para el maestro ID:', maestroId);
            return res.status(200).json({
                message: 'Datos guardados correctamente (con items).',
                id: maestroId
            });
        });
    });
});

/*************************************
 *  RUTA PARA INSERTAR BOTIQUÍN
 *************************************/
app.post('/api/botiquin', (req, res) => {
    const { empresa, responsable, fecha, observaciones, items } = req.body;

    if (!empresa || !fecha) {
        return res.status(400).json({ message: 'Empresa y fecha son obligatorios.' });
    }

    const queryMaestro = `
        INSERT INTO botiquin_maestro (empresa, responsable, fecha, observaciones)
        VALUES (?, ?, ?, ?)
    `;

    const valoresMaestro = [empresa, responsable, fecha, observaciones];

    db.query(queryMaestro, valoresMaestro, (err, result) => {
        if (err) {
            console.error('[botiquin] Error al insertar en la tabla maestra:', err.message);
            return res.status(500).json({ message: 'Error al guardar los datos en la tabla maestra.' });
        }

        const maestroId = result.insertId;
        console.log('[botiquin] Registro maestro insertado con ID:', maestroId);

        if (!items || items.length === 0) {
            console.log('[botiquin] Sin items, proceso finalizado.');
            return res.status(200).json({ message: 'Datos guardados correctamente (sin items).', id: maestroId });
        }

        const queryItems = `
            INSERT INTO botiquin_items (maestro_id, elemento, mes, estado)
            VALUES ?
        `;

        const itemsData = items.map(item => [
            maestroId, item.elemento, item.mes, item.estado
        ]);

        db.query(queryItems, [itemsData], (err2) => {
            if (err2) {
                console.error('[botiquin] Error al insertar items:', err2.message);
                return res.status(500).json({ message: 'Error al guardar los datos en la tabla de items.' });
            }
            console.log('[botiquin] Items insertados correctamente para el maestro ID:', maestroId);
            res.status(200).json({ message: 'Datos guardados correctamente.' });
        });
    });
});

/*************************************
 *  RUTA PARA INSERTAR ACCIDENTE
 *************************************/
app.post('/api/accidente', (req, res) => {
    const { empresa, obra, fecha_accidente, hora, fecha_investigacion, rut, observaciones, items } = req.body;

    if (!empresa || !obra || !fecha_accidente || !hora || !rut) {
        return res.status(400).json({ message: 'Empresa, obra, fecha_accidente, hora y RUT son obligatorios.' });
    }

    const queryMaestro = `
        INSERT INTO accidente_maestro (empresa, obra, fecha_accidente, hora, fecha_investigacion, rut, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresMaestro = [empresa, obra, fecha_accidente, hora, fecha_investigacion, rut, observaciones];

    db.query(queryMaestro, valoresMaestro, (err, result) => {
        if (err) {
            console.error('[accidente] Error al insertar en la tabla maestro:', err.message);
            return res.status(500).json({ message: 'Error al guardar los datos en la tabla maestro.' });
        }

        const maestroId = result.insertId;
        console.log('[accidente] Registro maestro insertado con ID:', maestroId);

        if (!items || items.length === 0) {
            console.log('[accidente] Sin items, proceso finalizado.');
            return res.status(200).json({ message: 'Datos guardados correctamente (sin items).', id: maestroId });
        }

        const queryItems = `
            INSERT INTO accidente_items (maestro_id, nombre_campo, valor)
            VALUES ?
        `;

        const itemsData = items.map(item => [
            maestroId,
            item.nombre_campo,
            item.valor
        ]);

        db.query(queryItems, [itemsData], (err2) => {
            if (err2) {
                console.error('[accidente] Error al insertar items:', err2.message);
                return res.status(500).json({ message: 'Error al guardar los datos en la tabla de items.' });
            }

            console.log('[accidente] Items insertados correctamente para el maestro ID:', maestroId);
            res.status(200).json({ message: 'Datos guardados correctamente.' });
        });
    });
});

/*************************************
 *  RUTA PARA INSERTAR NTP330
 *************************************/
app.post('/api/ntp330', (req, res) => {
    const { empresa, obra, responsable, fecha, hora, rut, observaciones, items } = req.body;

    if (!empresa || !obra || !responsable || !fecha || !hora || !rut) {
        return res.status(400).json({ message: 'Empresa, obra, responsable, fecha, hora y RUT son obligatorios.' });
    }

    const queryMaestro = `
        INSERT INTO ntp330_maestro (empresa, obra, responsable, fecha, hora, rut, observaciones)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const valoresMaestro = [empresa, obra, responsable, fecha, hora, rut, observaciones];

    db.query(queryMaestro, valoresMaestro, (err, result) => {
        if (err) {
            console.error('[ntp330] Error al insertar en la tabla maestro:', err.message);
            return res.status(500).json({ message: 'Error al guardar los datos en la tabla maestro.' });
        }

        const maestroId = result.insertId;
        console.log('[ntp330] Registro maestro insertado con ID:', maestroId);

        if (!items || items.length === 0) {
            console.log('[ntp330] Sin items, proceso finalizado.');
            return res.status(200).json({ message: 'Datos guardados correctamente (sin items).', id: maestroId });
        }

        const queryItems = `
            INSERT INTO ntp330_items (maestro_id, nombre_campo, valor)
            VALUES ?
        `;

        const itemsData = items.map(item => [
            maestroId, item.nombre_campo, item.valor
        ]);

        db.query(queryItems, [itemsData], (err2) => {
            if (err2) {
                console.error('[ntp330] Error al insertar en la tabla de items:', err2.message);
                return res.status(500).json({ message: 'Error al guardar los datos en la tabla de items.' });
            }

            console.log('[ntp330] Items insertados correctamente para el maestro ID:', maestroId);
            res.status(200).json({ message: 'Datos guardados correctamente.' });
        });
    });
});

/* ---------------------------*////////////////////



app.get('/api/filtrar', (req, res) => {
    const { empresa, fecha, formulario } = req.query;
  
    console.log('[filtrar] Parámetros:', { empresa, fecha, formulario });
  
    // Validar parámetros
    if (!empresa || !fecha || !formulario) {
      console.log('[filtrar] Faltan parámetros: empresa, fecha, formulario');
      return res.status(400).json({ mensaje: 'Debe proporcionar empresa, fecha y tipo de formulario' });
    }
  
    switch (formulario) {
      case 'control-operacional':
        return filtrarControlOperacional(empresa, fecha, res);
  
      case 'botiquin':
        return filtrarBotiquin(empresa, fecha, res);
  
      case 'accidente':
        return filtrarAccidente(empresa, fecha, res);
  
      case 'ntp330':
        return filtrarNTP330(empresa, fecha, res);
  
      default:
        console.log('[filtrar] Formulario no válido:', formulario);
        return res.status(400).json({ mensaje: 'Formulario no válido' });
    }
  });
  
  /** =========================================================
   * 1) Filtrar Control Operacional (JOIN + JSON_ARRAYAGG)
   * ========================================================= */
  function filtrarControlOperacional(empresa, fecha, res) {
    const query = `
      SELECT 
        m.id,
        m.empresa,
        m.obra,
        m.nucleo,
        DATE_FORMAT(m.fecha, '%Y-%m-%d') AS fecha,
        m.hora,
        m.rut,
        m.observaciones,
        m.total_correctos,
        m.total_incorrectos,
        m.indice_co,
        DATE_FORMAT(m.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'item_principal', i.item_principal,
            'item_secundario', i.item_secundario,
            'correctos', i.correctos,
            'incorrectos', i.incorrectos,
            'estado_correctos', i.estado_correctos,
            'estado_incorrectos', i.estado_incorrectos
          )
        ) AS items
  
      FROM control_operacional_maestro m
      LEFT JOIN control_operacional_items i
             ON m.id = i.maestro_id
      WHERE m.empresa = ?
        AND DATE(m.fecha) = ?
      GROUP BY m.id
    `;
  
    console.log('[filtrarControlOperacional] Ejecutando consulta:', query);
  
    db.query(query, [empresa, fecha], (err, results) => {
      if (err) {
        console.error('[filtrarControlOperacional] Error en la consulta:', err.message);
        return res.status(500).json({ mensaje: 'Error interno del servidor (control-operacional)' });
      }
  
      console.log('[filtrarControlOperacional] Resultados:', results);
  
      if (!results.length) {
        return res.status(404).json({ mensaje: 'No se encontraron datos para los filtros aplicados' });
      }
  
      const finalResults = parseJSONItems(results);
      console.log('[filtrarControlOperacional] finalResults parseados:', finalResults);
  
      return res.status(200).json(finalResults);
    });
  }
  
  /** =========================================================
   * 2) Filtrar Botiquín (JOIN + JSON_ARRAYAGG)
   * ========================================================= */
  function filtrarBotiquin(empresa, fecha, res) {
    const query = `
      SELECT
        bmaestro.id,
        bmaestro.empresa,
        bmaestro.responsable,
        DATE_FORMAT(bmaestro.fecha, '%Y-%m-%d') AS fecha,
        bmaestro.observaciones,
        DATE_FORMAT(bmaestro.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'elemento', bitems.elemento,
            'mes', bitems.mes,
            'estado', bitems.estado
          )
        ) AS items
  
      FROM botiquin_maestro bmaestro
      LEFT JOIN botiquin_items bitems
             ON bmaestro.id = bitems.maestro_id
      WHERE bmaestro.empresa = ?
        AND DATE(bmaestro.fecha) = ?
      GROUP BY bmaestro.id
    `;
  
    console.log('[filtrarBotiquin] Ejecutando consulta:', query);
  
    db.query(query, [empresa, fecha], (err, results) => {
      if (err) {
        console.error('[filtrarBotiquin] Error en la consulta:', err.message);
        return res.status(500).json({ mensaje: 'Error interno del servidor (botiquin)' });
      }
  
      console.log('[filtrarBotiquin] Resultados:', results);
  
      if (!results.length) {
        return res.status(404).json({ mensaje: 'No se encontraron datos para los filtros aplicados' });
      }
  
      const finalResults = parseJSONItems(results);
      console.log('[filtrarBotiquin] finalResults parseados:', finalResults);
  
      return res.status(200).json(finalResults);
    });
  }
  
  /** =========================================================
   * 3) Filtrar Accidente (JOIN + JSON_ARRAYAGG)
   * ========================================================= */
  function filtrarAccidente(empresa, fecha, res) {
    const query = `
      SELECT
        amaestro.id,
        amaestro.empresa,
        amaestro.obra,
        DATE_FORMAT(amaestro.fecha_accidente, '%Y-%m-%d') AS fecha_accidente,
        amaestro.hora,
        DATE_FORMAT(amaestro.fecha_investigacion, '%Y-%m-%d') AS fecha_investigacion,
        amaestro.rut,
        amaestro.observaciones,
        DATE_FORMAT(amaestro.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'nombre_campo', aitems.nombre_campo,
            'valor', aitems.valor
          )
        ) AS items
  
      FROM accidente_maestro amaestro
      LEFT JOIN accidente_items aitems
             ON amaestro.id = aitems.maestro_id
      WHERE amaestro.empresa = ?
        AND DATE(amaestro.fecha_accidente) = ?   -- asumimos que 'fecha' = fecha_accidente
      GROUP BY amaestro.id
    `;
  
    console.log('[filtrarAccidente] Ejecutando consulta:', query);
  
    db.query(query, [empresa, fecha], (err, results) => {
      if (err) {
        console.error('[filtrarAccidente] Error en la consulta:', err.message);
        return res.status(500).json({ mensaje: 'Error interno del servidor (accidente)' });
      }
  
      console.log('[filtrarAccidente] Resultados:', results);
  
      if (!results.length) {
        return res.status(404).json({ mensaje: 'No se encontraron datos para los filtros aplicados' });
      }
  
      const finalResults = parseJSONItems(results);
      console.log('[filtrarAccidente] finalResults parseados:', finalResults);
  
      return res.status(200).json(finalResults);
    });
  }
  
  /** =========================================================
   * 4) Filtrar NTP330 (JOIN + JSON_ARRAYAGG)
   * ========================================================= */
  function filtrarNTP330(empresa, fecha, res) {
    const query = `
      SELECT
        nmaestro.id,
        nmaestro.empresa,
        nmaestro.obra,
        nmaestro.responsable,
        DATE_FORMAT(nmaestro.fecha, '%Y-%m-%d') AS fecha,
        nmaestro.hora,
        nmaestro.rut,
        nmaestro.observaciones,
        DATE_FORMAT(nmaestro.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
  
        JSON_ARRAYAGG(
          JSON_OBJECT(
            'nombre_campo', nitems.nombre_campo,
            'valor', nitems.valor
          )
        ) AS items
  
      FROM ntp330_maestro nmaestro
      LEFT JOIN ntp330_items nitems
             ON nmaestro.id = nitems.maestro_id
      WHERE nmaestro.empresa = ?
        AND DATE(nmaestro.fecha) = ?
      GROUP BY nmaestro.id
    `;
  
    console.log('[filtrarNTP330] Ejecutando consulta:', query);
  
    db.query(query, [empresa, fecha], (err, results) => {
      if (err) {
        console.error('[filtrarNTP330] Error en la consulta:', err.message);
        return res.status(500).json({ mensaje: 'Error interno del servidor (ntp330)' });
      }
  
      console.log('[filtrarNTP330] Resultados:', results);
  
      if (!results.length) {
        return res.status(404).json({ mensaje: 'No se encontraron datos para los filtros aplicados' });
      }
  
      const finalResults = parseJSONItems(results);
      console.log('[filtrarNTP330] finalResults parseados:', finalResults);
  
      return res.status(200).json(finalResults);
    });
  }
  
  /** =========================================================
   *  Función para parsear la columna "items" en JSON
   * ========================================================= */
  function parseJSONItems(results) {
    return results.map(row => {
      // Si items es NULL => no hay items
      if (row.items === null) {
        row.items = [];
      } else if (typeof row.items === 'string') {
        try {
          row.items = JSON.parse(row.items);
        } catch (parseErr) {
          console.error('[parseJSONItems] Error parseando JSON:', parseErr);
          row.items = [];
        }
      }
      return row;
    });
  }
  

 app.post('/api/empresas', (req, res) => {
    const { nombre } = req.body;

    console.log('[EMPRESAS] Datos recibidos del frontend:', { nombre });

    // Validar que el nombre no esté vacío
    if (!nombre || nombre.trim() === '') {
        console.log('[EMPRESAS] El nombre de la empresa es obligatorio');
        return res.status(400).json({ message: 'El nombre de la empresa es obligatorio' });
    }

    // Consulta para insertar la empresa
    const query = 'INSERT INTO empresa (nombre) VALUES (?)';

    console.log('[EMPRESAS] Ejecutando consulta:', query);
    db.query(query, [nombre], (err, result) => {
        if (err) {
            console.error('[EMPRESAS] Error al insertar en la base de datos:', err.message);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    
        console.log('[EMPRESAS] Empresa insertada correctamente:', { id: result.insertId, nombre });
        return res.status(201).json({ 
            message: 'Empresa agregada correctamente', 
            id: result.insertId, 
            nombre: nombre // Asegúrate de incluir el nombre
        });
    });
});




















































/*************************************
 *  INICIAR SERVIDOR
 *************************************/
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
