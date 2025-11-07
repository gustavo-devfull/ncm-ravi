import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAIMIJo50s4cOBF99oj5X78p8ucNSNwudg",
  authDomain: "cotacao-13e42.firebaseapp.com",
  projectId: "cotacao-13e42",
  storageBucket: "cotacao-13e42.firebasestorage.app",
  messagingSenderId: "219626678506",
  appId: "1:219626678506:web:69802d780f4f62cdb74f93"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar Firestore
export const db = getFirestore(app);

// Inicializar Storage (opcional, para upload de arquivos)
export const storage = getStorage(app);

export default app;

