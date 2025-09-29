import { Component, computed, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { TeamFacade } from '../data/team.facade';
import { SearchBoxComponent } from '../ui/search-box.component';
import { ResultsListComponent } from '../ui/results-list.component';
import { TeamPanelComponent } from '../ui/team-panel.component';

@Component({
  standalone: true,
  selector: 'app-team-page',
  imports: [NgIf, SearchBoxComponent, ResultsListComponent, TeamPanelComponent],
  styles: [
    `
      .layout {
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 1.25rem;
      }
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
      }
      .muted {
        opacity: 0.7;
      }
    `,
  ],
  template: `
    <div class="layout">
      <section>
        <app-search-box (valueChange)="facade.query.set($event)"></app-search-box>
        <div *ngIf="facade.loading()" class="muted" style="margin:.75rem 0">Buscando...</div>
        <div *ngIf="facade.error()" style="color:red">{{ facade.error() }}</div>
        <app-results-list [results]="facade.results()" (add)="facade.addToTeam($event)" />
        <p class="muted" *ngIf="!facade.loading() && facade.results().length === 0">
          Escribe al menos 2 letras para buscar.
        </p>
      </section>
      <aside>
        <app-team-panel
          [team]="facade.team()"
          (remove)="facade.removeFromTeam($event)"
          (clear)="facade.clearTeam()"
        />
      </aside>
    </div>
  `,
})
export class TeamPage {
  facade = inject(TeamFacade);
}
