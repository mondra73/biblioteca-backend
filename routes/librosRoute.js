const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
const jwt = require('jsonwebtoken')

const usuarios = require('../models/Users');
const Libro = require('../models/libros');


router.get('/',[validaToken], async (req, res) => {
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

router.get('/:userId/libro/:libroId', [validaToken], async (req, res) => {
    const userId = req.params.userId;
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


router.post('/carga-libros',[validaToken], async (req, res) => {
    try {
        const usuarioDB = await usuarios.findOne({_id: req.user.id});
        const libro = new Libro(req.body);
        usuarioDB.libros.push(libro);
        await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Libro cargado correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.delete('/:idUsuario/libros/:idLibro', [validaToken], async (req, res) => {
    try {
      const usuarioId = req.params.idUsuario;
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

  router.put('/:userId/libros/:libroId', [validaToken], async (req, res) => {
    const userId = req.params.userId;
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