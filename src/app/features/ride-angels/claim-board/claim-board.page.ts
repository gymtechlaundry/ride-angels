import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { ClaimBoardFilter } from '../../../core/models';
import { ClaimBoardService } from '../../../core/services/claim-board.service';
import { DomainSyncService } from '../../../core/services/domain-sync.service';
import { ClaimBoardCardComponent } from '../../../shared/components/claim-board-card/claim-board-card.component';

@Component({
  selector: 'app-claim-board-page',
  standalone: true,
  imports: [IonContent, IonRefresher, IonRefresherContent, ClaimBoardCardComponent],
  templateUrl: './claim-board.page.html',
  styleUrl: './claim-board.page.scss',
})
export class ClaimBoardPage implements ViewWillEnter {
  private readonly board = inject(ClaimBoardService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly router = inject(Router);

  readonly items = this.board.openBoardItems;
  readonly filter = this.board.filter;

  ionViewWillEnter(): void {
    void this.domainSync.refreshForCurrentUser();
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser();
    } finally {
      event.target.complete();
    }
  }

  setFilter(filter: ClaimBoardFilter): void {
    this.board.setFilter(filter);
  }

  openAppointment(appointmentId: string): void {
    void this.router.navigate(['/tabs/home/appointment', appointmentId]);
  }
}
