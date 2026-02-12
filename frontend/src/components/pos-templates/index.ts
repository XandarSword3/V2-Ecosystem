/**
 * POS Module Templates
 * 
 * These templates provide complete Point-of-Sale interfaces for menu_service modules.
 * They can be dynamically loaded based on the user's role and module configuration.
 * 
 * Usage:
 * - CustomerPOSTemplate: Customer-facing ordering interface (QR/tablet ordering)
 * - StaffPOSTemplate: Staff interface with floor plan, KDS, and cashier views
 * - AdminPOSTemplate: Full configuration and management interface
 */

export { default as CustomerPOSTemplate } from './CustomerPOSTemplate';
export { default as StaffPOSTemplate } from './StaffPOSTemplate';
export { default as AdminPOSTemplate } from './AdminPOSTemplate';

// Type exports for template props
export interface POSTemplateProps {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
}
