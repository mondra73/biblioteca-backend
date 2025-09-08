const router = require("express").Router();
const User = require("../models/Users");
const bcrypt = require("bcrypt");
const Joi = require("@hapi/joi");
const jwt = require("jsonwebtoken");
const usuarios = require("../models/Users");
const validaToken = require("./validate-token");
const enviarEmail = require("./mails");
const getEmailTemplate  = require("../email-template/registro-exitoso");
const generarEmailRecuperacion = require('../email-template/recuperar-password');
const contactoAdminTemplate = require('../email-template/contacto-admin');
const contactoUsuarioTemplate = require('../email-template/contacto-usuario')
const rateLimit = require("express-rate-limit");
const admin = require('firebase-admin');
const passport = require('../passport');
const { OAuth2Client } = require('google-auth-library');

// ✅ CONFIGURACIÓN DEFINITIVA
try {
  if (process.env.FIREBASE_CONFIG_BASE64) {
    // Para Render (Base64)
    const firebaseConfigJson = Buffer.from(process.env.FIREBASE_CONFIG_BASE64, 'base64').toString('utf-8');
    const firebaseConfig = JSON.parse(firebaseConfigJson);
    admin.initializeApp({ credential: admin.credential.cert(firebaseConfig) });
    console.log('✅ Firebase Admin inicializado desde Base64');
  } else {
    // Para desarrollo local (archivo JSON)
    const serviceAccount = require('../config/firebase-service-key.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    console.log('✅ Firebase Admin inicializado desde archivo JSON');
  }
} catch (error) {
  console.warn('⚠️ Error inicializando Firebase:', error.message);
  console.log('⚠️ El login con Google no funcionará hasta resolver esto');
}

const customMessages = {
  "string.base": "{{#label}} debe ser una cadena",
  "string.min": "{{#label}} debe tener al menos {#limit} caracteres",
  "string.max": "{{#label}} debe tener como máximo {#limit} caracteres",
  "string.email": "El formato de {{#label}} no es válido",
  "string.empty": "El nombre no puede estar vacío",
  "any.required": "{{#label}} es un campo requerido",
  "any.only": "{{#label}} debe coincidir con {{#other}}",
  "string.pattern.base": "{{#label}} debe contener solo letras sin espacios",
};

const schemaRegister = Joi.object({
  name: Joi.string()
    .min(4)
    .max(255)
    .required()
    .pattern(new RegExp("^[A-Za-z]+$"))
    .messages(customMessages),
  email: Joi.string()
    .min(6)
    .max(255)
    .required()
    .email()
    .messages(customMessages),
  password1: Joi.string().min(6).max(1024).required().messages(customMessages),
  password2: Joi.string()
    .valid(Joi.ref("password1"))
    .required()
    .label("Confirmación de contraseña")
    .messages({ "any.only": "{{#label}} debe coincidir con la contraseña" }),
});

const schemaLogin = Joi.object({
  email: Joi.string()
    .min(6)
    .max(255)
    .required()
    .email()
    .messages(customMessages),
  password: Joi.string().min(6).max(1024).required().messages(customMessages),
});

//----------- Google ------------------
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Rutas de Google OAuth
router.get('/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        session: false 
    })
);

router.get('/google/callback',
    passport.authenticate('google', { 
        failureRedirect: process.env.FRONTEND_URL + '/login?error=auth_failed',
        session: false 
    }),
    async (req, res) => {
        try {
            // Generar tokens para el usuario
            const accessToken = generateAccessToken(req.user);
            const refreshToken = generateRefreshToken(req.user, false);

            // Guardar refresh token en cookie
            res.cookie("refreshToken", refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "strict",
                maxAge: 24 * 60 * 60 * 1000,
            });

            // Redirigir al frontend con el token de acceso
            res.redirect(`${process.env.FRONTEND_URL}/auth-success?token=${accessToken}&name=${encodeURIComponent(req.user.name)}`);
        } catch (error) {
            console.error('Error en callback de Google:', error);
            res.redirect(process.env.FRONTEND_URL + '/login?error=auth_failed');
        }
    }
);

// Ruta alternativa para mobile/SPA (usando token de Google)
router.post('/google/token', async (req, res) => {
    try {
        const { googleToken } = req.body;
        
        if (!googleToken) {
            return res.status(400).json({ error: "Token de Google requerido" });
        }

        // Verificar el token de Google
        const ticket = await client.verifyIdToken({
            idToken: googleToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Buscar o crear usuario
        let user = await User.findOne({ 
            $or: [
                { googleId },
                { email, authProvider: 'google' }
            ]
        });

        if (!user) {
            // Buscar si ya existe con email normal
            user = await User.findOne({ email });
            
            if (user) {
                // Actualizar usuario existente
                user.googleId = googleId;
                user.authProvider = 'google';
                user.avatar = picture;
                user.verificado = true;
                await user.save();
            } else {
                // Crear nuevo usuario
                user = new User({
                    googleId,
                    name,
                    email,
                    avatar: picture,
                    authProvider: 'google',
                    verificado: true
                });
                await user.save();
            }
        }

        // Generar tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user, false);

        // Guardar refresh token en cookie
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000,
        });

        res.json({
            error: null,
            data: { 
                token: accessToken,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    avatar: user.avatar
                }
            }
        });

    } catch (error) {
        console.error('Error en autenticación con Google:', error);
        res.status(400).json({ error: "Error en autenticación con Google" });
    }
});

router.post('/google/firebase', async (req, res) => {
  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      return res.status(400).json({ error: "Token de Firebase requerido" });
    }

    // Verificar el token de Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    // ✅ BUSCAR usuario por email o googleId
    let user = await User.findOne({ 
      $or: [
        { googleId: uid },
        { email: email.toLowerCase() }
      ]
    });

    // ✅ SI NO EXISTE el usuario - REGISTRARLO AUTOMÁTICAMENTE
    if (!user) {
      try {
        // Crear nuevo usuario automáticamente
        user = new User({
          googleId: uid,
          name: name,
          email: email.toLowerCase(),
          avatar: picture,
          authProvider: 'google',
          verificado: true
        });
        
        await user.save();
        
        // ✅ ENVIAR CORREO DE BIENVENIDA (ASÍNCRONO)
        setTimeout(async () => {
          try {
            const asunto = "¡Bienvenido a Biblioteca Multimedia!";
            const cuerpoHTML = getEmailTemplate(name);
            
            const resultado = await enviarEmail(email, asunto, cuerpoHTML, true);
            if (resultado.success) {
              console.log(`✅ Correo de bienvenida enviado a: ${email}`);
            } else {
              console.warn(`⚠️ Error al enviar correo a: ${email}`, resultado.message);
            }
          } catch (emailError) {
            console.error(`❌ Error en envío de correo:`, emailError);
          }
        }, 0);
        
      } catch (registerError) {
        console.error('Error al registrar usuario automáticamente:', registerError);
        return res.status(500).json({ error: "Error al crear usuario automáticamente" });
      }
    } else {
      // ✅ SI EXISTE pero no tiene googleId - Actualizar
      if (!user.googleId) {
        user.googleId = uid;
        user.authProvider = 'google';
        user.avatar = picture;
        user.verificado = true;
        await user.save();
      }
    }

    // Generar tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user, false);

    // Guardar refresh token en cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({
      error: null,
      data: { 
        token: accessToken,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar
        }
      }
    });

  } catch (error) {
    console.error('Error en autenticación con Firebase:', error);
    res.status(401).json({ error: "Token de Firebase inválido o expirado" });
  }
});

//-------------------------------

router.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(400).json({ error: "Usuario no registrado" });

  // Verificar si es usuario de Google
  if (user.authProvider === 'google') {
    return res.status(400).json({ 
      error: "Este usuario se registró con Google. Por favor, usa el botón de Google para iniciar sesión." 
    });
  }

  // Verificar si el usuario tiene contraseña (por si acaso)
  if (!user.password) {
    return res.status(400).json({ 
      error: "Este usuario no tiene contraseña configurada. Usa el login con Google." 
    });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword)
    return res.status(400).json({ error: "Credenciales inválidas" });

  // generar tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, rememberMe);

  // guardar refresh token en cookie httpOnly
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, 
  });

  res.json({
    error: null,
    data: { token: accessToken },
    name: user.name,
  });
});

router.post("/refresh-token", (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: "No hay refresh token" });

  jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Refresh token inválido o expirado" });

    const newAccessToken = generateAccessToken({ _id: user.id, name: user.name });
    res.json({ token: newAccessToken });
  });
});

router.post("/register", async (req, res) => {
  const { name, email, password1, password2, googleId, authProvider, avatar } = req.body;

  // ✅ Validación especial para usuarios Google
  if (authProvider === 'google') {
    if (!name || !email) {
      return res.status(400).json({ error: "Nombre y email son requeridos" });
    }
  } else {
    const { error } = schemaRegister.validate({ name, email, password1, password2 });
    if (error) return res.status(400).json({ error: error.details[0].message });
  }

  const existeElEmail = await User.findOne({ email: email });
  if (existeElEmail) {
    return res.status(400).json({ error: "Email ya registrado" });
  }

  try {
    const userData = {
      name: name,
      email: email,
      authProvider: authProvider || 'local',
      verificado: authProvider === 'google' ? true : false
    };

    if (googleId) userData.googleId = googleId;
    if (avatar) userData.avatar = avatar;
    
    if (authProvider !== 'google') {
      const saltos = await bcrypt.genSalt(10);
      userData.password = await bcrypt.hash(password1, saltos);
    }

    const user = new User(userData);
    const userDB = await user.save();

    // ✅ ENVÍO ASÍNCRONO - No esperar respuesta del email
    setTimeout(async () => {
      try {
        const asunto = "¡Bienvenido a Biblioteca Multimedia!";
        const cuerpoHTML = getEmailTemplate(name);
        
        const resultado = await enviarEmail(email, asunto, cuerpoHTML, true);
        if (resultado.success) {
          console.log(`✅ Correo enviado a: ${email}`);
        } else {
          console.warn(`⚠️ Error al enviar correo a: ${email}`, resultado.message);
        }
      } catch (emailError) {
        console.error(`❌ Error crítico en envío de correo:`, emailError);
      }
    }, 0); // Ejecutar en el próximo tick del event loop

    res.json({ 
      error: null, 
      data: {
        message: "Usuario registrado exitosamente.",
        user: {
          id: userDB._id,
          name: userDB.name,
          email: userDB.email
        }
      }
    });

  } catch (error) {
    console.error("Error en registro:", error);
    res.status(400).json({ error: "Hubo un error al registrar el usuario" });
  }
});

router.post("/confirmar/", async (req, res) => {
  try {
    const { mail, token } = req.body;

    const usuario = await User.findOne({ email: mail });
    if (!usuario) {
      return res
        .status(404)
        .json({ error: true, mensaje: "Email no registrado" });
    }

    if (token !== usuario.token) {
      return res.status(401).json({ error: true, mensaje: "Token no válido" });
    }

    usuario.verificado = true;
    await usuario.save();

    res.json({ error: null, mensaje: "Usuario verificado correctamente" });
  } catch (error) {
    console.error("Error al verificar usuario:", error);
    res
      .status(500)
      .json({ error: true, mensaje: "Error al verificar usuario" });
  }
});

//ingresando (conociendo) la contraseña actual para luego poner la nueva
router.post("/cambiar-password", [validaToken], async (req, res) => {
  // Obtener datos del cuerpo de la solicitud
  const { contrasenaActual, nuevaContrasena, nuevaContrasena2 } = req.body;

  // Lógica para cambiar la contraseña
  try {
    // Buscar el usuario en la base de datos
    const usuarioDB = await usuarios.findOne({ _id: req.user.id });

    // Verificar si la oficina existe
    if (!usuarioDB) {
      return res.status(404).json({ error: "Usuario no encontrada" });
    }

    // Verificar la contraseña actual
    const contrasenaValida = await bcrypt.compare(
      contrasenaActual,
      usuarioDB.password
    );
    if (!contrasenaValida) {
      return res.status(401).json({ error: "Contraseña actual incorrecta" });
    }

    // Verificar que las nuevas contraseñas sean iguales
    if (nuevaContrasena !== nuevaContrasena2) {
      return res.status(401).json({ error: "Contraseñas nuevas diferentes" });
    }

    // Generar el hash de la nueva contraseña
    const saltos = await bcrypt.genSalt(10);
    const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, saltos);

    // Actualizar la contraseña en la base de datos
    usuarioDB.password = nuevaContrasenaHash;
    await usuarioDB.save();

    res.json({
      mensaje: "Contraseña cambiada exitosamente",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

//para el que se la olvido y se envio el link por mail
router.post("/restablecer-password", async (req, res) => {
  const { mail, nuevaContrasena, nuevaContrasena2 } = req.body;

  try {
    const usuarioDB = await usuarios.findOne({ email: mail });

    if (!usuarioDB) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (nuevaContrasena !== nuevaContrasena2) {
      return res.status(401).json({ error: "Contraseñas nuevas diferentes" });
    }

    const saltos = await bcrypt.genSalt(10);
    const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, saltos);

    usuarioDB.password = nuevaContrasenaHash;
    await usuarioDB.save();

    const nombreUsuario = usuarioDB.name;

    res.json({
      mensaje: "Contraseña restablecida exitosamente",
      nombre: nombreUsuario,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// Configuración del rate limiting para olvido de contraseña
const passwordResetLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 1, // máximo 1 solicitud por ventana de tiempo
  message: {
    error: "Debes esperar 5 minutos antes de solicitar otro restablecimiento"
  },
  handler: (req, res) => {
    res.status(429).json({
      error: "Demasiadas solicitudes. Intenta nuevamente en 5 minutos"
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// inicia el proceso de recuperacion de contraseña olvidada
router.post("/olvido-password", passwordResetLimiter, async (req, res) => {
  const { email } = req.body;

  try {
    // Busca al usuario por su correo electrónico en la base de datos
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    // Por seguridad, siempre devolvemos el mismo mensaje aunque el email no exista
    if (!user) {
      return res.status(200).json({ 
        message: "Si el email existe, se ha enviado un enlace de restablecimiento" 
      });
    }

    // Verificar si ya hay un token reciente (menos de 5 minutos)
    if (user.tokenCreatedAt && Date.now() - user.tokenCreatedAt.getTime() < 5 * 60 * 1000) {
      return res.status(200).json({ 
        message: "Si el email existe, se ha enviado un enlace de restablecimiento" 
      });
    }

    // Generar un token para restablecer la contraseña
    const token = generateResetToken(user);

    // Guardar el token y timestamp en la base de datos
    user.token = token;
    user.tokenCreatedAt = new Date();
    await user.save();

    const url = process.env.URLUSER;
    const destinatario = user.email;
    const asunto = "Restablecer contraseña - Biblioteca Multimedia";
    const urlRecuperacion = `${url}/nuevo-password/${encodeURIComponent(destinatario)}/${token}`;
    
    // Generar el contenido HTML
    const htmlContent = generarEmailRecuperacion(user.name, urlRecuperacion);

    // Enviar email con HTML
    enviarEmail(destinatario, asunto, htmlContent, true);

    res.status(200).json({ 
      message: "Si el email existe, se ha enviado un enlace de restablecimiento" 
    });
  } catch (error) {
    console.error("Error al procesar la solicitud de restablecimiento:", error);
    res.status(500).json({ 
      error: "Error al procesar la solicitud de restablecimiento" 
    });
  }
});

const generateResetToken = (user) => {
  return jwt.sign(
    { 
      id: user._id, 
      purpose: 'password_reset',
      timestamp: Date.now() // Agregamos timestamp para mayor seguridad
    },
    process.env.TOKEN_SECRET,
    { expiresIn: "1h" } // Token de 1 hora para reset de password
  );
};

// función para generar tokens
const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, name: user.name },
    process.env.TOKEN_SECRET,
    { expiresIn: "15m" } // corto
  );
};

const generateRefreshToken = (user, rememberMe) => {
  return jwt.sign(
    { id: user._id },
    process.env.REFRESH_SECRET,
    { expiresIn: rememberMe ? "30d" : "1d" } // largo si marcó "recordarme"
  );
};

router.get("/ping", (req, res) => {
  res.status(200).json({ mensaje: "ok" });
});

// Rate limiting para contacto (5 minutos entre envíos)
const contactoLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 1, // máximo 1 solicitud por ventana de tiempo
  message: {
    success: false,
    message: "Debes esperar 5 minutos antes de enviar otro mensaje de contacto"
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Usamos la función helper para IP + email
    const ipKey = rateLimit.ipKeyGenerator(req);
    return ipKey + (req.body.email || '');
  }
});

//  endpoint de contacto
router.post('/contacto', contactoLimiter, async (req, res) => {
  try {
    const { nombre, email, telefono, asunto, mensaje } = req.body;

    // Validaciones básicas
    if (!nombre || !email || !asunto || !mensaje) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios deben ser completados'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Por favor ingresa un email válido'
      });
    }

    // Fecha y hora actual
    const fechaEnvio = new Date().toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Datos para las plantillas
    const datosContacto = {
      nombre,
      email,
      telefono: telefono || 'No proporcionado',
      asunto,
      mensaje,
      fechaEnvio
    };

    // 1. Email para el administrador usando tu plantilla contacto-usuario
    const emailAdminHtml = contactoAdminTemplate(datosContacto);

    // Enviar email al administrador
    const resultadoAdmin = await enviarEmail(
      "biblotecamultimedia@gmail.com", // Email del admin
      `Nuevo mensaje de contacto: ${asunto}`,
      emailAdminHtml,
      true // Es HTML
    );

    if (!resultadoAdmin.success) {
      return res.status(500).json({
        success: false,
        message: 'Error al enviar el mensaje. Por favor, intenta nuevamente.'
      });
    }

    // 2. Email de confirmación para el usuario usando la nueva plantilla
    const emailUsuarioHtml = contactoUsuarioTemplate(datosContacto);

    // Enviar confirmación al usuario
    const resultadoUsuario = await enviarEmail(
      email,
      'Confirmación de recepción de mensaje - Entertainment Hub',
      emailUsuarioHtml,
      true
    );

    if (!resultadoUsuario.success) {
      console.warn('No se pudo enviar email de confirmación al usuario, pero el mensaje fue recibido');
      // No retornamos error aquí porque el mensaje principal sí se envió al admin
    }

    res.status(200).json({
      success: true,
      message: 'Mensaje enviado correctamente'
    });

  } catch (error) {
    console.error('Error enviando mensaje de contacto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al enviar el mensaje. Por favor, intenta nuevamente.'
    });
  }
});

module.exports = router;
