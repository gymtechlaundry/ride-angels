import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'home',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../features/home/home.page').then((m) => m.HomePage),
          },
          {
            path: 'add-appointment',
            loadComponent: () =>
              import('../features/appointments/add/add-appointment.page').then(
                (m) => m.AddAppointmentPage,
              ),
          },
          {
            path: 'appointment/:id',
            loadComponent: () =>
              import('../features/appointments/detail/appointment-detail.page').then(
                (m) => m.AppointmentDetailPage,
              ),
          },
          {
            path: 'appointment/:id/edit',
            loadComponent: () =>
              import('../features/appointments/add/add-appointment.page').then(
                (m) => m.AddAppointmentPage,
              ),
          },
          {
            path: 'claim-board',
            redirectTo: '/tabs/calendar',
            pathMatch: 'full',
          },
          {
            path: 'notifications',
            loadComponent: () =>
              import('../features/notifications/notifications.page').then(
                (m) => m.NotificationsPage,
              ),
          },
        ],
      },
      {
        path: 'calendar',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../features/calendar/calendar.page').then(
                (m) => m.CalendarPage,
              ),
          },
          {
            path: 'day/:date',
            loadComponent: () =>
              import('../features/calendar/calendar-day.page').then(
                (m) => m.CalendarDayPage,
              ),
          },
        ],
      },
      {
        path: 'requests',
        redirectTo: '/tabs/calendar',
        pathMatch: 'full',
      },
      {
        path: 'ride-angels',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../features/ride-angels/my-angels/my-ride-angels.page').then(
                (m) => m.MyRideAngelsPage,
              ),
          },
          {
            path: 'rider/:riderId',
            loadComponent: () =>
              import(
                '../features/ride-angels/rider-detail/circle-rider-detail.page'
              ).then((m) => m.CircleRiderDetailPage),
          },
        ],
      },
      {
        path: 'profile',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('../features/profile/profile.page').then((m) => m.ProfilePage),
          },
          {
            path: 'discussion',
            loadComponent: () =>
              import('../features/discussion/discussion.page').then(
                (m) => m.DiscussionPage,
              ),
          },
        ],
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/home',
    pathMatch: 'full',
  },
];
