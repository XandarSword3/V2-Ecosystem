export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    specialInstructions?: string;
  }[];
  totalAmount: number;
  createdAt: string;
  tableNumber?: string;
}

export const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];
