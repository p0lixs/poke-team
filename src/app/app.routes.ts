import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadChildren: () => import('./team/team.routes').then((m) => m.TEAM_ROUTES),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
