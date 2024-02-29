const router = require('express').Router(); //esto sirve para generar una ruta en un archivo aparte (auth.js)
const User = require('../models/Users');
const bcrypt = require('bcrypt');
const Joi = require('@hapi/joi');
const jwt = require('jsonwebtoken');

const schemaRegister = Joi.object({
    name: Joi.string().min(6).max(255).required(),
    email: Joi.string().min(6).max(255).required().email(),
    password: Joi.string().min(6).max(1024).required()
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
    if (!user) return res.status(400).json({ error: true, mensaje: 'Email no registrado'});

    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) return res.status(400).json({ error: true, mensaje: 'Contraseña incorrecta' })

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
    
    // res.json({
    //     error: null,
    //     mensaje: 'Bienvenido',
    //     token
    // })
})

router.post('/register', async (req, res) => { //con post envio una peticion http al servidor (crear)

    // Validaciones de Usuarios
    const { error } = schemaRegister.validate(req.body)
    
    if (error) {
        return res.status(400).json(
            {error: error.details[0].message}
        )
    }

    const existeElEmail = await User.findOne({email: req.body.email}) 
    if(existeElEmail) return res.status(400).json(
        {error: true, mensaje: 'Email ya registrado'}
    )

    const saltos = await bcrypt.genSalt(10);
    const password = await bcrypt.hash(req.body.password, saltos)

    const user = new User({
        name: req.body.name,
        email: req.body.email,
        password: password
    });
    try {
        const userDB = await user.save();
        res.json({
            error: null,
            data: userDB
        })
    } catch (error) {
        res.status(400).json({error})
    }
})

module.exports = router;