import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { TypeIcon } from '../../../shared/ui/type-icon/type-icon';
import { STAT_MAX_VALUES } from '../../../shared/util/constants';
import { TypeIconService } from '../../data/type-icon.service';
import { PokemonStatVM, PokemonVM } from '../../models/view.model';

@Component({
  selector: 'app-pokemon',
  imports: [CommonModule, TypeIcon],
  templateUrl: './pokemon.component.html',
  styleUrl: './pokemon.component.scss',
})
export class PokemonComponent {
  private _pokemon!: PokemonVM;

  @Input() set pokemon(value: PokemonVM) {
    this._pokemon = {
      ...value,
      stats: value.stats ?? [],
    };
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

  trackType(i: number, t: any) {
    return t?.name ?? i;
  }

  icon$(url: string) {
    return this.typeIcons.getIconByTypeUrl(url);
  }

  getStatPercentage(stat: PokemonStatVM): number {
    const maxStatValue = STAT_MAX_VALUES[stat.name] ?? 0;

    if (!maxStatValue) {
      return 0;
    }

    const percentage = (stat.value / maxStatValue) * 100;
    return Math.min(100, Math.round(percentage));
  }

  getStatGradient(stat: PokemonStatVM): string {
    const percentage = this.getStatPercentage(stat);
    const hue = Math.round((percentage / 100) * 240);
    const startColor = `hsl(${hue}, 85%, 55%)`;
    const endColor = `hsl(${hue}, 85%, 45%)`;

    return `linear-gradient(90deg, ${startColor} 0%, ${endColor} 100%)`;
  }
}
