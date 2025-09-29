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
  @Input() pokemon!: PokemonVM;
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
}
