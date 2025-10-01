import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PokemonMoveSelectionPayload, PokemonVM } from '../../models/view.model';
import { SavedTeam } from '../../models/team.model';
import { PokemonComponent } from '../pokemon/pokemon.component';
type EditMode = 'none' | 'add' | 'edit';

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
  @Output() moveChange = new EventEmitter<PokemonMoveSelectionPayload>();
  @Output() renameTeam = new EventEmitter<{ id: string; name: string }>();

  // Estado UI
  editMode: EditMode = 'none';
  tempName = '';
  trackById(_i: number, p: PokemonVM) {
    return (p as any).id ?? p;
  }

  trackTeamId(_i: number, team: SavedTeam) {
    return team.id;
  }

  onSelectChange(value: string) {
    // Ya no existe la opción 'new': solo ids reales
    this.selectTeam.emit(value || null);
  }
  startAdd() {
    this.editMode = 'add';
    this.tempName = '';
    // opcional: al añadir, des-seleccionamos el equipo actual
    this.selectTeam.emit(null);
  }

  startEdit() {
    if (!this.selectedTeamId) return;
    const current = this.savedTeams.find((s) => s.id === this.selectedTeamId);
    this.tempName = current?.name ?? this.teamName ?? '';
    this.editMode = 'edit';
  }

  cancelEdit() {
    this.editMode = 'none';
    this.tempName = '';
  }

  confirm() {
    const name = this.tempName.trim();
    if (!name) return;

    if (this.editMode === 'add') {
      // Ajustamos el nombre e invocamos la creación
      this.teamNameChange.emit(name);
      this.createTeam.emit();
      this.editMode = 'none';
      this.tempName = '';
    } else if (this.editMode === 'edit' && this.selectedTeamId) {
      // Emitimos renombrado y sincronizamos nombre visible
      this.renameTeam.emit({ id: this.selectedTeamId, name });
      this.teamNameChange.emit(name);
      this.editMode = 'none';
      this.tempName = '';
    }
  }
}
