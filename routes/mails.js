const nodemailer = require('nodemailer');

// Función para enviar un correo electrónico

async function enviarEmail(destinatario, asunto, cuerpo) {
    try {
        // Configuración del transporte
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'biblotecamultimedia@gmail.com', 
                pass: 'q a a h u e a w d c l i m w h k' // Contraseñas de aplicaciones de google: https://myaccount.google.com/apppasswords?pli=1&rapt=AEjHL4OQG_aVdnaLfE7z3Detk22If9TE0Q7zvs5gX4fA6BmjEPv2dCqA2taLdOTkOSXmTnpbac3JaVYXe5Z9DVGHug46APWZ7OEsy2IHZsO_mBwcxOfyXNc
            }
        });

        // Opciones del correo electrónico
        const mailOptions = {
            from: 'biblotecamultimedia@gmail.com', // Dirección de correo electrónico del remitente
            to: destinatario, // Dirección de correo electrónico del destinatario
            subject: asunto, // Asunto del correo electrónico
            text: cuerpo // Cuerpo del correo electrónico
        };

        // Envío del correo electrónico
        const info = await transporter.sendMail(mailOptions);
        console.log('Correo electrónico enviado:', info.response);
        return { success: true, message: 'Correo electrónico enviado correctamente.' };
    } catch (error) {
        console.error('Error al enviar el correo electrónico:', error);
        return { success: false, message: 'Error al enviar el correo electrónico.' };
    }
}


module.exports = enviarEmail;

