import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonToggle,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { AppointmentService } from '../../../core/services/appointment.service';
import { AuthService } from '../../../core/services/auth.service';
import { DomainSyncService } from '../../../core/services/domain-sync.service';
import { NotificationService } from '../../../core/services/notification.service';
import { RideAngelService } from '../../../core/services/ride-angel.service';
import { isSupabaseConfigured } from '../../../core/supabase/supabase-client';
import {
  addHoursToTimeKey,
  defaultAppointmentDateTime,
  toDateKey,
} from '../../../core/utils/date-time';
import { DateTimeFieldComponent } from '../../../shared/components/date-time-field/date-time-field.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-add-appointment-page',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonToggle,
    ReactiveFormsModule,
    PageHeaderComponent,
    PrimaryButtonComponent,
    DateTimeFieldComponent,
  ],
  templateUrl: './add-appointment.page.html',
  styleUrl: './add-appointment.page.scss',
})
export class AddAppointmentPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly appointments = inject(AppointmentService);
  private readonly notifications = inject(NotificationService);
  private readonly angels = inject(RideAngelService);
  private readonly auth = inject(AuthService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastController);

  readonly returnNeeded = signal(true);
  readonly editingId = signal<string | null>(null);
  readonly minDate = toDateKey(new Date());

  private readonly defaults = defaultAppointmentDateTime();

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    date: [this.defaults.date, Validators.required],
    time: [this.defaults.time, Validators.required],
    pickupLabel: ['', Validators.required],
    destinationLabel: ['', Validators.required],
    returnPickupTime: [addHoursToTimeKey(this.defaults.time, 2)],
    notes: [''],
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }
    const detail = this.appointments.detailView(id);
    if (!detail || detail.appointment.status === 'cancelled') {
      void this.router.navigate(['/tabs/home']);
      return;
    }
    this.editingId.set(id);
    this.returnNeeded.set(detail.ride.returnNeeded);
    this.form.patchValue({
      title: detail.appointment.title,
      date: detail.appointment.date,
      time: detail.appointment.time,
      pickupLabel: detail.ride.pickup.label,
      destinationLabel: detail.ride.destination.label,
      returnPickupTime:
        detail.ride.returnPickupTime ||
        addHoursToTimeKey(detail.appointment.time, 2),
      notes: detail.appointment.notes ?? '',
    });
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser({ force: true });
    } finally {
      event.target.complete();
    }
  }

  onReturnToggle(checked: boolean): void {
    this.returnNeeded.set(checked);
  }

  onAppointmentDateChange(date: string): void {
    this.form.patchValue({ date });
  }

  onAppointmentTimeChange(time: string): void {
    this.form.patchValue({ time });
    if (!this.form.controls.returnPickupTime.dirty) {
      this.form.patchValue({ returnPickupTime: addHoursToTimeKey(time, 2) });
    }
  }

  onReturnTimeChange(time: string): void {
    this.form.patchValue({ returnPickupTime: time });
    this.form.controls.returnPickupTime.markAsDirty();
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const editId = this.editingId();
    if (editId) {
      await this.saveEdit(editId);
      return;
    }
    await this.saveCreate();
  }

  private async saveCreate(): Promise<void> {
    try {
      const value = this.form.getRawValue();
      const appointment = await this.appointments.createAppointment({
        title: value.title,
        date: value.date,
        time: value.time,
        pickupLabel: value.pickupLabel,
        pickupLine1: value.pickupLabel,
        destinationLabel: value.destinationLabel,
        destinationLine1: value.destinationLabel,
        returnNeeded: this.returnNeeded(),
        returnPickupTime: this.returnNeeded() ? value.returnPickupTime : undefined,
        publicBoard: false,
        notes: value.notes.trim() || undefined,
      });

      const rider = this.auth.getCurrentUser();

      // Supabase: create_appointment_with_ride fans out persisted angel notifications.
      // Local mock: optimistic notify only.
      if (!isSupabaseConfigured()) {
        for (const angelId of this.angels.getAcceptedAngelIds(rider.id)) {
          this.notifications.notify({
            userId: angelId,
            type: 'appointment_changed',
            title: 'New ride request',
            body: `${rider.displayName} needs a ride for ${appointment.title} (private circle).`,
            relatedAppointmentId: appointment.id,
          });
        }

        this.notifications.notify({
          userId: rider.id,
          type: 'appointment_changed',
          title: 'Appointment Scheduled',
          body: `${appointment.title} was shared with your Ride Angels.`,
          relatedAppointmentId: appointment.id,
        });
      }

      const toast = await this.toast.create({
        message: 'Appointment scheduled. Your Ride Angels will be notified.',
        duration: 2200,
        color: 'primary',
        position: 'top',
      });
      await toast.present();
      void this.router.navigate(['/tabs/home']);
    } catch (err) {
      await this.showError(err, 'Unable to schedule appointment.');
    }
  }

  private async saveEdit(appointmentId: string): Promise<void> {
    try {
      const value = this.form.getRawValue();
      const result = await this.appointments.updateAppointment(appointmentId, {
        title: value.title,
        date: value.date,
        time: value.time,
        pickupLabel: value.pickupLabel,
        pickupLine1: value.pickupLabel,
        destinationLabel: value.destinationLabel,
        destinationLine1: value.destinationLabel,
        returnNeeded: this.returnNeeded(),
        returnPickupTime: this.returnNeeded() ? value.returnPickupTime : undefined,
        publicBoard: false,
        notes: value.notes.trim() || undefined,
      });

      const toast = await this.toast.create({
        message: result.needsReconfirm
          ? 'Appointment updated. Your Ride Angel was asked to confirm they can still drive.'
          : 'Appointment updated.',
        duration: 2600,
        color: 'primary',
        position: 'top',
      });
      await toast.present();
      void this.router.navigate(['/tabs/home/appointment', appointmentId]);
    } catch (err) {
      await this.showError(err, 'Unable to update appointment.');
    }
  }

  private async showError(err: unknown, fallback: string): Promise<void> {
    const toast = await this.toast.create({
      message: err instanceof Error ? err.message : fallback,
      duration: 3200,
      color: 'danger',
      position: 'top',
    });
    await toast.present();
  }
}
