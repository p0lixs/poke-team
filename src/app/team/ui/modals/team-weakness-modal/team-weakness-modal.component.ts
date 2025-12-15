import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TypeIcon } from '../../../../shared/ui/type-icon/type-icon';
import { TypeInfo } from '../../../data/type-effectiveness.service';
import { WeaknessTable } from './weakness-table.model';

@Component({
  standalone: true,
  selector: 'app-team-weakness-modal',
  imports: [TypeIcon],
  styleUrls: ['../modal.styles.scss', './team-weakness-modal.component.scss'],
  templateUrl: './team-weakness-modal.component.html',
})
export class TeamWeaknessModalComponent {
  @Input() typeColumns: TypeInfo[] = [];
  @Input() weaknessTable!: WeaknessTable;

  @Output() close = new EventEmitter<void>();
  @Output() toggleTeraType = new EventEmitter<string>();
}
