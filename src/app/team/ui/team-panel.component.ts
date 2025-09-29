import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { PokemonVM } from '../models/view.model';

@Component({
  standalone: true,
  selector: 'app-team-panel',
  imports: [NgFor, NgIf],
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }
      .card {
        border: 1px solid #eee;
        border-radius: 0.75rem;
        padding: 0.75rem;
        display: flex;
        gap: 0.75rem;
        align-items: center;
        min-height: 84px;
      }
      img {
        width: 56px;
        height: 56px;
      }
      .slot {
        opacity: 0.5;
        text-align: center;
        border: 1px dashed #ddd;
        border-radius: 0.75rem;
        padding: 1.5rem;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      button {
        cursor: pointer;
      }
    `,
  ],
  template: `
    <div class="header">
      <h3>Tu equipo ({{ team.length }}/6)</h3>
      <button (click)="clear.emit()" [disabled]="team.length === 0">Vaciar</button>
    </div>
    <div class="grid">
      <div class="card" *ngFor="let p of team">
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
        <button (click)="remove.emit(p.id)" style="margin-left:auto">Quitar</button>
      </div>
      <div *ngFor="let i of emptySlots" class="slot">Vacío</div>
    </div>
  `,
})
export class TeamPanelComponent {
  @Input({ required: true }) team!: PokemonVM[];
  @Output() remove = new EventEmitter<number>();
  @Output() clear = new EventEmitter<void>();

  get emptySlots(): number[] {
    const n = Math.max(0, 6 - this.team.length);
    return Array.from({ length: n }, (_, i) => i);
  }
}
