const mongoose = require('mongoose');

const libroSchema = mongoose.Schema({
        fecha: Date,
        titulo: String,
        autor: String,
        genero: String,
        descripcion: String
})

module.exports = mongoose.model('Libro', libroSchema);