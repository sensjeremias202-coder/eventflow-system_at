// Este arquivo não deve ser usado para inicializar o Firebase no backend usando o SDK do frontend.
// Caso queira usar Firebase no backend, utilize o Firebase Admin SDK:
// const admin = require('firebase-admin');
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
//   databaseURL: 'https://<SEU-PROJETO>.firebaseio.com'
// });

// Atualmente, o backend utiliza autenticação própria (JWT + MongoDB).
// Se não for usar Firebase Admin no backend, este arquivo pode ser removido.