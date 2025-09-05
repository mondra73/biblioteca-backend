const jwt = require('jsonwebtoken');
const User = require('../models/Users');

// middleware to validate token (rutas protegidas)
const verifyToken = async (req, res, next) => {
    const token = req.header('auth-token');
    if (!token) return res.status(401).json({ error: 'Acceso denegado' });
    
    try {
        const verified = jwt.verify(token, process.env.TOKEN_SECRET);
        
        // Buscar el usuario en la base de datos para verificar que existe
        const user = await User.findById(verified.id);
        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        // Agregar información completa del usuario al request
        req.user = {
            id: user._id,
            name: user.name,
            email: user.email,
            authProvider: user.authProvider,
            verificado: user.verificado
        };
        
        next();
    } catch (error) {
        res.status(400).json({ error: 'Token no es válido' });
    }
}

module.exports = verifyToken;