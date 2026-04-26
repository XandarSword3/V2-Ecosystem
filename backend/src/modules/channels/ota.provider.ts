export interface OtaProvider {
  verifyProperty(propertyId: string): Promise<void>;
  pushAvailability(
    propertyId: string,
    payload: {
      roomTypeCode: string;
      date: string;
      available: number;
    }
  ): Promise<void>;
  pushRate(
    propertyId: string,
    payload: {
      roomTypeCode: string;
      rateCode: string;
      date: string;
      amount: number;
      currency: string;
      minStay?: number;
      maxStay?: number;
      closed?: boolean;
    }
  ): Promise<void>;
}

export class SiteMinderProvider implements OtaProvider {
  constructor(private readonly request: (endpoint: string, method?: 'GET' | 'POST' | 'PUT' | 'DELETE', body?: any) => Promise<any>) {}

  async verifyProperty(propertyId: string): Promise<void> {
    await this.request(`/properties/${propertyId}`);
  }

  async pushAvailability(
    propertyId: string,
    payload: {
      roomTypeCode: string;
      date: string;
      available: number;
    }
  ): Promise<void> {
    await this.request(`/properties/${propertyId}/availability`, 'POST', {
      updates: [{
        roomTypeCode: payload.roomTypeCode,
        dateRange: { startDate: payload.date, endDate: payload.date },
        inventory: payload.available,
      }],
    });
  }

  async pushRate(
    propertyId: string,
    payload: {
      roomTypeCode: string;
      rateCode: string;
      date: string;
      amount: number;
      currency: string;
      minStay?: number;
      maxStay?: number;
      closed?: boolean;
    }
  ): Promise<void> {
    await this.request(`/properties/${propertyId}/rates`, 'POST', {
      updates: [{
        roomTypeCode: payload.roomTypeCode,
        rateCode: payload.rateCode,
        dateRange: { startDate: payload.date, endDate: payload.date },
        rate: { amount: payload.amount, currency: payload.currency },
        restrictions: {
          minStay: payload.minStay,
          maxStay: payload.maxStay,
          closed: payload.closed,
        },
      }],
    });
  }
}
