const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
const jwt = require('jsonwebtoken')
const moment = require('moment');


const usuarios = require('../models/Users');
const Libro = require('../models/libros');


router.get('/libros',[validaToken], async (req, res) => {
    // console.log(req.user)
    try {
        const usuarioID = await usuarios.findOne({_id: req.user.id});
        // console.log(usuarioID)
        res.json('200', {
            usuario: usuarioID.libros,
        })
    } catch (error) {
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

// Busca libro cuando clickeas. Para despues editarlo o eliminarlo
router.get('/libro/:libroId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const libroId = req.params.libroId;
    const { fecha, titulo, autor, genero, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const libro = user.libros.find(libro => libro._id.toString() === libroId);
        if (!libro) {
            return res.status(404).json({ error: true, mensaje: 'Libro no encontrado' });
        }
        // Devolver el libro encontrado en la respuesta
        res.json(libro);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.get('/libro/buscar/:texto', [validaToken], async (req, res) => {
    const userId = req.user.id;
    const texto = req.params.texto.toLowerCase().replace(/_/g, ' '); // Convertir el texto proporcionado en minúsculas y reemplazar guiones bajos por espacios;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Buscar el libro por su título o autor (ignorando mayúsculas y minúsculas) de manera parcial
        const librosEncontrados = user.libros.filter(libro => {
            return libro.titulo.toLowerCase().includes(texto) || libro.autor.toLowerCase().includes(texto) || libro.genero.toLowerCase().includes(texto) || libro.descripcion.toLowerCase().includes(texto);
        });

        if (librosEncontrados.length === 0) {
            return res.status(404).json({ message: 'No se encontraron libros con ese título o autor' });
        }

        // Si se encuentran libros, devolverlos como respuesta
        res.status(200).json(librosEncontrados);

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.post('/carga-libros',[validaToken], async (req, res) => {
    try {
        // Verificar si se proporciona el título del libro
        if (!req.body.titulo) {
            return res.status(400).json({
                error: true,
                mensaje: 'El campo título es obligatorio.'
            });
        }

        const usuarioDB = await usuarios.findOne({_id: req.user.id});

        // Obtener la fecha actual
        const fechaActual = moment().startOf('day');

        // Convertir la fecha del libro a un objeto Moment
        const fechaLibro = moment(req.body.fecha);

        // Verificar si la fecha del libro es posterior al día actual
        if (fechaLibro.isAfter(fechaActual)) {
            return res.status(400).json({
                error: true,
                mensaje: 'La fecha del libro no puede ser posterior al día actual.'
            });
        }

        // Crear el nuevo libro
        const libro = new Libro({
            fecha: fechaLibro.toDate(),
            titulo: req.body.titulo,
            autor: req.body.autor,
            genero: req.body.genero,
            descripcion: req.body.descripcion
        });

        // Agregar el libro al array de libros del usuario
        usuarioDB.libros.push(libro);

         // Guardar los cambios en la base de datos
         await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Libro cargado correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: 'ocurre un error en el server: ', error
        })
    }
});

router.delete('/libro/:idLibro', [validaToken], async (req, res) => {
    try {
      const usuarioId = req.user.id;
      const libroId = req.params.idLibro;
  
      // Buscar al usuario por su ID
      const usuario = await usuarios.findById(usuarioId);
  
      // Verificar si el usuario existe
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
  
      // Buscar el índice del libro en el array de libros del usuario
      const indiceLibro = usuario.libros.findIndex(libro => libro._id.toString() === libroId);
  
      // Verificar si el libro existe en el array de libros del usuario
      if (indiceLibro === -1) {
        return res.status(404).json({ mensaje: 'Libro no encontrado para este usuario' });
      }
  
      // Eliminar el libro del array de libros del usuario
      usuario.libros.splice(indiceLibro, 1);
  
      // Guardar los cambios en la base de datos
      await usuario.save();
  
      // Respuesta exitosa
      res.json({ mensaje: 'Libro eliminado correctamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error del servidor' });
    }
  });

router.put('/libro/:libroId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const libroId = req.params.libroId;
    const { fecha, titulo, autor, genero, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar si el libro existe en el array de libros del usuario
        const libroIndex = user.libros.findIndex(libro => libro._id.toString() === libroId);
        if (libroIndex === -1) {
            return res.status(404).json({ message: 'Libro no encontrado' });
        }

        // Verificar si se proporciona el título del libro
        if (!titulo) {
            return res.status(400).json({ message: 'El campo título es obligatorio para editar un libro' });
        }

        // Verificar si la fecha del libro es posterior al día actual
        if (fecha) {
            const fechaActual = moment().startOf('day');
            const fechaLibro = moment(fecha);
            if (fechaLibro.isAfter(fechaActual)) {
                return res.status(400).json({ message: 'La fecha del libro no puede ser posterior al día actual' });
            }
        }

        // Actualizar los datos del libro
        if (fecha) user.libros[libroIndex].fecha = fecha;
        if (titulo) user.libros[libroIndex].titulo = titulo;
        if (autor) user.libros[libroIndex].autor = autor;
        if (genero) user.libros[libroIndex].genero = genero;
        if (descripcion) user.libros[libroIndex].descripcion = descripcion;

        // Guardar el usuario actualizado en la base de datos
        await user.save();

        res.json({ message: 'Libro actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

module.exports = router