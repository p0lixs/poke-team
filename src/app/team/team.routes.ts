import { Routes } from '@angular/router';

export const TEAM_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/team.page').then((m) => m.TeamPage),
  },
];
