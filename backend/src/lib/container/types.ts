// Notification types used by notifications controller
export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type NotificationTargetType = 'all' | 'admin' | 'staff' | 'user' | 'customer';
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';
