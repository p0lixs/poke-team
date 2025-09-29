import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgIf, NgFor } from '@angular/common';
import { PokemonVM } from '../models/view.model';

@Component({
  standalone: true,
  selector: 'app-results-list',
  imports: [NgIf, NgFor],
  styles: [
    `
      ul {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      }
      li {
        border: 1px solid #eee;
        border-radius: 0.75rem;
        padding: 0.5rem;
        display: flex;
        gap: 0.75rem;
        align-items: center;
      }
      img {
        width: 56px;
        height: 56px;
      }
      .tag {
        font-size: 0.75rem;
        opacity: 0.8;
        border: 1px solid #ddd;
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
        margin-right: 0.25rem;
      }
      button {
        margin-left: auto;
      }
    `,
  ],
  template: `
    <ul>
      <li *ngFor="let p of results">
        <img
          [src]="
            p.sprite ||
            'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png'
          "
          alt="sprite"
        />
        <div>
          <div style="text-transform:capitalize;font-weight:600">{{ p.name }}</div>
          <div>
            <span class="tag" *ngFor="let t of p.types">{{ t }}</span>
          </div>
        </div>
        <button (click)="add.emit(p)">Añadir</button>
      </li>
    </ul>
  `,
})
export class ResultsListComponent {
  @Input({ required: true }) results!: PokemonVM[];
  @Output() add = new EventEmitter<PokemonVM>();
}
