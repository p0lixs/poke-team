import { Component, EventEmitter, Output, input, signal } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-search-box',
  template: `
    <input
      type="search"
      [value]="value()"
      (input)="onInput($any($event.target).value)"
      placeholder="Buscar Pokémon por nombre..."
    />
  `,
  styles: [
    `
      input {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 0.5rem;
      }
    `,
  ],
})
export class SearchBoxComponent {
  public value = signal('');
  @Output() valueChange = new EventEmitter<string>();

  onInput(v: string) {
    this.value.set(v);
    this.valueChange.emit(v);
  }
}
