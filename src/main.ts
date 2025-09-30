import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { App } from './app/app';

// Import the functions you need from the SDKs you need
import { getAnalytics, isSupported } from 'firebase/analytics';
import { firebaseApp } from './app/shared/firebase/firebase.config';

if (typeof window !== 'undefined') {
  void isSupported().then((supported: boolean) => {
    if (supported) {
      getAnalytics(firebaseApp);
    }
  });
}

bootstrapApplication(App, {
  providers: [provideHttpClient(withInterceptorsFromDi()), provideRouter(routes)],
});
