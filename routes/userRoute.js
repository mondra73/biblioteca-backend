const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');

const usuarios = require('../models/Users');
const Libro = require('../models/libros')

router.get('/:id',[validaToken], async (req, res) => {
    
    try {
        const usuarioDB = await usuarios.findOne();
        res.json('200', {
            usuario: usuarioDB,
        })
    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
})

router.post('/:id/carga-libros',[validaToken], async (req, res) => {
    
    try {
        const usuarioDB = await usuarios.findOne();
        const libro = new Libro(req.body);
        usuarioDB.libros.push(libro);
        await usuarioDB.save();
        console.log(usuarioDB._id)
        res.json('200', {
            mensaje: 'bien cargado bebe'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
})

module.exports = router