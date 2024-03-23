const router = require('express').Router();
const validaToken = require('./validate-token');
const moment = require('moment');
const Joi = require('@hapi/joi');

const usuarios = require('../models/Users');
const Pendiente = require('../models/pendientes');

const schemaCargaPendientes = Joi.object({
    titulo: Joi.string().required().messages({
        'any.required': 'El título es obligatorio.'
    }),
    tipo: Joi.string().required().messages({
        'any.only': 'El tipo debe ser Libros, Peliculas o Series.', }),
    autorDirector: Joi.string().allow('').optional(),
    descripcion: Joi.string().allow('').optional(),
});

// FUNCIONANDO
router.get('/pendientes',[validaToken], async (req, res) => {
    // console.log(req.user)
    try {
        const usuarioID = await usuarios.findOne({_id: req.user.id});
        // console.log(usuarioID)
        res.json('200', {
            usuario: usuarioID.pendientes,
        })
    } catch (error) {
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

// Busca pendiente cuando clickeas. Para despues editarlo o eliminarlo. FUNCIONANDO
router.get('/pendiente/:pendienteId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const pendienteId = req.params.pendienteId;
    const { titulo, autorDirector, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findOne({ _id: userId });
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        const pendiente = user.pendientes.find(pendiente => pendiente._id.toString() === pendienteId);
        if (!pendiente) {
            return res.status(404).json({ error: true, mensaje: 'Pendiente no encontrado' });
        }
        // Devolver el pendiente encontrado en la respuesta
        res.json(pendiente);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});

// FUNCIONANDO
router.post('/carga-pendientes', [validaToken], async (req, res) => {
    try {
        // Validar los datos del cuerpo de la solicitud
        const { error } = schemaCargaPendientes.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: true,
                mensaje: error.details[0].message
            });
        }

        const usuarioDB = await usuarios.findOne({ _id: req.user.id });
                
        const pendiente = new Pendiente({
            titulo: req.body.titulo,
            autorDirector: req.body.autorDirector,
            descripcion: req.body.descripcion,
            tipo: req.body.tipo
        });

        usuarioDB.pendientes.push(pendiente);
        await usuarioDB.save();

        res.status(200).json({
            mensaje: 'Pendiente cargado correctamente'
        });

    } catch (error) {
        console.log(error);
        res.status(400).json({
            error: true,
            mensaje: 'ocurre un error en el servidor: ' + error
        });
    }
});

// FUNCIONANDO
router.delete('/pendiente/:idPendiente', [validaToken], async (req, res) => {
    try {
      const usuarioId = req.user.id;
      const pendienteId = req.params.idPendiente;
  
      // Buscar al usuario por su ID
      const usuario = await usuarios.findById(usuarioId);
  
      // Verificar si el usuario existe
      if (!usuario) {
        return res.status(404).json({ mensaje: 'Usuario no encontrado' });
      }
  
      // Buscar el índice del pendiente en el array de pendientes del usuario
      const indicePendiente = usuario.pendientes.findIndex(pendiente => pendiente._id.toString() === pendienteId);
  
      // Verificar si el pendiente existe en el array de pendientes del usuario
      if (indicePendiente === -1) {
        return res.status(404).json({ mensaje: 'Pendiente no encontrado para este usuario' });
      }
  
      // Eliminar el pendiente del array de pendientes del usuario
      usuario.pendientes.splice(indicePendiente, 1);
  
      // Guardar los cambios en la base de datos
      await usuario.save();
  
      // Respuesta exitosa
      res.json({ mensaje: 'Pendiente eliminado correctamente' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ mensaje: 'Error del servidor' });
    }
});

// FUNCIONANDO
router.put('/pendiente/:pendienteId', [validaToken], async (req, res) => {
    const userId = req.user.id
    const pendienteId = req.params.pendienteId;
    const { titulo, autorDirector, descripcion } = req.body;

    try {
        // Verificar si el usuario existe
        const user = await usuarios.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'Usuario no encontrado' });
        }

        // Verificar si el pendiente existe en el array de pendientes del usuario
        const pendienteIndex = user.pendientes.findIndex(pendiente => pendiente._id.toString() === pendienteId);
        if (pendienteIndex === -1) {
            return res.status(404).json({ message: 'Pendiente no encontrado' });
        }

        // Verificar si se proporciona el título del pendiente
        if (!titulo) {
            return res.status(400).json({ message: 'El campo título es obligatorio para editar un pendiente' });
        }

        // Actualizar los datos del pendiente

        if (titulo) user.pendientes[pendienteIndex].titulo = titulo;
        if (autorDirector) user.pendientes[pendienteIndex].autorDirector = autorDirector;
        if (descripcion) user.pendientes[pendienteIndex].descripcion = descripcion;

        // Guardar el usuario actualizado en la base de datos
        await user.save();

        res.json({ message: 'Pendiente actualizado correctamente' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
});


// Analizar despues si vale la pena poner un buscador aca

// router.get('/pendiente/buscar/:texto', [validaToken], async (req, res) => {
//     const userId = req.user.id;
//     const texto = req.params.texto.toLowerCase().replace(/_/g, ' '); // Convertir el texto proporcionado en minúsculas y reemplazar guiones bajos por espacios;

//     try {
//         // Verificar si el usuario existe
//         const user = await usuarios.findById(userId);
//         if (!user) {
//             return res.status(404).json({ message: 'Usuario no encontrado' });
//         }

//         // Buscar el libro por su título o autor (ignorando mayúsculas y minúsculas) de manera parcial
//         const librosEncontrados = user.libros.filter(libro => {
//             return libro.titulo.toLowerCase().includes(texto) || libro.autor.toLowerCase().includes(texto) || libro.genero.toLowerCase().includes(texto) || libro.descripcion.toLowerCase().includes(texto);
//         });

//         if (librosEncontrados.length === 0) {
//             return res.status(404).json({ message: 'No se encontraron libros con ese título o autor' });
//         }

//         // Si se encuentran libros, devolverlos como respuesta
//         res.status(200).json(librosEncontrados);

//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ message: 'Error interno del servidor' });
//     }
// });

module.exports = router