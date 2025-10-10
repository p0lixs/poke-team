import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TeamFacade } from '../data/team.facade';
import { ResultsListComponent } from '../ui/results-list/results-list.component';
import { SearchBoxComponent } from '../ui/search-box/search-box.component';
import { TeamPanelComponent } from '../ui/team-panel/team-panel.component';

@Component({
  standalone: true,
  selector: 'app-team-page',
  imports: [FormsModule, SearchBoxComponent, ResultsListComponent, TeamPanelComponent],
  styleUrls: ['./team.page.scss'],
  templateUrl: './team.page.html',
})
export class TeamPage {
  facade = inject(TeamFacade);

  showImportModal = false;
  showExportModal = false;
  exportText = '';
  importText = '';
  importError: string | null = null;
  isImporting = false;
  copyStatus: 'idle' | 'copied' | 'error' = 'idle';

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
}
