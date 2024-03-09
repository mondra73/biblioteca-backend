const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
const usuarios = require('../models/Users');
const bcrypt = require('bcrypt');


router.post('/cambiar-password', [validaToken], async (req, res) => {
    // Obtener datos del cuerpo de la solicitud
    const { contrasenaActual, nuevaContrasena, nuevaContrasena2 } = req.body;
  
    // Lógica para cambiar la contraseña
    try {
      // Buscar el usuario en la base de datos
      const usuarioDB = await usuarios.findOne({_id: req.user.id});
  
      // Verificar si la oficina existe
      if (!usuarioDB) {
        return res.status(404).json({ error: 'Usuario no encontrada' });
      }
      
      // Verificar la contraseña actual
      const contrasenaValida = await bcrypt.compare(contrasenaActual, usuarioDB.password);
      if (!contrasenaValida) {
        return res.status(401).json({ error: 'Contraseña actual incorrecta' });
      }

      // Verificar que las nuevas contraseñas sean iguales
      if (nuevaContrasena !== nuevaContrasena2) {
        return res.status(401).json({ error: 'Contraseñas nuevas diferentes' });
      }
  
      // Generar el hash de la nueva contraseña
      const saltos = await bcrypt.genSalt(10);
      const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, saltos);
  
      // Actualizar la contraseña en la base de datos
      usuarioDB.password = nuevaContrasenaHash;
      await usuarioDB.save();
  
      res.json({
        mensaje: 'Contraseña cambiada exitosamente',
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
});


module.exports = router