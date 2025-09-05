const router = require("express").Router();
const User = require("../models/Users");
const bcrypt = require("bcrypt");
const Joi = require("@hapi/joi");
const jwt = require("jsonwebtoken");
const usuarios = require("../models/Users");
const validaToken = require("./validate-token");
const enviarEmail = require("./mails");
const generarEmailBienvenida = require('../email-template/bienvenido');
const generarEmailRecuperacion = require('../email-template/recuperar-password');
const contactoAdminTemplate = require('../email-template/contacto-admin');
const contactoUsuarioTemplate = require('../email-template/contacto-usuario')
const rateLimit = require("express-rate-limit");

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

router.post("/login", async (req, res) => {
  const { email, password, rememberMe } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return res.status(400).json({ error: "Usuario no registrado" });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword)
    return res.status(400).json({ error: "Credenciales inválidas" });

  // generar tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, rememberMe);

  // guardar refresh token en cookie httpOnly
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // true en prod con HTTPS
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
  // Validaciones de Usuarios
  const { error } = schemaRegister.validate(req.body);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  const existeElEmail = await User.findOne({ email: req.body.email });
  if (existeElEmail) {
    return res.status(400).json({ error: "Email ya registrado" });
  }

  try {
    // Encriptar la contraseña
    const saltos = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(req.body.password1, saltos);

    // Crear un nuevo usuario
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: password,
    });

    const userDB = await user.save();

    // Creacion del token (solo para verificación de email)
    const token = jwt.sign(
      {
        name: user.name,
        id: user._id,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: "30m" }
    );

    // Actualizar el usuario con el token generado (solo para verificación)
    userDB.token = token;
    await userDB.save();

    // Preparar datos para el email
    const url = process.env.URLUSER;
    const destinatario = req.body.email;
    const asunto = "Validar cuenta.";
    const urlConfirmacion = `${url}/confirmar/${destinatario}/${token}`;
    const htmlContent = generarEmailBienvenida(req.body.name, urlConfirmacion);

    const miEmail = "mondra73@gmail.com";
    const asuntoMio = "¡Usuario Nuevo!";
    const textoMio = `Felicitaciones bebé, tenés un nuevo usuario en la página. Se llama: ${req.body.name}. Y su correo es: ${destinatario}`;

    // Enviar respuesta SIN el token - solo información básica
    res.json({ 
      error: null, 
      data: {
        message: "Usuario registrado exitosamente. Revisa tu email para confirmar tu cuenta.",
        user: {
          id: userDB._id,
          name: userDB.name,
          email: userDB.email
          // NO incluir el token aquí
        }
      }
    });

    // Luego enviar los emails (después de la respuesta)
    try {
      await enviarEmail(destinatario, asunto, htmlContent, true);
      await enviarEmail(miEmail, asuntoMio, textoMio);
      console.log("Emails enviados exitosamente");
    } catch (emailError) {
      console.error("Error al enviar emails:", emailError);
    }

  } catch (error) {
    console.error("Error en registro:", error);
    
    if (res.headersSent) {
      console.log("Headers ya enviados, no se puede enviar error response");
      return;
    }
    
    let mensajeError;
    if (error.code === 11000) {
      mensajeError = "El email ya está registrado";
    } else {
      mensajeError = "Hubo un error al registrar el usuario";
    }
    res.status(400).json({ error: mensajeError });
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
    // Usamos IP + email para que sea por persona, no solo por IP
    return req.ip + (req.body.email || '');
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
