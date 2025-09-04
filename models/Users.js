const mongoose = require('mongoose');
const librosSchema = require('../models/libros');
const peliculasSchema = require('../models/peliculas');
const seriesSchema = require('../models/series');
const pendientesSchema = require('../models/pendientes');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        min: 4,
        max: 255
    },
    email: {
        type: String,
        required: true,
        min: 4,
        max: 255
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    libros: [librosSchema.schema],
    peliculas: [peliculasSchema.schema],
    series: [seriesSchema.schema],
    pendientes: [pendientesSchema.schema],
    date: {
        type: Date,
        default: Date.now
    },
    verificado: {
        type: Boolean,
        default: false,
    },
    token: String,
    tokenCreatedAt: Date 
})

module.exports = mongoose.model('User', userSchema);