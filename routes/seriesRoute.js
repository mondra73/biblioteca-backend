const router = require('express').Router();
const moment = require('moment');
const Joi = require('@hapi/joi');

const usuarios = require('../models/Users');
const Serie = require('../models/series');

const schemaCargaSeries = Joi.object({
    fecha: Joi.date().required().messages({
        'any.required': 'La fecha es obligatoria.'
    }),
    titulo: Joi.string().required().messages({
        'any.required': 'El título es obligatorio.'
    }),
    director: Joi.string().allow('').optional(),
    descripcion: Joi.string().allow('').optional()
});

router.get('/series', async (req, res) => {

    const PAGE_SIZE = 20;
    try {
        const page = parseInt(req.query.page) || 1;

        const usuario = await usuarios.findOne({_id: req.user.id});

        if (!usuario) {
            return res.status(404).json({
                error: true,
                mensaje: "Usuario no encontrado"
            });
        }
    
        // Normalizar fechas y seleccionar solo los campos necesarios de cada libro
        const seriesNormalizados = usuario.series.map(serie => ({
            id: serie._id || serie.id, // dependiendo de cómo lo tengas en tu schema
            titulo: serie.titulo,
            fecha: serie.fecha ? new Date(serie.fecha) : new Date(0),
            director: serie.director,
            descripcion: serie.descripcion
        }));

        // Ordenar las películas por fecha (más reciente primero)
        const seriesOrdenados = seriesNormalizados.sort((a, b) => b.fecha - a.fecha);

        // Obtener el total de películas del usuario
        const totalSeries = seriesOrdenados.length;
        
        // Calcular el índice de inicio para la paginación
        const startIndex = (page - 1) * PAGE_SIZE;

        // Aplicar paginación
        const seriesPaginados = seriesOrdenados.slice(startIndex, startIndex + PAGE_SIZE);

        // Calcular el número total de páginas
        const totalPages = Math.ceil(totalSeries / PAGE_SIZE);

        // Responder con los datos paginados
        res.status(200).json({
            series: seriesPaginados,
            totalPages,
            currentPage: page,
            totalSeries
        });
    } catch (error) {
        res.json('400', {
            error: true,
            mensaje: error.message
        })
    }
});

router.get('/serie/:serieId', async (req, res) => {
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

router.get('/serie/buscar/:texto', async (req, res) => {
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
            return serie.titulo.toLowerCase().includes(texto) || serie.director.toLowerCase().includes(texto) || serie.descripcion.toLowerCase().includes(texto);
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

router.post('/carga-series',async (req, res) => {
    try {
        // Validar los datos del cuerpo de la solicitud
        const { error } = schemaCargaSeries.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: true,
                mensaje: error.details[0].message
            });
        }

        const usuarioDB = await usuarios.findOne({_id: req.user.id});

        // Obtener la fecha actual
        const fechaActual = moment().startOf('day'); // Fecha actual sin la hora

        // Convertir la fecha de la serie a un objeto Moment
        const fechaSerie = moment(req.body.fecha).startOf('day'); // Fecha del libro sin la hora

        // Verificar si la fecha de la serie es posterior al día actual
        if (fechaSerie.isAfter(fechaActual)) {
            return res.status(400).json({
                error: true,
                mensaje: 'La fecha de la serie no puede ser posterior al día actual.'
            });
        }

        // Crear nueva Serie
        const serie = new Serie({
            fecha: fechaSerie.toDate(),
            titulo: req.body.titulo,
            director: req.body.director,
            descripcion: req.body.descripcion
        });

        // Agregar la serie al array de series del usuario
        usuarioDB.series.push(serie);

         // Guardar los cambios en la base de datos
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

router.delete('/serie/:idSerie', async (req, res) => {
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

router.put('/serie/:serieId', async (req, res) => {
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

        // Verificar si se proporciona el título de la serie
        if (!titulo) {
            return res.status(400).json({ message: 'El campo título es obligatorio para editar una serie' });
        }

        // Verificar si la fecha de la serie es posterior al día actual
        if (fecha) {
            const fechaActual = moment().startOf('day');
            const fechaSerie = moment(fecha).startOf('day');
            if (fechaSerie.isAfter(fechaActual)) {
                return res.status(400).json({ message: 'La fecha de la serie no puede ser posterior al día actual' });
            }
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