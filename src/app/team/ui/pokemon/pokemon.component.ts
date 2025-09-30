import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { PokemonStatVM, PokemonVM } from '../../models/view.model';
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
  private static readonly STAT_MAX_VALUES: Record<string, number> = {
    hp: 255,
    attack: 190,
    defense: 250,
    'special-attack': 194,
    'special-defense': 250,
    speed: 200,
  };

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

  trackType(i: number, t: any) { return t?.name ?? i; }

  icon$(url: string) {
    return this.typeIcons.getIconByTypeUrl(url);
  }

  getStatPercentage(stat: PokemonStatVM): number {
    const maxStatValue = PokemonComponent.STAT_MAX_VALUES[stat.name] ?? 0;

    if (!maxStatValue) {
      return 0;
    }

    const percentage = (stat.value / maxStatValue) * 100;
    return Math.min(100, Math.round(percentage));
  }
}
