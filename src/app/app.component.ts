import { Component, inject, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AuthService } from './core/services/auth.service';
import { NativePlatformService } from './core/services/native-platform.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly native = inject(NativePlatformService);

  async ngOnInit(): Promise<void> {
    await this.auth.initialize();
    await this.native.initialize();
  }
}
