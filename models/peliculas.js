const mongoose = require('mongoose');

const peliculaSchema = mongoose.Schema({
        fecha: Date,
        titulo: String,
        director: String,
        descripcion: String
})

module.exports = mongoose.model('Pelicula', peliculaSchema);