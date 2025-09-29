import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [RouterOutlet],
  styles: [
    `
      header {
        padding: 1rem;
        border-bottom: 1px solid #eee;
      }
      main {
        max-width: 1080px;
        margin: 0 auto;
        padding: 1rem;
      }
      .brand {
        font-weight: 700;
        font-size: 1.2rem;
      }
    `,
  ],
  template: `
    <header>
      <span class="brand">PokéTeams</span>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
})
export class ShellComponent {}
