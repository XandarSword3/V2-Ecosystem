/**
 * In-memory Reporting Repository for Testing
 *
 * This is a test double for the reporting repository that provides
 * mock report data for unit testing purposes.
 */

import type {
  BookingSummary,
  OrderSummary,
  ReportFilters,
  ReportingRepository,
  RevenueSummary,
  UserSummary,
} from '../container/types';

export class InMemoryReportingRepository implements ReportingRepository {
  // Configurable mock data
  private revenueData: RevenueSummary = {
    totalRevenue: 0,
    totalOrders: 0,
    totalBookings: 0,
    averageOrderValue: 0,
    averageBookingValue: 0,
    revenueByDay: [],
    revenueByModule: {},
  };

  private bookingData: BookingSummary = {
    totalBookings: 0,
    confirmedBookings: 0,
    pendingBookings: 0,
    cancelledBookings: 0,
    occupancyRate: 0,
    averageStayDuration: 0,
    popularChalets: [],
  };

  private orderData: OrderSummary = {
    totalOrders: 0,
    completedOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0,
    topItems: [],
    ordersByStatus: {},
  };

  private userData: UserSummary = {
    totalUsers: 0,
    newUsers: 0,
    activeUsers: 0,
    usersByRole: {},
    userGrowthByDay: [],
  };

  async getRevenueSummary(_filters: ReportFilters): Promise<RevenueSummary> {
    return { ...this.revenueData };
  }

  async getBookingSummary(_filters: ReportFilters): Promise<BookingSummary> {
    return { ...this.bookingData };
  }

  async getOrderSummary(_filters: ReportFilters): Promise<OrderSummary> {
    return { ...this.orderData };
  }

  async getUserSummary(_filters: ReportFilters): Promise<UserSummary> {
    return { ...this.userData };
  }

  // Test helper methods
  setRevenueData(data: Partial<RevenueSummary>): void {
    this.revenueData = { ...this.revenueData, ...data };
  }

  setBookingData(data: Partial<BookingSummary>): void {
    this.bookingData = { ...this.bookingData, ...data };
  }

  setOrderData(data: Partial<OrderSummary>): void {
    this.orderData = { ...this.orderData, ...data };
  }

  setUserData(data: Partial<UserSummary>): void {
    this.userData = { ...this.userData, ...data };
  }

  reset(): void {
    this.revenueData = {
      totalRevenue: 0,
      totalOrders: 0,
      totalBookings: 0,
      averageOrderValue: 0,
      averageBookingValue: 0,
      revenueByDay: [],
      revenueByModule: {},
    };
    this.bookingData = {
      totalBookings: 0,
      confirmedBookings: 0,
      pendingBookings: 0,
      cancelledBookings: 0,
      occupancyRate: 0,
      averageStayDuration: 0,
      popularChalets: [],
    };
    this.orderData = {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
      cancelledOrders: 0,
      averageOrderValue: 0,
      topItems: [],
      ordersByStatus: {},
    };
    this.userData = {
      totalUsers: 0,
      newUsers: 0,
      activeUsers: 0,
      usersByRole: {},
      userGrowthByDay: [],
    };
  }
}
