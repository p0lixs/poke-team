import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { PokemonVM } from '../../models/view.model';
import { TypeIconService } from '../../data/type-icon.service';
import { TypeIcon } from '../../../shared/ui/type-icon/type-icon';

@Component({
  selector: 'app-pokemon',
  imports: [CommonModule, TypeIcon],
  templateUrl: './pokemon.component.html',
  styleUrl: './pokemon.component.scss',
})
export class PokemonComponent {
  private _pokemon!: PokemonVM;
  private maxStatValue = 0;

  @Input() set pokemon(value: PokemonVM) {
    this._pokemon = {
      ...value,
      stats: value.stats ?? [],
    };
    this.maxStatValue = this._pokemon.stats.reduce((max, stat) => Math.max(max, stat.value), 0);
  }
  get pokemon(): PokemonVM {
    return this._pokemon;
  }

  @Input() showRemove = true; // por si quieres ocultar el botón en otros contextos
  @Output() remove = new EventEmitter<number>();

  typeIcons = inject(TypeIconService);

  onRemove() {
    this.remove.emit(this.pokemon.id);
  }

  trackType(i: number, t: any) { return t?.name ?? i; }

  icon$(url: string) {
    return this.typeIcons.getIconByTypeUrl(url);
  }

  getStatPercentage(statValue: number): number {
    if (!this.maxStatValue) {
      return 0;
    }

    const percentage = (statValue / this.maxStatValue) * 100;
    return Math.min(100, Math.round(percentage));
  }
}
