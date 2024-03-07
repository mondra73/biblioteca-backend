const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
const jwt = require('jsonwebtoken')

const usuarios = require('../models/Users');
const Serie = require('../models/series');

router.get('/series',[validaToken], async (req, res) => {
    // console.log(req.user)
    try {
        const usuarioID = await usuarios.findOne({_id: req.user.id});
        // console.log(usuarioID)
        res.json('200', {
            usuario: usuarioID.series,
        })
    } catch (error) {
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.get('/serie/:serieId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const serieId = req.params.serieId;
    const { fecha, titulo, director, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const serie = user.series.find(serie => serie._id.toString() === serieId);
        if (!serie) {
            return res.status(404).json({ error: true, mensaje: 'Serie no encontrada' });
        }
        // Devolver la pelicula encontrado en la respuesta
        res.json(serie);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// get series buscar

router.get('/serie/buscar/:texto', [validaToken], async (req, res) => {
    const userId = req.user.id;
    const texto = req.params.texto.toLowerCase().replace(/_/g, ' '); // Convertir el texto proporcionado en minúsculas y reemplazar guiones bajos por espacios;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Buscar la serie por su título o director (ignorando mayúsculas y minúsculas) de manera parcial
        const seriesEncontradas = user.series.filter(serie => {
            return serie.titulo.toLowerCase().includes(texto) || serie.director.toLowerCase().includes(texto);
        });

        if (seriesEncontradas.length === 0) {
            return res.status(404).json({ message: 'No se encontraron series con ese título o director' });
        }

        // Si se encuentran series, devolverlos como respuesta
        res.status(200).json(seriesEncontradas);

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


router.post('/carga-series',[validaToken], async (req, res) => {
    try {
        const usuarioDB = await usuarios.findOne({_id: req.user.id});
        const serie = new Serie(req.body);
        usuarioDB.series.push(serie);
        await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Serie cargada correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.delete('/serie/:idSerie', [validaToken], async (req, res) => {
    try {
      const usuarioId = req.user.id;
      const serieId = req.params.idSerie;
  
      // Buscar al usuario por su ID
      const usuario = await usuarios.findById(usuarioId);
  
      // Verificar si el usuario existe
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
  
      // Buscar el índice de la sere en el array de peliculas del usuario
      const indiceSerie = usuario.series.findIndex(serie => serie._id.toString() === serieId);
  
      // Verificar si e la pelicula existe en el array de peliculas del usuario
      if (indiceSerie === -1) {
        return res.status(404).json({ mensaje: 'Serie no encontrada para este usuario' });
      }
  
      // Eliminar la serie  del array de peliculas del usuario
      usuario.series.splice(indiceSerie, 1);
  
      // Guardar los cambios en la base de datos
      await usuario.save();
  
      // Respuesta exitosa
      res.json({ mensaje: 'Serie eliminada correctamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

router.put('/serie/:serieId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const serieId = req.params.serieId;
    const { fecha, titulo, director, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar si la serie existe en el array de series del usuario
        const serieIndex = user.series.findIndex(serie => serie._id.toString() === serieId);
        if (serieIndex === -1) {
            return res.status(404).json({ message: 'serie no encontrado' });
        }

        // Actualizar los datos de la serie
        if (fecha) user.series[serieIndex].fecha = fecha;
        if (titulo) user.series[serieIndex].titulo = titulo;
        if (director) user.series[serieIndex].director = director;
        if (descripcion) user.series[serieIndex].descripcion = descripcion;

        // Guardar el usuario actualizado en la base de datos
        await user.save();

        res.json({ message: 'Serie actualizada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router