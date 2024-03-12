const router = require('express').Router(); //esto sirve para generar una ruta en un archivo aparte (auth.js)
const User = require('../models/Users');
const bcrypt = require('bcrypt');
const Joi = require('@hapi/joi');
const jwt = require('jsonwebtoken');
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
    
    const user = await User.findOne({ email: req.body.email });
    if (!user) return res.status(400).json({ error: true, mensaje: 'Credenciales invalidas'});

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
        res.json({ error: null, data: userDB });
        // Una vez registrado, se envia el  mail con el token con 30 minutos de lifeTime

         // Creacion del token
            const token = jwt.sign({
                name: user.name,
                id: user._id
            }, process.env.TOKEN_SECRET)

        user.token = token;

        const url = process.env.URLUSER
        const destinatario = req.body.email;
        const asunto = ('Validar cuenta.');
        const texto = ('Haz click en el siguiente enlace para activar tu cuenta: ', url);
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

router.get('/:mail/:token'), async (req, res) => {
    console.log('Ver el req.body: ', req.body);

    console.log('parametros del req ', req.params)

    const existeElEmail = await User.findOne({ email: req.params.mail });
    if (existeElEmail) return res.status(400).json({ error: true, mensaje: 'Email no registrado' });

}

module.exports = router;