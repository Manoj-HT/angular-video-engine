import { Component } from '@angular/core';
import { AveStudioComponent } from '@angular-video/studio';
import { videoCompositions } from './videos';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AveStudioComponent],
  template: `
    <ave-studio
      [compositions]="compositions"
      [defaultDrawerOpen]="true"
      (exportRequested)="onExport($event)"
    />
  `,
  styles: [`
    :host {
      display: block;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
    }
  `]
})
export class AppComponent {
  readonly compositions = videoCompositions;

  onExport(comp: unknown): void {
    console.log('[AVE] Export requested for composition:', comp);
    alert(`Export requested for ${JSON.stringify(comp)}!`);
  }
}
