import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TypeIcon } from '../../../shared/ui/type-icon/type-icon';
import { PokemonVM } from '../../models/view.model';

@Component({
  standalone: true,
  selector: 'app-results-list',
  imports: [TypeIcon],
  styleUrls: ['./results-list.component.scss'],
  templateUrl: './results-list.component.html',
})
export class ResultsListComponent {
  @Input() results: PokemonVM[] = [];
  @Output() add = new EventEmitter<PokemonVM>();

  trackById(_i: number, p: PokemonVM) {
    return p.id;
  }
}
