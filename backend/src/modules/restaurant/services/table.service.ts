import { getSupabase } from "../../../database/connection.js";
import QRCode from 'qrcode';
import { config } from "../../../config/index.js";

export async function getAllTables() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .eq('is_active', true)
    .order('number', { ascending: true });

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

  // FIX: Issue 14 — Store QR code in the database
  const { data: table, error } = await supabase
    .from('restaurant_tables')
    .insert({
      number: parseInt(data.tableNumber) || 0,
      name: `Table ${data.tableNumber}`,
      capacity: data.capacity,
      section: data.location || 'Main',
      is_active: true,
      qr_code: qrCode,
    })
    .select()
    .single();

  if (error) throw error;
  return table;
}

/**
 * Generate QR code on-demand for a given table
 */
export async function getTableQRCode(tableId: string) {
  const table = await getTableById(tableId);
  if (!table) return null;

  // FIX: Issue 14 — Return stored QR code if available, regenerate only if null
  if (table.qr_code) {
    return { tableId: table.id, tableNumber: table.number, qrCode: table.qr_code };
  }

  // Regenerate and store
  const tableUrl = `${config.frontendUrl}/order?table=${table.number}`;
  const qrCode = await QRCode.toDataURL(tableUrl, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  // Persist to DB
  const supabase = getSupabase();
  await supabase
    .from('restaurant_tables')
    .update({ qr_code: qrCode })
    .eq('id', tableId);

  return { tableId: table.id, tableNumber: table.number, qrCode };
}

export async function updateTable(id: string, data: Partial<{
  tableNumber: string;
  capacity: number;
  location: string;
  isActive: boolean;
}>) {
  const supabase = getSupabase();
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (data.tableNumber !== undefined) updateData.number = parseInt(data.tableNumber) || 0;
  if (data.capacity !== undefined) updateData.capacity = data.capacity;
  if (data.location !== undefined) updateData.section = data.location;
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
