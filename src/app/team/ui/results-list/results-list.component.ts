import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TypeIcon } from '../../../shared/ui/type-icon/type-icon';
import { PokemonVM } from '../../models/view.model';

@Component({
  standalone: true,
  selector: 'app-results-list',
  imports: [CommonModule, TypeIcon],
  styleUrls: ['./results-list.component.scss'],
  templateUrl: './results-list.component.html',
})
export class ResultsListComponent {
  @Input() results: PokemonVM[] = [];
  @Input() hasMore = false;
  @Output() add = new EventEmitter<PokemonVM>();
  @Output() loadMore = new EventEmitter<void>();

  trackById(_i: number, p: PokemonVM) {
    return p.id;
  }

  onScroll(event: Event) {
    if (!this.hasMore) return;
    const target = event.target as HTMLElement | null;
    if (!target) return;

    const threshold = 100;
    const isNearBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - threshold;
    if (isNearBottom) {
      this.loadMore.emit();
    }
  }
}
