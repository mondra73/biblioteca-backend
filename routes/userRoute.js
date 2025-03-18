const router = require('express').Router();
const validaToken = require('./validate-token');
const usuarios = require('../models/Users');
const pendientes = require('../models/pendientes');

const Libro = require('../models/libros'); // Importa el modelo de libros
const Serie = require('../models/series'); // Importa el modelo de series
const Pelicula = require('../models/peliculas'); // Importa el modelo de películas


// Ruta para obtener estadísticas de libros, series y películas de todos los usuarios
router.get('/estadisticas', [validaToken], async (req, res) => {
  try {
    // Obtener todos los usuarios
    const usuarios = await usuarios.find();

    // Calcular estadísticas para cada usuario y encontrar los máximos
    let maxLibros = 0, maxSeries = 0, maxPeliculas = 0;
    let usuarioMasLibros = '', usuarioMasSeries = '', usuarioMasPeliculas = '';

    usuarios.forEach(usuario => {
      const numLibros = usuario.libros.length;
      const numSeries = usuario.series.length;
      const numPeliculas = usuario.peliculas.length;

      if (numLibros > maxLibros) {
        maxLibros = numLibros;
        usuarioMasLibros = { nombre: usuario.name, cantidad: numLibros };
      }

      if (numSeries > maxSeries) {
        maxSeries = numSeries;
        usuarioMasSeries = { nombre: usuario.name, cantidad: numSeries };
      }

      if (numPeliculas > maxPeliculas) {
        maxPeliculas = numPeliculas;
        usuarioMasPeliculas = { nombre: usuario.name, cantidad: numPeliculas };
      }
    });

    // Obtener el número total de usuarios en la base de datos
    const numUsuarios = usuarios.length;

    // Devolver los usuarios con más libros, series y películas
    res.status(200).json({
      usuarioMasLibros,
      usuarioMasSeries,
      usuarioMasPeliculas,
      totalUsuarios: numUsuarios // Agregar el número total de usuarios
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas',
    });
  }
});

// Ruta para obtener estadísticas particulares del usuario autenticado
router.get('/estadisticas-user', [validaToken], async (req, res) => {
  try {
    // Obtener el usuario actual autenticado
    const usuario = await usuarios.findById(req.user.id);

    // Calcular estadísticas para el usuario
    const numLibros = usuario.libros.length;
    const numSeries = usuario.series.length;
    const numPeliculas = usuario.peliculas.length;

    // Devolver las estadísticas particulares del usuario
    res.status(200).json({
      libros: numLibros,
      series: numSeries,
      peliculas: numPeliculas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas del usuario',
    });
  }
});

router.post('/movimiento', [validaToken], async (req, res) => {
  
  try {
    const { fecha, titulo, autor, genero, descripcion, pendienteId } = req.body;

    // Validar que todos los campos necesarios están presentes
    if (!fecha || !titulo ) {
        return res.status(400).json({ message: "Faltan datos del libro." });
    }

    const usuarioDB = await usuarios.findOne({ _id: req.user.id });

    // Crear un objeto representando el libro
    const nuevoLibro = {
        fecha,
        titulo,
        autor,
        genero,
        descripcion
    };

    // Agregar el nuevo libro al array 'libros'
  
    usuarioDB.libros.push(nuevoLibro);
    console.log(usuarioDB.pendientes)
    
    // Encontrar y eliminar el libro del array 'pendientes'
     const indicePendiente = usuarioDB.pendientes.findIndex(pendiente => pendiente._id.toString() === pendienteId);

     // Verificar si el pendiente existe en el array de pendientes del usuario
     if (indicePendiente === -1) {
       return res.status(404).json({ mensaje: 'Pendiente no encontrado para este usuario' });
     }
 
     // Eliminar el pendiente del array de pendientes del usuario
     usuarioDB.pendientes.splice(indicePendiente, 1);
 
     // Guardar los cambios en la base de datos
     await usuarioDB.save();

    // Enviar una respuesta de éxito
    res.status(200).json({ message: "El libro ha sido agregado y eliminado de pendientes correctamente." });
} catch (error) {
    // Capturar cualquier error que ocurra durante el proceso y enviar una respuesta de error
    console.error("Error al procesar la solicitud:", error);
    res.status(500).json({ message: "Ha ocurrido un error al procesar la solicitud." });
}
  
});


module.exports = router;