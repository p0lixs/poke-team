import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeamFacade } from '../data/team.facade';
import { ResultsListComponent } from '../ui/results-list/results-list.component';
import { SearchBoxComponent } from '../ui/search-box/search-box.component';
import { TeamPanelComponent } from '../ui/team-panel/team-panel.component';
import { TypeIcon } from '../../shared/ui/type-icon/type-icon';
import { TypeEffectivenessService, TypeInfo } from '../data/type-effectiveness.service';
import { PokemonVM } from '../models/view.model';

@Component({
  standalone: true,
  selector: 'app-team-page',
  imports: [FormsModule, SearchBoxComponent, ResultsListComponent, TeamPanelComponent, TypeIcon],
  styleUrls: ['./team.page.scss'],
  templateUrl: './team.page.html',
})
export class TeamPage {
  facade = inject(TeamFacade);
  private readonly typeEffectiveness = inject(TypeEffectivenessService);

  showImportModal = false;
  showExportModal = false;
  showWeaknessModal = false;
  exportText = '';
  importText = '';
  importError: string | null = null;
  isImporting = false;
  copyStatus: 'idle' | 'copied' | 'error' = 'idle';
  readonly typeColumns: TypeInfo[] = this.typeEffectiveness.getTypes();
  readonly weaknessTable = computed(() => this.buildWeaknessTable());

  openImportDialog() {
    this.importText = '';
    this.importError = null;
    this.isImporting = false;
    this.showImportModal = true;
  }

  closeImportDialog() {
    if (this.isImporting) {
      return;
    }
    this.showImportModal = false;
    this.importText = '';
    this.importError = null;
  }

  openExportDialog() {
    this.exportText = this.facade.exportTeamAsText();
    this.copyStatus = 'idle';
    this.showExportModal = true;
  }

  closeExportDialog() {
    this.showExportModal = false;
    this.copyStatus = 'idle';
    this.exportText = '';
  }

  openWeaknessDialog() {
    if (!this.facade.team().length) return;
    this.showWeaknessModal = true;
  }

  closeWeaknessDialog() {
    this.showWeaknessModal = false;
  }

  async confirmImport() {
    const text = this.importText.trim();
    if (!text) {
      this.importError = 'Paste a team in the text area.';
      return;
    }

    this.isImporting = true;
    const result = await this.facade.importTeamFromText(text);
    this.isImporting = false;

    if (!result.success) {
      this.importError = result.error ?? 'Unable to import the team.';
      return;
    }

    this.showImportModal = false;
    this.importText = '';
    this.importError = null;
  }

  async copyExportText() {
    const text = this.exportText;
    if (!text) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      this.copyStatus = 'error';
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus = 'copied';
    } catch (error) {
      console.error('Unable to copy team to clipboard', error);
      this.copyStatus = 'error';
    }

    setTimeout(() => {
      this.copyStatus = 'idle';
    }, 2000);
  }

  private buildWeaknessTable() {
    const types = this.typeColumns;
    const team = this.facade.team();

    return team.map((pokemon) => {
      const defenses = this.normalizeTypes(pokemon);
      const teraType = pokemon.teraType?.toLowerCase().trim() || null;
      const cells = types.map((type) => {
        const multiplier = this.typeEffectiveness.getMultiplier(type.name, defenses, teraType);
        return { type: type.name, multiplier, label: this.formatMultiplier(multiplier) };
      });

      return { pokemon, cells, teraType };
    });
  }

  private normalizeTypes(pokemon: PokemonVM): string[] {
    if (Array.isArray(pokemon.typeDetails) && pokemon.typeDetails.length) {
      return pokemon.typeDetails.map((type) => type.name.toLowerCase());
    }

    return (pokemon.types ?? []).map((type) => type.toLowerCase());
  }

  private formatMultiplier(multiplier: number): string {
    const rounded = Math.round(multiplier * 100) / 100;
    if (this.isClose(rounded, 0)) return 'x0';
    if (this.isClose(rounded, 0.25)) return 'x1/4';
    if (this.isClose(rounded, 0.5)) return 'x1/2';
    if (this.isClose(rounded, 1)) return 'x1';
    if (this.isClose(rounded, 2)) return 'x2';
    if (this.isClose(rounded, 4)) return 'x4';

    return `x${rounded}`;
  }

  private isClose(value: number, target: number): boolean {
    return Math.abs(value - target) < 0.01;
  }
}
