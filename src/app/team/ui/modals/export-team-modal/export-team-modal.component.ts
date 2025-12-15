import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-export-team-modal',
  styleUrls: ['../modal.styles.scss', './export-team-modal.component.scss'],
  templateUrl: './export-team-modal.component.html',
})
export class ExportTeamModalComponent {
  @Input() exportText = '';
  @Input() copyStatus: 'idle' | 'copied' | 'error' = 'idle';

  @Output() close = new EventEmitter<void>();
  @Output() copy = new EventEmitter<void>();
}
