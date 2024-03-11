const enviarEmail = require('./mails');



// Ejemplo de uso de la función enviarEmail()

enviarEmail('mondra73@gmail.com', 'probando funcion', 'Haz click en el siguiente enlace para activar tu cuenta:')
    .then(result => console.log(result))
    .catch(error => console.error(error));