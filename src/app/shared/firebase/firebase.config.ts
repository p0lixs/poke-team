import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyApUdIt3-5WG8lBz1D6gLDa-VgeCFXjtMQ',
  authDomain: 'poketeam-c9c09.firebaseapp.com',
  projectId: 'poketeam-c9c09',
  storageBucket: 'poketeam-c9c09.firebasestorage.app',
  messagingSenderId: '502399047563',
  appId: '1:502399047563:web:2e326ce897865e5680818e',
  measurementId: 'G-KQ20ZXTB7E',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);
