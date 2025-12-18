import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDdNRTFnuNCJaaVr2_N3rVMqOQeH_6D0Fs",
  authDomain: "barra-2242e.firebaseapp.com",
  projectId: "barra-2242e",
  storageBucket: "barra-2242e.firebasestorage.app",
  messagingSenderId: "748408677784",
  appId: "1:748408677784:web:211635965cc616536377ed"
};


const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);