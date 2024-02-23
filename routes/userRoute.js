const router = require('express').Router();
const { required } = require('@hapi/joi');
const validaToken = require('./validate-token');
// const jwt = require('jsonwebtoken')

const usuarios = require('../models/Users');
const Libro = require('../models/libros');
const Serie = require('../models/series');
const Pelicula = require('../models/peliculas');

router.get('/',[validaToken], async (req, res) => {
    // console.log(req.user)
    try {
        const usuarioID = await usuarios.findOne({_id: req.user.id});
        // console.log(usuarioID)
        res.json('200', {
            usuario: usuarioID,
        })
    } catch (error) {
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.post('/carga-libros',[validaToken], async (req, res) => {
    try {
        const usuarioDB = await usuarios.findOne({_id: req.user.id});
        const libro = new Libro(req.body);
        usuarioDB.libros.push(libro);
        await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Libro cargado correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.post('/carga-series',[validaToken], async (req, res) => {
    try {
        const usuarioDB = await usuarios.findOne({_id: req.user.id});
        const serie = new Serie(req.body);
        usuarioDB.series.push(serie);
        await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Serie cargada correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.post('/carga-peliculas',[validaToken], async (req, res) => {
    try {
        const usuarioDB = await usuarios.findOne({_id: req.user.id});
        const pelicula = new Pelicula(req.body);
        usuarioDB.peliculas.push(pelicula);
        await usuarioDB.save();
        
        res.json('200', {
            mensaje: 'Pelicula cargada correctamente'
        })

    } catch (error) {
        console.log(error)
        res.json('400', {
            error: true,
            mensaje: error
        })
    }
});

router.delete('/:id',[validaToken], async (req, res) => {
    const id = req.params.id;
    console.log('Id del libro/serie/pelicula a eliminar: ', req.body.id)
    console.log('id del usuario: ', id)
    try {
        const elemento = await usuarios.findByIdAndDelete({ _id: req.body.id})
        if (elemento){
            res.json({
                estado: true,
                mensaje: 'eliminado!'
            })
        }else {
            res.json({
                estado: true,
                mensaje: 'No se pudo eliminar!' 
            })
        }
    } catch (error) {
        console.log(error)
    }
});

module.exports = router