export type KioskMode = 'idle' | 'checkin' | 'checkout' | 'menu';
export type KioskStep = 'welcome' | 'identify' | 'confirm' | 'payment' | 'key' | 'complete' | 'error';

export interface GuestInfo {
  name: string;
  room: string;
  checkInDate: string;
  checkOutDate: string;
  balance?: number;
}
