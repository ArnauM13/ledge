import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Shell } from './layout/shell';

@Component({
  selector: 'ledge-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Shell],
  template: '<ledge-shell />',
})
export class App {}
