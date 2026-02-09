import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// --- PASTE YOUR FIREBASE CONFIG HERE ---
// (Go to Firebase Console -> Project Settings -> General -> Scroll down to SDK Setup)
const firebaseConfig = {
  apiKey: "AIzaSyBxQd9n0tz2gsKZQZIBq_qqpqPcdcH5HCM",
  authDomain: "led-build-pro.firebaseapp.com",
  projectId: "led-build-pro",
  storageBucket: "led-build-pro.firebasestorage.app",
  messagingSenderId: "826806320809",
  appId: "1:826806320809:web:7e6cbb1c7b4aa8c3ab33b8",
  measurementId: "G-BYQTTDQSBH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };