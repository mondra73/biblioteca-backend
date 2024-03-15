const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
const bcrypt = require('bcrypt');
const usuarios = require('../models/Users');
const Libro = require('../models/libros'); // Importa el modelo de libros
const Serie = require('../models/series'); // Importa el modelo de series
const Pelicula = require('../models/peliculas'); // Importa el modelo de películas


// Ruta para obtener estadísticas de libros, series y películas del usuario
router.get('/estadisticas', [validaToken], async (req, res) => {
  try {
    // Obtener el usuario actual
    const usuario = await usuarios.findById(req.user.id);

    // Devolver las listas al frontend
    res.status(200).json({
      libros: usuario.libros,
      series: usuario.series,
      peliculas: usuario.peliculas,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas',
    });
  }
});

// Aca va a ir el router.ger(/ranking) == Que devolvera el listado de los ganadores

module.exports = router