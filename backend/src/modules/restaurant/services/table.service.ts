import { getSupabase } from "../../../database/connection.js";
import QRCode from 'qrcode';
import { config } from "../../../config/index.js";

export async function getAllTables() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('is_active', true)
    .order('table_number', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getTableById(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('id', id)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function createTable(data: {
  tableNumber: string;
  capacity: number;
  location?: string;
}) {
  const supabase = getSupabase();

  // Generate QR code for table ordering
  const tableUrl = `${config.frontendUrl}/order?table=${data.tableNumber}`;
  const qrCode = await QRCode.toDataURL(tableUrl);

  const { data: table, error } = await supabase
    .from('restaurant_tables')
    .insert({
      table_number: data.tableNumber,
      capacity: data.capacity,
      location: data.location,
      qr_code: qrCode,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return table;
}

export async function updateTable(id: string, data: Partial<{
  tableNumber: string;
  capacity: number;
  location: string;
  isActive: boolean;
}>) {
  const supabase = getSupabase();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  
  if (data.tableNumber !== undefined) updateData.table_number = data.tableNumber;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.isActive !== undefined) updateData.is_active = data.isActive;

  const { data: table, error } = await supabase
    .from('restaurant_tables')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return table;
}

export async function deleteTable(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('restaurant_tables')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}
