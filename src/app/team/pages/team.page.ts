import { Component, computed, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { TeamFacade } from '../data/team.facade';
import { SearchBoxComponent } from '../ui/search-box.component';
import { ResultsListComponent } from '../ui/results-list/results-list.component';
import { TeamPanelComponent } from '../ui/team-panel/team-panel.component';

@Component({
  standalone: true,
  selector: 'app-team-page',
  imports: [ SearchBoxComponent, ResultsListComponent, TeamPanelComponent],
  styleUrls: ['./team.page.scss'],
  templateUrl: './team.page.html',
})
export class TeamPage {
  facade = inject(TeamFacade);
}
