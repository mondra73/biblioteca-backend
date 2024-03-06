const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
const jwt = require('jsonwebtoken')

const usuarios = require('../models/Users');
const Pelicula = require('../models/peliculas');

router.get('/peliculas',[validaToken], async (req, res) => {
    // console.log(req.user)
    try {
        const usuarioID = await usuarios.findOne({_id: req.user.id});
        // console.log(usuarioID)
        res.json('200', {
            usuario: usuarioID.peliculas,
        })
    } catch (error) {
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

module.exports = router