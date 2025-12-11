import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  selector: 'app-import-team-modal',
  imports: [FormsModule],
  styleUrls: ['./modal.styles.scss', './import-team-modal.component.scss'],
  templateUrl: './import-team-modal.component.html',
})
export class ImportTeamModalComponent {
  @Input() importText = '';
  @Input() importError: string | null = null;
  @Input() isImporting = false;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();
  @Output() importTextChange = new EventEmitter<string>();
}
