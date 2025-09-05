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
        max: 255,
        unique: true
    },
    password: {
        type: String,
        minlength: 6,
        // Hacemos que no sea required para usuarios de Google
        required: function() {
            return !this.googleId; // Solo requerido si no es usuario de Google
        }
    },
    googleId: {
        type: String,
        sparse: true // Permite valores null pero mantiene unicidad
    },
    avatar: {
        type: String
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
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
        default: function() {
            return this.authProvider === 'google'; // Usuarios de Google vienen verificados
        }
    },
    token: String,
    tokenCreatedAt: Date 
});

// Índice compuesto para evitar duplicados
userSchema.index({ googleId: 1 }, { sparse: true, unique: true });

module.exports = mongoose.model('User', userSchema);