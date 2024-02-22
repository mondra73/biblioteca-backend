const mongoose = require('mongoose');
const librosSchema = require('../models/libros')

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        min: 6,
        max: 255
    },
    email: {
        type: String,
        required: true,
        min: 6,
        max: 1024
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    libros: [librosSchema.schema],
    peliculas: [{
        fecha: Date,
        titulo: String,
        director: String,
        descripcion: String
    }],
    series: [{
        fecha: Date,
        titulo: String,
        director: String,
        descripcion: String
    }],
    date: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('User', userSchema);