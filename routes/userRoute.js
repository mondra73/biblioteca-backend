const router = require('express').Router();
const validaToken = require('./validate-token');
const Usuarios = require('../models/Users');
const Libro = require('../models/libros'); // Importa el modelo de libros
const Serie = require('../models/series'); // Importa el modelo de series
const Pelicula = require('../models/peliculas'); // Importa el modelo de películas


// Ruta para obtener estadísticas de libros, series y películas de todos los usuarios
router.get('/estadisticas', [validaToken], async (req, res) => {
  try {
    // Obtener todos los usuarios
    const usuarios = await Usuarios.find();

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

    // Devolver los usuarios con más libros, series y películas
    res.status(200).json({
      usuarioMasLibros,
      usuarioMasSeries,
      usuarioMasPeliculas,
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
    const usuario = await Usuarios.findById(req.user.id);

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


module.exports = router;