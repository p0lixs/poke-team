import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PokemonVM } from '../../models/view.model';
import { PokemonComponent } from '../pokemon/pokemon.component';

@Component({
  standalone: true,
  selector: 'app-team-panel',
  imports: [PokemonComponent],
  styleUrls: ['./team-panel.component.scss'],
  templateUrl: './team-panel.component.html',
})
export class TeamPanelComponent {
  @Input({ required: true }) team: PokemonVM[] = [];
  @Output() remove = new EventEmitter<number>();
  @Output() clear = new EventEmitter<void>();

  trackById(_i: number, p: PokemonVM) {
    return (p as any).id ?? p;
  }
}
