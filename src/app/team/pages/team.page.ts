import { Component, inject } from '@angular/core';
import { TeamFacade } from '../data/team.facade';
import { ResultsListComponent } from '../ui/results-list/results-list.component';
import { SearchBoxComponent } from '../ui/search-box/search-box.component';
import { TeamPanelComponent } from '../ui/team-panel/team-panel.component';

@Component({
  standalone: true,
  selector: 'app-team-page',
  imports: [SearchBoxComponent, ResultsListComponent, TeamPanelComponent],
  styleUrls: ['./team.page.scss'],
  templateUrl: './team.page.html',
})
export class TeamPage {
  facade = inject(TeamFacade);
}
