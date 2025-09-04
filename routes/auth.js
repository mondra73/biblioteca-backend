const router = require("express").Router();
const User = require("../models/Users");
const bcrypt = require("bcrypt");
const Joi = require("@hapi/joi");
const jwt = require("jsonwebtoken");
const usuarios = require("../models/Users");
const validaToken = require("./validate-token");
const enviarEmail = require("./mails");

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
  if (existeElEmail)
    return res.status(400).json({ error: "Email ya registrado" });

  try {
    // Encriptar la contraseña
    const saltos = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(req.body.password1, saltos);

    // Crear un nuevo usuario con el correo electrónico y la contraseña
    const user = new User({
      name: req.body.name,
      email: req.body.email,
      password: password,
    });

    const userDB = await user.save();

    // Creacion del token
    const token = jwt.sign(
      {
        name: user.name,
        id: user._id,
      },
      process.env.TOKEN_SECRET,
      { expiresIn: "30m" }
    );

    // Actualizar el usuario con el token generado
    userDB.token = token;
    await userDB.save();

    res.json({ error: null, data: userDB });

    // Una vez registrado, se envia el  mail con el token con 30 minutos de lifeTime

    const url = process.env.URLUSER;
    const destinatario = req.body.email;
    const asunto = "Validar cuenta.";
    const texto =
      "Hola " +
      req.body.name +
      ". Haz click en el siguiente enlace para activar tu cuenta: " +
      url +
      "/confirmar/";
    const cuerpo = texto + destinatario + "/" + token;

    enviarEmail(destinatario, asunto, cuerpo);

    const miEmail = "mondra73@gmail.com";
    const asuntoMio = "¡Usuario Nuevo!";
    const textoMio =
      "Felicitaciones bebé, tenés un nuevo usuario en la página. Se llama: " +
      req.body.name +
      ". Y su correo es: " +
      destinatario;

    enviarEmail(miEmail, asuntoMio, textoMio);
  } catch (error) {
    // Manejo personalizado de errores de base de datos
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

router.post("/restablecer-password", async (req, res) => {
  // Obtener datos del cuerpo de la solicitud
  const { mail, token, nuevaContrasena, nuevaContrasena2 } = req.body;

  // Lógica para cambiar la contraseña
  try {
    // Buscar el usuario en la base de datos
    const usuarioDB = await usuarios.findOne({ email: mail });

    // Verificar si el usuario existe
    if (!usuarioDB) {
      return res.status(404).json({ error: "Usuario no encontrado" });
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

    // Nombre de usuario obtenido de la base de datos
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

router.post("/olvido-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Busca al usuario por su correo electrónico en la base de datos
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Generar un token para restablecer la contraseña
    const token = generarToken();

    // Guardar el token en la base de datos
    user.token = token;
    await user.save();

    const url = process.env.URLUSER;
    const destinatario = user.email; // Usar el email del usuario
    const asunto = "Restablecer contraseña";
    const texto = `Hola ${user.name}. Haz clic en el siguiente enlace para restablecer tu contraseña: ${url}/restablecer/${destinatario}/${token}`;
    const cuerpo = texto;

    enviarEmail(destinatario, asunto, cuerpo);

    res
      .status(200)
      .json({ message: "Correo de restablecimiento enviado correctamente" });
  } catch (error) {
    console.error("Error al procesar la solicitud de restablecimiento:", error);
    res
      .status(500)
      .json({ error: "Error al procesar la solicitud de restablecimiento" });
  }
});

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

//  endpoint de contacto

module.exports = router;
