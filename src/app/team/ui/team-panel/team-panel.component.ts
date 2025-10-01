import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PokemonVM } from '../../models/view.model';
import { SavedTeam } from '../../models/team.model';
import { PokemonComponent } from '../pokemon/pokemon.component';

@Component({
  standalone: true,
  selector: 'app-team-panel',
  imports: [FormsModule, PokemonComponent],
  styleUrls: ['./team-panel.component.scss'],
  templateUrl: './team-panel.component.html',
})
export class TeamPanelComponent {
  @Input({ required: true }) team: PokemonVM[] = [];
  @Input({ required: true }) teamName = '';
  @Input({ required: true }) savedTeams: SavedTeam[] = [];
  @Input({ required: true }) selectedTeamId: string | null = null;
  @Output() remove = new EventEmitter<number>();
  @Output() clear = new EventEmitter<void>();
  @Output() teamNameChange = new EventEmitter<string>();
  @Output() selectTeam = new EventEmitter<string | null>();
  @Output() createTeam = new EventEmitter<void>();

  trackById(_i: number, p: PokemonVM) {
    return (p as any).id ?? p;
  }

  trackTeamId(_i: number, team: SavedTeam) {
    return team.id;
  }

  onSelectChange(value: string) {
    this.selectTeam.emit(value === 'new' ? null : value);
  }
}
