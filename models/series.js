const mongoose = require('mongoose');

const serieSchema = mongoose.Schema({
        fecha: Date,
        titulo: String,
        director: String,
        descripcion: String
})

module.exports = mongoose.model('Serie', serieSchema);