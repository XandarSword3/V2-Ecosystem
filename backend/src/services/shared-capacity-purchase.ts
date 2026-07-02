import type { SupabaseClient } from '@supabase/supabase-js';



export interface SharedCapacityPurchaseInput {

  sessionId: string;

  moduleId: string;

  propertyId?: string | null;

  customerId?: string | null;

  quantity: number;

  ticketDate: string;

  amount: number;

  metadata?: Record<string, unknown>;

}



export interface SharedCapacityPurchaseResult {

  success: boolean;

  transactionId?: string;

  totalAmount?: number;

  availableCapacity?: number;

  errorMessage?: string;

}



/**

 * Atomically purchase shared-capacity access via DB RPC (FOR UPDATE on session).

 */

export async function purchaseSharedCapacityAtomic(

  supabase: SupabaseClient,

  input: SharedCapacityPurchaseInput,

): Promise<SharedCapacityPurchaseResult> {

  const { data, error } = await supabase.rpc('purchase_shared_capacity_atomic', {

    p_session_id: input.sessionId,

    p_module_id: input.moduleId,

    p_property_id: input.propertyId ?? null,

    p_customer_id: input.customerId ?? null,

    p_quantity: input.quantity,

    p_ticket_date: input.ticketDate,

    p_amount: input.amount,

    p_metadata: input.metadata ?? {},

  });



  if (error) {

    return { success: false, errorMessage: error.message };

  }



  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {

    return { success: false, errorMessage: 'No result from capacity purchase' };

  }



  return {

    success: Boolean(row.success),

    transactionId: row.transaction_id ?? undefined,

    totalAmount: input.amount != null ? Number(input.amount) : undefined,

    availableCapacity:

      row.available_capacity != null ? Number(row.available_capacity) : undefined,

    errorMessage: row.error_message ?? undefined,

  };

}

