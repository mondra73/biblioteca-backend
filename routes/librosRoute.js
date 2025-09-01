const router = require("express").Router();
const moment = require("moment");
const Joi = require("@hapi/joi");

const usuarios = require("../models/Users");
const Libro = require("../models/libros");

const schemaCargaLibros = Joi.object({
  fecha: Joi.date().required().max('now').messages({
    'date.max': 'La fecha no puede ser futura'
  }),
  titulo: Joi.string().required().messages({
    'string.empty': 'El título es requerido'
  }),
  autor: Joi.string().required().messages({
    'string.empty': 'El autor es requerido'
  }),
  genero: Joi.string().allow('').optional(),
  descripcion: Joi.string().allow('').optional(),
  valuacion: Joi.number().integer().min(1).max(5).allow(null).optional().messages({
    'number.min': 'La valoración debe ser al menos 1',
    'number.max': 'La valoración no puede ser mayor a 5'
  })
});

router.get("/libros", async (req, res) => {
  const PAGE_SIZE = 20; // Número de libros por página
  try {
    // Obtener el número de página desde la consulta
    const page = parseInt(req.query.page) || 1;

    // Obtener el usuario actual con sus libros
    const usuario = await usuarios.findOne({ _id: req.user.id });

    if (!usuario) {
      return res.status(404).json({
        error: true,
        mensaje: "Usuario no encontrado",
      });
    }

    // Normalizar fechas y seleccionar solo los campos necesarios de cada libro
    const librosNormalizados = usuario.libros.map((libro) => ({
      id: libro._id || libro.id, // dependiendo de cómo lo tengas en tu schema
      titulo: libro.titulo,
      autor: libro.autor,
      fecha: libro.fecha ? new Date(libro.fecha) : new Date(0),
      genero: libro.genero,
      descripcion: libro.descripcion,
      valuacion: libro.valuacion 
    }));

    // Ordenar los libros por fecha de lectura (más reciente primero)
    const librosOrdenados = librosNormalizados.sort(
      (a, b) => b.fecha - a.fecha
    );

    // Obtener el total de libros del usuario
    const totalLibros = librosOrdenados.length;

    // Calcular el índice de inicio del primer elemento de la página actual
    const startIndex = (page - 1) * PAGE_SIZE;

    // Aplicar paginación sobre el array ordenado
    const librosPaginados = librosOrdenados.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );

    // Calcular el número total de páginas
    const totalPages = Math.ceil(totalLibros / PAGE_SIZE);

    // Responder con los datos paginados
    res.status(200).json({
      libros: librosPaginados,
      totalPages,
      currentPage: page,
      totalLibros,
    });
  } catch (error) {
    res.status(400).json({
      error: true,
      mensaje: error.message,
    });
  }
});

router.get("/libro/buscar/:texto", async (req, res) => {
  const PAGE_SIZE = 20;
  const userId = req.user.id;
  const texto = req.params.texto.toLowerCase().replace(/_/g, " ");
  const page = parseInt(req.query.page) || 1; // Obtenemos el número de página

  try {
    // Verificar si el usuario existe
    const user = await usuarios.findById(userId);
    if (!user) {
      return res.status(404).json({
        error: true,
        mensaje: "Usuario no encontrado",
      });
    }

    // Buscar libros que coincidan con el texto
    const librosEncontrados = user.libros.filter((libro) => {
      return (
        libro.titulo.toLowerCase().includes(texto) ||
        libro.autor.toLowerCase().includes(texto) ||
        libro.genero.toLowerCase().includes(texto) ||
        libro.descripcion.toLowerCase().includes(texto)
      );
    });
    if (librosEncontrados.length === 0) {
      return res.status(404).json({
        error: true,
        mensaje: "No se encontraron libros que coincidan con la búsqueda",
      });
    }

    // Normalizar fechas como en el otro endpoint
    const librosNormalizados = librosEncontrados.map((libro) => ({
      id: libro._id || libro.id,
      titulo: libro.titulo,
      autor: libro.autor,
      fecha: libro.fecha ? new Date(libro.fecha) : new Date(0),
      genero: libro.genero,
      descripcion: libro.descripcion,
    }));

    // Ordenar por fecha (más reciente primero)
    const librosOrdenados = librosNormalizados.sort(
      (a, b) => b.fecha - a.fecha
    );

    // Aplicar paginación
    const startIndex = (page - 1) * PAGE_SIZE;
    const librosPaginados = librosOrdenados.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
    const totalLibros = librosOrdenados.length;
    const totalPages = Math.ceil(totalLibros / PAGE_SIZE);

    // Responder con la estructura similar al otro endpoint
    res.status(200).json({
      libros: librosPaginados,
      totalPages,
      currentPage: page,
      totalLibros,
      textoBuscado: texto, // Opcional: para que el cliente sepa qué se buscó
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      mensaje: error.message || "Error interno del servidor",
    });
  }
});

router.get("/libro/:libroId", async (req, res) => {
  const userId = req.user.id;
  const libroId = req.params.libroId;

  try {
    // Verificar si el usuario existe
    const user = await usuarios.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const libro = user.libros.find((libro) => libro._id.toString() === libroId);
    if (!libro) {
      return res
        .status(404)
        .json({ error: true, mensaje: "Libro no encontrado" });
    }
    
    res.json({
      id: libro._id,
      titulo: libro.titulo,
      autor: libro.autor,
      fecha: libro.fecha,
      genero: libro.genero,
      descripcion: libro.descripcion,
      valuacion: libro.valuacion 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

router.post("/carga-libros", async (req, res) => {
  try {
    // Validar los datos del cuerpo de la solicitud
    const { error } = schemaCargaLibros.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: true,
        mensaje: error.details[0].message,
      });
    }

    const usuarioDB = await usuarios.findOne({ _id: req.user.id });
    const fechaActual = moment().startOf("day"); // Fecha actual sin la hora
    const fechaLibro = moment(req.body.fecha).startOf("day"); // Fecha del libro sin la hora

    if (fechaLibro.isAfter(fechaActual)) {
      return res.status(400).json({
        error: true,
        mensaje: "La fecha del libro no puede ser posterior al día actual.",
      });
    }

    const libro = new Libro({
      fecha: fechaLibro.toDate(),
      titulo: req.body.titulo,
      autor: req.body.autor,
      genero: req.body.genero,
      descripcion: req.body.descripcion,
      valuacion: req.body.valuacion || null
    });

    usuarioDB.libros.push(libro);
    await usuarioDB.save();

    res.status(200).json({
      mensaje: "Libro cargado correctamente",
    });
  } catch (error) {
    console.log(error);
    res.status(400).json({
      error: true,
      mensaje: "ocurre un error en el servidor: " + error,
    });
  }
});

router.delete("/libro/:idLibro", async (req, res) => {
  try {
    const usuarioId = req.user.id;
    const libroId = req.params.idLibro;

    // Buscar al usuario por su ID
    const usuario = await usuarios.findById(usuarioId);

    // Verificar si el usuario existe
    if (!usuario) {
      return res.status(404).json({ mensaje: "Usuario no encontrado" });
    }

    // Buscar el índice del libro en el array de libros del usuario
    const indiceLibro = usuario.libros.findIndex(
      (libro) => libro._id.toString() === libroId
    );

    // Verificar si el libro existe en el array de libros del usuario
    if (indiceLibro === -1) {
      return res
        .status(404)
        .json({ mensaje: "Libro no encontrado para este usuario" });
    }

    // Eliminar el libro del array de libros del usuario
    usuario.libros.splice(indiceLibro, 1);

    // Guardar los cambios en la base de datos
    await usuario.save();

    // Respuesta exitosa
    res.json({ mensaje: "Libro eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error del servidor" });
  }
});

router.put("/libro/:libroId", async (req, res) => {
  const userId = req.user.id;
  const libroId = req.params.libroId;
  const { fecha, titulo, autor, genero, descripcion, valuacion } = req.body; // Agregar valuacion

  try {
    // Verificar si el usuario existe
    const user = await usuarios.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Verificar si el libro existe en el array de libros del usuario
    const libroIndex = user.libros.findIndex(
      (libro) => libro._id.toString() === libroId
    );
    if (libroIndex === -1) {
      return res.status(404).json({ message: "Libro no encontrado" });
    }

    // Verificar si se proporciona el título del libro
    if (!titulo) {
      return res.status(400).json({
        message: "El campo título es obligatorio para editar un libro",
      });
    }

    // Verificar si la fecha del libro es posterior al día actual
    if (fecha) {
      const fechaActual = moment().startOf("day");
      const fechaLibro = moment(fecha).startOf("day");
      if (fechaLibro.isAfter(fechaActual)) {
        return res.status(400).json({
          message: "La fecha del libro no puede ser posterior al día actual",
        });
      }
    }

    // Validar valoración si está presente
    if (valuacion !== undefined && (valuacion < 1 || valuacion > 5)) {
      return res.status(400).json({
        message: "La valoración debe estar entre 1 y 5",
      });
    }

    // Actualizar los datos del libro
    if (fecha) user.libros[libroIndex].fecha = fecha;
    if (titulo) user.libros[libroIndex].titulo = titulo;
    if (autor) user.libros[libroIndex].autor = autor;
    if (genero) user.libros[libroIndex].genero = genero;
    if (descripcion) user.libros[libroIndex].descripcion = descripcion;
    if (valuacion !== undefined) user.libros[libroIndex].valuacion = valuacion; // Agregar valuacion

    // Guardar el usuario actualizado en la base de datos
    await user.save();

    res.json({ message: "Libro actualizado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

module.exports = router;
