// d:\CampusBiz\Campus-Green-Biz\test-fb.js
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");
const { getAuth, signInWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyDF4jBlhobzytz0xphXgH_VzSNn7c_TpZc",
  authDomain: "campusbizproject.firebaseapp.com",
  projectId: "campusbizproject",
  storageBucket: "campusbizproject.firebasestorage.app",
  messagingSenderId: "981136546059",
  appId: "1:981136546059:web:47f3a7b8a6c0c49766aa0e",
  measurementId: "G-FJKCT56XNN"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  await signInWithEmailAndPassword(auth, "0000869131@campus.com", "123456");
  
  console.log("Checking banners collection:");
  const bannersSnap = await getDocs(collection(db, "banners"));
  console.log("Total banners in Firestore:", bannersSnap.size);
  bannersSnap.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Type: ${data.type} | Active: ${data.active} | Image: ${data.image} | Link: ${data.link}`);
  });
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
