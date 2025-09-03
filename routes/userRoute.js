const router = require('express').Router();
const usuarios = require('../models/Users');

// Usuarios que estan primeros en cada una de las categorias (Nombre y cantidad)
router.get('/estadisticas', async (req, res) => {
  try {
    // Obtener todos los usuarios
    const allUsers = await usuarios.find();

    // Arrays para almacenar los top 3 de cada categoría
    let topLibros = [];
    let topSeries = [];
    let topPeliculas = [];

    // Calcular estadísticas para cada usuario
    allUsers.forEach(usuario => {
      const numLibros = usuario.libros ? usuario.libros.length : 0;
      const numSeries = usuario.series ? usuario.series.length : 0;
      const numPeliculas = usuario.peliculas ? usuario.peliculas.length : 0;

      // Agregar a los arrays correspondientes
      if (numLibros > 0) {
        topLibros.push({ nombre: usuario.name, cantidad: numLibros });
      }
      if (numSeries > 0) {
        topSeries.push({ nombre: usuario.name, cantidad: numSeries });
      }
      if (numPeliculas > 0) {
        topPeliculas.push({ nombre: usuario.name, cantidad: numPeliculas });
      }
    });

    // Función para ordenar y obtener top 3
    const obtenerTop3 = (array) => {
      return array
        .sort((a, b) => b.cantidad - a.cantidad) // Ordenar descendente
        .slice(0, 3); // Tomar primeros 3
    };

    // Obtener los top 3 de cada categoría
    const top3Libros = obtenerTop3(topLibros);
    const top3Series = obtenerTop3(topSeries);
    const top3Peliculas = obtenerTop3(topPeliculas);

    // Obtener el número total de usuarios en la base de datos
    const numUsuarios = allUsers.length;

    // Devolver los top 3 de cada categoría
    res.status(200).json({
      topLibros: top3Libros,
      topSeries: top3Series,
      topPeliculas: top3Peliculas,
      totalUsuarios: numUsuarios
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas',
    });
  }
});

// Endpoint nuevos para individualizar las cantidades en los componentes del front

router.get('/estadisticas-libros', async (req, res) => {
  try {
    // Obtener todos los usuarios
    const allUsers = await usuarios.find();

    // Calcular estadísticas de libros
    let totalLibros = 0;
    let topLibros = [];

    allUsers.forEach(usuario => {
      const numLibros = usuario.libros ? usuario.libros.length : 0;
      
      // Sumar al total
      totalLibros += numLibros;
      
      // Agregar al array para top usuarios
      if (numLibros > 0) {
        topLibros.push({ 
          nombre: usuario.name, 
          cantidad: numLibros,
          userId: usuario._id // Opcional: incluir ID del usuario
        });
      }
    });

    // Obtener top 3 usuarios con más libros
    const top3Libros = topLibros
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 3);

    // Devolver estadísticas de libros
    res.status(200).json({
      totalLibros: totalLibros,
      topUsuarios: top3Libros,
      totalUsuariosConLibros: topLibros.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas de libros',
    });
  }
});

router.get('/estadisticas-peliculas', async (req, res) => {
  try {
    // Obtener todos los usuarios
    const allUsers = await usuarios.find();

    // Calcular estadísticas de películas
    let totalPeliculas = 0;
    let topPeliculas = [];

    allUsers.forEach(usuario => {
      const numPeliculas = usuario.peliculas ? usuario.peliculas.length : 0;
      
      // Sumar al total
      totalPeliculas += numPeliculas;
      
      // Agregar al array para top usuarios
      if (numPeliculas > 0) {
        topPeliculas.push({ 
          nombre: usuario.name, 
          cantidad: numPeliculas,
          userId: usuario._id // Opcional: incluir ID del usuario
        });
      }
    });

    // Obtener top 3 usuarios con más películas
    const top3Peliculas = topPeliculas
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 3);

    // Devolver estadísticas de películas
    res.status(200).json({
      totalPeliculas: totalPeliculas,
      topUsuarios: top3Peliculas,
      totalUsuariosConPeliculas: topPeliculas.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas de películas',
    });
  }
});

router.get('/estadisticas-series', async (req, res) => {
  try {
    // Obtener todos los usuarios
    const allUsers = await usuarios.find();

    // Calcular estadísticas de series
    let totalSeries = 0;
    let topSeries = [];

    allUsers.forEach(usuario => {
      const numSeries = usuario.series ? usuario.series.length : 0;
      
      // Sumar al total
      totalSeries += numSeries;
      
      // Agregar al array para top usuarios
      if (numSeries > 0) {
        topSeries.push({ 
          nombre: usuario.name, 
          cantidad: numSeries,
          userId: usuario._id // Opcional: incluir ID del usuario
        });
      }
    });

    // Obtener top 3 usuarios con más series
    const top3Series = topSeries
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 3);

    // Devolver estadísticas de series
    res.status(200).json({
      totalSeries: totalSeries,
      topUsuarios: top3Series,
      totalUsuariosConSeries: topSeries.length
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas de series',
    });
  }
});

//----------------------------------------------------------------

// stadisticas personales del usuario
router.get('/estadisticas-user', async (req, res) => {
  try {
    // Obtener el usuario actual autenticado
    const usuario = await usuarios.findById(req.user.id);

    // Calcular estadísticas para el usuario
    const numLibros = usuario.libros.length;
    const numSeries = usuario.series.length;
    const numPeliculas = usuario.peliculas.length;
    const numPendientes = usuario.pendientes.length;

    // Devolver las estadísticas particulares del usuario
    res.status(200).json({
      libros: numLibros,
      series: numSeries,
      peliculas: numPeliculas,
      pendientes: numPendientes 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: true,
      mensaje: 'Error al obtener las estadísticas del usuario',
    });
  }
});

router.post('/movimiento', async (req, res) => {
  
  try {
    const { fecha, titulo, autor, genero, descripcion, pendienteId } = req.body;

    // Validar que todos los campos necesarios están presentes
    if (!fecha || !titulo ) {
        return res.status(400).json({ message: "Faltan datos del libro." });
    }

    const usuarioDB = await usuarios.findOne({ _id: req.user.id });

    // Crear un objeto representando el libro
    const nuevoLibro = {
        fecha,
        titulo,
        autor,
        genero,
        descripcion
    };

    // Agregar el nuevo libro al array 'libros'
  
    usuarioDB.libros.push(nuevoLibro);
    console.log(usuarioDB.pendientes)
    
    // Encontrar y eliminar el libro del array 'pendientes'
     const indicePendiente = usuarioDB.pendientes.findIndex(pendiente => pendiente._id.toString() === pendienteId);

     // Verificar si el pendiente existe en el array de pendientes del usuario
     if (indicePendiente === -1) {
       return res.status(404).json({ mensaje: 'Pendiente no encontrado para este usuario' });
     }
 
     // Eliminar el pendiente del array de pendientes del usuario
     usuarioDB.pendientes.splice(indicePendiente, 1);
 
     // Guardar los cambios en la base de datos
     await usuarioDB.save();

    // Enviar una respuesta de éxito
    res.status(200).json({ message: "El libro ha sido agregado y eliminado de pendientes correctamente." });
} catch (error) {
    // Capturar cualquier error que ocurra durante el proceso y enviar una respuesta de error
    console.error("Error al procesar la solicitud:", error);
    res.status(500).json({ message: "Ha ocurrido un error al procesar la solicitud." });
}
  
});


module.exports = router;