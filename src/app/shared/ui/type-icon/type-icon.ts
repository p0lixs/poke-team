import { CommonModule } from '@angular/common';
import { Component, inject, Input } from '@angular/core';
import { TypeIconService } from '../../../team/data/type-icon.service';
import { Observable } from 'rxjs';

type TypeRef = { name: string; url: string };

@Component({
  selector: 'app-type-icon',
  imports: [CommonModule],
  templateUrl: './type-icon.html',
  styleUrl: './type-icon.scss',
  standalone: true,
})
export class TypeIcon {
  @Input() typeDetails: TypeRef[] = [];
  @Input() size = 24; // px
  typeIcons = inject(TypeIconService);

  constructor() {}

  icon$(url: string): Observable<string | null> {
    return this.typeIcons.getIconByTypeUrl(url);
  }

  trackByUrl(_i: number, t: TypeRef) {
    return t.url;
  }
}
