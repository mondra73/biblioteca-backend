const router = require('express').Router(); //esto sirve para generar una ruta en un archivo aparte (auth.js)
const User = require('../models/Users');
const bcrypt = require('bcrypt');
const Joi = require('@hapi/joi');
const jwt = require('jsonwebtoken');
const usuarios = require('../models/Users');
const validaToken = require('./validate-token');
const enviarEmail = require('./mails');

const schemaRegister = Joi.object({
    name: Joi.string().min(4).max(255).required(),
    email: Joi.string().min(6).max(255).required().email(),
    password1: Joi.string().min(6).max(1024).required(),
    password2: Joi.string().valid(Joi.ref('password1')).required().label('Confirmación de contraseña').messages({ 'any.only': '{{#label}} debe coincidir con la contraseña' })
})

const schemaLogin = Joi.object({
    email: Joi.string().min(6).max(255).required().email(),
    password: Joi.string().min(6).max(1024).required()
})

router.post('/login', async (req, res) => {
    // validaciones
    const { error } = schemaLogin.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message })

    // Convertir el texto del usuario a minúsculas
    const usuarioInput = req.body.email.toLowerCase();
    
    const user = await User.findOne({ email: usuarioInput });
    if (!user) return res.status(400).json({ error: true, mensaje: 'Credenciales invalidas'});

    // Verificar si la cuenta está activada
    if (!user.verificado) {
        return res.status(400).json({ error: true, mensaje: 'La cuenta no está activada' });
    }

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ error: true, mensaje: 'Credenciales invalidas' })

    // Nota: En los mensajes del mail y contraseñas incorrectos, poner credenciales invalidas. Es para no darle pistas al usuario en que se esta equivocando

    // Creacion del token
    const token = jwt.sign({
        name: user.name,
        id: user._id
    }, process.env.TOKEN_SECRET)
    
    res.header('auth-token', token).json({
        error: null,
        data: {token},
        name: user.name
    })
    
})

router.post('/register', async (req, res) => {
    console.log('a ver el req.body: ', req.body);
    // Validaciones de Usuarios
    const { error } = schemaRegister.validate(req.body);

    if (error) {
        return res.status(400).json({ error: error.details[0].message });
    }

    const existeElEmail = await User.findOne({ email: req.body.email });
    if (existeElEmail) return res.status(400).json({ error: true, mensaje: 'Email ya registrado' });

    try {
        // Encriptar la contraseña
        const saltos = await bcrypt.genSalt(10);
        const password = await bcrypt.hash(req.body.password1, saltos);

        // Crear un nuevo usuario con el correo electrónico y la contraseña
        const user = new User({
            name: req.body.name,
            email: req.body.email, 
            password: password
        });

        const userDB = await user.save();

        // Creacion del token
        const token = jwt.sign({
            name: user.name,
            id: user._id
        }, process.env.TOKEN_SECRET, { expiresIn: '30m' });

        // Actualizar el usuario con el token generado
        userDB.token = token;
        await userDB.save();

        res.json({ error: null, data: userDB });

        // Una vez registrado, se envia el  mail con el token con 30 minutos de lifeTime

        const url = process.env.URLUSER
        const destinatario = req.body.email;
        const asunto = ('Validar cuenta.');
        const texto = ('Hola ' + req.body.name + '. Haz click en el siguiente enlace para activar tu cuenta: ' + url + '/confirmar/');
        const cuerpo = texto + destinatario + '/' + token;
    
        enviarEmail(destinatario, asunto, cuerpo);

    } catch (error) {
        // Manejo personalizado de errores de base de datos
        let mensajeError;
        if (error.code === 11000) {
            mensajeError = 'El email ya está registrado';
        } else {
            mensajeError = 'Hubo un error al registrar el usuario';
        }
        res.status(400).json({ error: mensajeError });
    }
});

router.post('/confirmar/', async (req, res) => {
    try {
        const { mail, token } = req.body;
        console.log(mail, token)
        // Buscar usuario por email
        const usuario = await User.findOne({ email: mail });
        if (!usuario) {
            return res.status(404).json({ error: true, mensaje: 'Email no registrado' });
        }

        // Verificar si el token enviado coincide con el token almacenado
        if (token !== usuario.token) {
            return res.status(401).json({ error: true, mensaje: 'Token no válido' });
        }

        // Modificar el estado del campo verificado a true
        usuario.verificado = true;
        await usuario.save();

        res.json({ error: null, mensaje: 'Usuario verificado correctamente' });
    } catch (error) {
        console.error('Error al verificar usuario:', error);
        res.status(500).json({ error: true, mensaje: 'Error al verificar usuario' });
    }
});

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

router.post('/olvido-password', async (req, res) => {
    const { email } = req.body;
    console.log(email)
    try {
        // Busca al usuario por su correo electrónico en la base de datos
        const user = await User.findOne({ email });
        if (!user) {
          return res.status(404).json({ error: 'Usuario no encontrado' });
        }
    
        const token = user.token;
    
        // Envia el correo electrónico con el token
        const transporter = nodemailer.createTransport({
          // Configura el transporte de correo (SMTP, Gmail, etc.)
        });
    
        const url = process.env.URLUSER
        const destinatario = user;
        const asunto = ('Restablecer contraseña.');
        const texto = ('Hola ' + req.body.name + '. Haz click en el siguiente enlace restablecer su contraseña; (En el caso de que la haya olvidado, de lo contrario desestime este correo): ' + url + '/confirmar/');
        const cuerpo = texto + destinatario + '/' + token;
    
        enviarEmail(destinatario, asunto, cuerpo);

      } catch (error) {
        console.error('Error al procesar la solicitud de restablecimiento:', error);
        res.status(500).send('Error al procesar la solicitud de restablecimiento');
      }

})


module.exports = router;