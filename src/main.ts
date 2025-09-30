import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { App } from './app/app';

// Import the functions you need from the SDKs you need
import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyApUdIt3-5WG8lBz1D6gLDa-VgeCFXjtMQ',
  authDomain: 'poketeam-c9c09.firebaseapp.com',
  projectId: 'poketeam-c9c09',
  storageBucket: 'poketeam-c9c09.firebasestorage.app',
  messagingSenderId: '502399047563',
  appId: '1:502399047563:web:2e326ce897865e5680818e',
  measurementId: 'G-KQ20ZXTB7E',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

bootstrapApplication(App, {
  providers: [provideHttpClient(withInterceptorsFromDi()), provideRouter(routes)],
});
