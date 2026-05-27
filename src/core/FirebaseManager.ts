import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, set, push, onValue, off, onChildAdded, onChildChanged, onChildRemoved, remove, onDisconnect } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBS1V0j7NuziisatOkQoS0v-sDFItnnlbg",
  authDomain: "toxs-craft.firebaseapp.com",
  projectId: "toxs-craft",
  databaseURL: "https://toxs-craft-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "toxs-craft.firebasestorage.app",
  messagingSenderId: "625135303241",
  appId: "1:625135303241:web:570ac5212bf80e18059d98",
  measurementId: "G-GNM4Y7JN0T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const database = getDatabase(app);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account'
});

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export { 
  onAuthStateChanged,
  ref,
  set,
  push,
  onValue,
  off,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  remove,
  onDisconnect
};
export type { User };
