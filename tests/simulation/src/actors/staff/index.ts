/**
 * Staff Actor Exports
 */
export { StaffBot } from './StaffBot';
export type { StaffProfile, StaffState, StaffConfig, StaffShift, StaffDepartment, Task } from './StaffBot';

export { 
  FrontDeskAgent, 
  HousekeepingStaff, 
  KitchenStaff, 
  ServerStaff,
  SpaTherapist,
  createStaffBot 
} from './StaffProfiles';
