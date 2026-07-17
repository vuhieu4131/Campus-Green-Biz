const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, query, where } = require("firebase/firestore");
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
  
  const shopId = "14nNSS6BEucASJyqniFjP7CZAub2";
  const shopPhone = "0912326332";

  console.log("Checking transactions by shop ID:");
  const qId = query(collection(db, "point_transactions"), where("userId", "==", shopId));
  const snapId = await getDocs(qId);
  console.log(`Transactions with userId == shopId: ${snapId.size}`);
  snapId.forEach(doc => {
    console.log(`Doc ID: ${doc.id} | Data:`, doc.data());
  });

  console.log("Checking transactions by shop Phone:");
  const qPhone = query(collection(db, "point_transactions"), where("userId", "==", shopPhone));
  const snapPhone = await getDocs(qPhone);
  console.log(`Transactions with userId == shopPhone: ${snapPhone.size}`);
  snapPhone.forEach(doc => {
    console.log(`Doc ID: ${doc.id} | Data:`, doc.data());
  });
}

run().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
