const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
// const jwt = require('jsonwebtoken')

const usuarios = require('../models/Users');
const Libro = require('../models/libros');
const Serie = require('../models/series');
const Pelicula = require('../models/peliculas');

// router.get('/',[validaToken], async (req, res) => {
//     // console.log(req.user)
//     try {
//         const usuarioID = await usuarios.findOne({_id: req.user.id});
//         // console.log(usuarioID)
//         res.json('200', {
//             usuario: usuarioID,
//         })
//     } catch (error) {
//         res.json('400', {
//             error: true,
//             mensaje: error
//         })
//     }
// });

// router.post('/carga-libros',[validaToken], async (req, res) => {
//     try {
//         const usuarioDB = await usuarios.findOne({_id: req.user.id});
//         const libro = new Libro(req.body);
//         usuarioDB.libros.push(libro);
//         await usuarioDB.save();
        
//         res.json('200', {
//             mensaje: 'Libro cargado correctamente'
//         })

//     } catch (error) {
//         console.log(error)
//         res.json('400', {
//             error: true,
//             mensaje: error
//         })
//     }
// });


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

router.post('/carga-peliculas',[validaToken], async (req, res) => {
    try {
        const usuarioDB = await usuarios.findOne({_id: req.user.id});
        const pelicula = new Pelicula(req.body);
        usuarioDB.peliculas.push(pelicula);
        await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Pelicula cargada correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

// router.delete('/:idUsuario/libros/:idLibro', [validaToken], async (req, res) => {
//     try {
//       const usuarioId = req.params.idUsuario;
//       const libroId = req.params.idLibro;
  
//       // Buscar al usuario por su ID
//       const usuario = await usuarios.findById(usuarioId);
  
//       // Verificar si el usuario existe
//       if (!usuario) {
//         return res.status(404).json({ mensaje: 'Usuario no encontrado' });
//       }
  
//       // Buscar el índice del libro en el array de libros del usuario
//       const indiceLibro = usuario.libros.findIndex(libro => libro._id.toString() === libroId);
  
//       // Verificar si el libro existe en el array de libros del usuario
//       if (indiceLibro === -1) {
//         return res.status(404).json({ mensaje: 'Libro no encontrado para este usuario' });
//       }
  
//       // Eliminar el libro del array de libros del usuario
//       usuario.libros.splice(indiceLibro, 1);
  
//       // Guardar los cambios en la base de datos
//       await usuario.save();
  
//       // Respuesta exitosa
//       res.json({ mensaje: 'Libro eliminado correctamente' });
//     } catch (error) {
//       console.error(error);
//       res.status(500).json({ mensaje: 'Error del servidor' });
//     }
//   });
   
router.delete('/:idUsuario/peliculas/:idPelicula', [validaToken], async (req, res) => {
    try {
      const usuarioId = req.params.idUsuario;
      const peliculaID = req.params.idPelicula;
  
      // Buscar al usuario por su ID
      const usuario = await usuarios.findById(usuarioId);
  
      // Verificar si el usuario existe
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
  
      // Buscar el índice de la pelicula en el array de peliculas del usuario
      const indicePelicula = usuario.peliculas.findIndex(pelicula => pelicula._id.toString() === peliculaID);
  
      // Verificar si la pelicula existe en el array de peliculas del usuario
      if (indicePelicula === -1) {
        return res.status(404).json({ mensaje: 'Pelicula no encontrada para este usuario' });
      }
  
      // Eliminar la pelicula del array de peliculas del usuario
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

  router.delete('/:idUsuario/series/:idSerie', [validaToken], async (req, res) => {
    try {
      const usuarioId = req.params.idUsuario;
      const serieID = req.params.idSerie;
  
      // Buscar al usuario por su ID
      const usuario = await usuarios.findById(usuarioId);
  
      // Verificar si el usuario existe
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
  
      // Buscar el índice de la serie en el array de series del usuario
      const indiceSerie = usuario.series.findIndex(series => series._id.toString() === serieID);
  
      // Verificar si la serie existe en el array de series del usuario
      if (indiceSerie === -1) {
        return res.status(404).json({ mensaje: 'Serie no encontrada para este usuario' });
      }
  
      // Eliminar la serie del array de series del usuario
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


  
// router.put('/:userId/libros/:libroId', [validaToken], async (req, res) => {
//     const userId = req.params.userId;
//     const libroId = req.params.libroId;
//     const { fecha, titulo, autor, genero, descripcion } = req.body;

//     try {
//         // Verificar si el usuario existe
//         const user = await usuarios.findById(userId);
//         if (!user) {
//             return res.status(404).json({ message: 'Usuario no encontrado' });
//         }

//         // Verificar si el libro existe en el array de libros del usuario
//         const libroIndex = user.libros.findIndex(libro => libro._id.toString() === libroId);
//         if (libroIndex === -1) {
//             return res.status(404).json({ message: 'Libro no encontrado' });
//         }

//         // Actualizar los datos del libro
//         if (fecha) user.libros[libroIndex].fecha = fecha;
//         if (titulo) user.libros[libroIndex].titulo = titulo;
//         if (autor) user.libros[libroIndex].autor = autor;
//         if (genero) user.libros[libroIndex].genero = genero;
//         if (descripcion) user.libros[libroIndex].descripcion = descripcion;

//         // Guardar el usuario actualizado en la base de datos
//         await user.save();

//         res.json({ message: 'Libro actualizado correctamente' });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ message: 'Error interno del servidor' });
//     }
// });

router.put('/:userId/peliculas/:idPelicula', [validaToken], async (req, res) => {
    const userId = req.params.userId;
    const peliculaId = req.params.idPelicula;
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
            return res.status(404).json({ message: 'Pelicula no encontrada' });
        }

        // Actualizar los datos del libro
        if (fecha) user.peliculas[peliculaIndex].fecha = fecha;
        if (titulo) user.peliculas[peliculaIndex].titulo = titulo;
        if (director) user.peliculas[peliculaIndex].director = director;
        if (descripcion) user.peliculas[peliculaIndex].descripcion = descripcion;

        // Guardar el usuario actualizado en la base de datos
        await user.save();

        res.json({ message: 'Pelicula actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

router.put('/:userId/series/:idSerie', [validaToken], async (req, res) => {
    const userId = req.params.userId;
    const serieId = req.params.idSerie;
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
            return res.status(404).json({ message: 'Serie no encontrada' });
        }

        // Actualizar los datos del libro
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