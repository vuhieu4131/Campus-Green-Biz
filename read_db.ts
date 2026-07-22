import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

// Read config from src/firebase.ts (or just copy it here)
import * as fs from 'fs';
const firebaseContent = fs.readFileSync('src/firebase.ts', 'utf8');
const configMatch = firebaseContent.match(/const firebaseConfig = ({[\s\S]*?});/);
if (configMatch) {
  const configStr = configMatch[1].replace(/import\.meta\.env\.VITE_.*?/g, '""'); // dummy
  // Actually we need the real env vars. Let's see if there is an .env file
  const envContent = fs.existsSync('.env') ? fs.readFileSync('.env', 'utf8') : '';
  const envs = {};
  envContent.split('\n').forEach(line => {
    const [key, val] = line.split('=');
    if (key && val) envs[key.trim()] = val.trim();
  });
  
  const actualConfig = configStr
    .replace('import.meta.env.VITE_FIREBASE_API_KEY', `"${envs.VITE_FIREBASE_API_KEY}"`)
    .replace('import.meta.env.VITE_FIREBASE_AUTH_DOMAIN', `"${envs.VITE_FIREBASE_AUTH_DOMAIN}"`)
    .replace('import.meta.env.VITE_FIREBASE_PROJECT_ID', `"${envs.VITE_FIREBASE_PROJECT_ID}"`)
    .replace('import.meta.env.VITE_FIREBASE_STORAGE_BUCKET', `"${envs.VITE_FIREBASE_STORAGE_BUCKET}"`)
    .replace('import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID', `"${envs.VITE_FIREBASE_MESSAGING_SENDER_ID}"`)
    .replace('import.meta.env.VITE_FIREBASE_APP_ID', `"${envs.VITE_FIREBASE_APP_ID}"`);
    
  eval(`var firebaseConfig = ${actualConfig};`);
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  getDoc(doc(db, "system_config", "admin_settings")).then(snap => {
    console.log(snap.data());
    process.exit(0);
  });
}
