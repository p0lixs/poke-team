import { Component, EventEmitter, Output, signal } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-search-box',
  templateUrl: './search-box.component.html',
  styleUrls: ['./search-box.component.scss'],
})
export class SearchBoxComponent {
  public value = signal('');
  @Output() valueChange = new EventEmitter<string>();

  onInput(v: string) {
    this.value.set(v);
    this.valueChange.emit(v);
  }
}
