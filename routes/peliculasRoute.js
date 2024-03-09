const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
const jwt = require('jsonwebtoken')
const moment = require('moment');

const usuarios = require('../models/Users');
const Pelicula = require('../models/peliculas');

router.get('/peliculas',[validaToken], async (req, res) => {
    // console.log(req.user)
    try {
        const usuarioID = await usuarios.findOne({_id: req.user.id});
        // console.log(usuarioID)
        res.json('200', {
            usuario: usuarioID.peliculas,
        })
    } catch (error) {
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.get('/pelicula/:peliculaId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const peliculaId = req.params.peliculaId;
    const { fecha, titulo, director, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const pelicula = user.peliculas.find(pelicula => pelicula._id.toString() === peliculaId);
        if (!pelicula) {
            return res.status(404).json({ error: true, mensaje: 'Pelicula no encontrada' });
        }
        // Devolver la pelicula encontrado en la respuesta
        res.json(pelicula);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.get('/pelicula/buscar/:texto', [validaToken], async (req, res) => {
    const userId = req.user.id;
    const texto = req.params.texto.toLowerCase().replace(/_/g, ' '); // Convertir el texto proporcionado en minúsculas y reemplazar guiones bajos por espacios;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Buscar la pelicula por su título o director (ignorando mayúsculas y minúsculas) de manera parcial
        const peliculasEncontradas = user.peliculas.filter(pelicula => {
            return pelicula.titulo.toLowerCase().includes(texto) || pelicula.director.toLowerCase().includes(texto) || pelicula.descripcion.toLowerCase().includes(texto);
        });

        if (peliculasEncontradas.length === 0) {
            return res.status(404).json({ message: 'No se encontraron peliculas con ese título o director' });
        }

        // Si se encuentran peliculas, devolverlos como respuesta
        res.status(200).json(peliculasEncontradas);

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.post('/carga-peliculas',[validaToken], async (req, res) => {
    try {

        // Verificar si se proporciona el título de la pelicula
        if (!req.body.titulo) {
            return res.status(400).json({
                error: true,
                mensaje: 'El campo título es obligatorio.'
            });
        }

        const usuarioDB = await usuarios.findOne({_id: req.user.id});

        // Obtener la fecha actual
        const fechaActual = moment().startOf('day');

        // Convertir la fecha de la pelicula a un objeto Moment
        const fechaPelicula = moment(req.body.fecha);

        // Verificar si la fecha de la pelicula es posterior al día actual
        if (fechaPelicula.isAfter(fechaActual)) {
            return res.status(400).json({
                error: true,
                mensaje: 'La fecha de la pelicula no puede ser posterior al día actual.'
            });
        }

        // Crear nuev Pelicula
        const pelicula = new Pelicula({
            fecha: fechaPelicula.toDate(),
            titulo: req.body.titulo,
            director: req.body.director,
            descripcion: req.body.descripcion
        });
        
        // Agregar la pelicula al array de peliculas del usuario
        usuarioDB.peliculas.push(pelicula);

         // Guardar los cambios en la base de datos
         await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Pelicula cargada correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: 'ocurre un error en el server: ', error
        })
    }
});

router.delete('/pelicula/:idPelicula', [validaToken], async (req, res) => {
    try {
      const usuarioId = req.user.id;
      const peliculaId = req.params.idPelicula;
  
      // Buscar al usuario por su ID
      const usuario = await usuarios.findById(usuarioId);
  
      // Verificar si el usuario existe
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
  
      // Buscar el índice de la pelicula en el array de peliculas del usuario
      const indicePelicula = usuario.peliculas.findIndex(pelicula => pelicula._id.toString() === peliculaId);
  
      // Verificar si e la pelicula existe en el array de peliculas del usuario
      if (indicePelicula === -1) {
        return res.status(404).json({ mensaje: 'pelicula no encontrada para este usuario' });
      }
  
      // Eliminar el pelicula del array de peliculas del usuario
      usuario.peliculas.splice(indicePelicula, 1);
  
      // Guardar los cambios en la base de datos
      await usuario.save();
  
      // Respuesta exitosa
      res.json({ mensaje: 'Pelicula eliminada correctamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

router.put('/pelicula/:peliculaId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const peliculaId = req.params.peliculaId;
    const { fecha, titulo, director, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar si la pelicula existe en el array de peliculas del usuario
        const peliculaIndex = user.peliculas.findIndex(pelicula => pelicula._id.toString() === peliculaId);
        if (peliculaIndex === -1) {
            return res.status(404).json({ message: 'pelicula no encontrado' });
        }

        // Verificar si se proporciona el título de la pelicula
        if (!titulo) {
            return res.status(400).json({ message: 'El campo título es obligatorio para editar una pelicula' });
        }

        // Verificar si la fecha de la pelicula es posterior al día actual
        if (fecha) {
            const fechaActual = moment().startOf('day');
            const fechaPelicula = moment(fecha);
            if (fechaPelicula.isAfter(fechaActual)) {
                return res.status(400).json({ message: 'La fecha de la pelicula no puede ser posterior al día actual' });
            }
        }

        // Actualizar los datos del pelicula
        if (fecha) user.peliculas[peliculaIndex].fecha = fecha;
        if (titulo) user.peliculas[peliculaIndex].titulo = titulo;
        if (director) user.peliculas[peliculaIndex].director = director;
        if (descripcion) user.peliculas[peliculaIndex].descripcion = descripcion;

        // Guardar el usuario actualizado en la base de datos
        await user.save();

        res.json({ message: 'pelicula actualizada correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router