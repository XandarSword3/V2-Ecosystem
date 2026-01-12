// Helper utilities for stress testing

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

export function randomElement<T>(arr: T[]): T {
  return arr[randomInt(0, arr.length - 1)];
}

export function weightedRandom(weights: Record<string, number>): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let random = Math.random() * total;
  
  for (const [action, weight] of entries) {
    random -= weight;
    if (random <= 0) return action;
  }
  
  return entries[entries.length - 1][0];
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function randomDelay(min: number, max: number): Promise<void> {
  return sleep(randomInt(min, max));
}

// Generate future date for bookings
export function futureDate(daysAhead: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  return date.toISOString().split('T')[0];
}

// Generate random phone number
export function randomPhone(): string {
  return `+961${randomInt(70000000, 79999999)}`;
}

// Generate random name
const firstNames = ['Ahmad', 'Sara', 'Omar', 'Lina', 'Hassan', 'Maya', 'Karim', 'Nour', 'Ali', 'Rania', 'Fadi', 'Dana'];
const lastNames = ['Khalil', 'Saad', 'Haddad', 'Khoury', 'Nassar', 'Abboud', 'Mansour', 'Saleh', 'Azar', 'Bitar'];

export function randomName(): string {
  return `${randomElement(firstNames)} ${randomElement(lastNames)}`;
}

// Generate random email
export function randomEmail(): string {
  return `${randomElement(firstNames).toLowerCase()}${randomInt(1, 999)}@test.local`;
}

// Common review comments
const reviewComments = [
  'Great experience, will come again!',
  'The service was excellent.',
  'Good food, nice atmosphere.',
  'Average experience, could be better.',
  'Loved every moment of our stay!',
  'Staff was very friendly and helpful.',
  'Beautiful location and great facilities.',
  'A bit overpriced but worth it.',
  'Perfect for a family getaway.',
  'The pool was amazing!',
];

export function randomReviewComment(): string {
  return randomElement(reviewComments);
}

// Order special instructions
const specialInstructions = [
  'No onions please',
  'Extra spicy',
  'Gluten-free if possible',
  'No nuts - allergy',
  'Well done',
  'On the side',
  '',
  '',
  '',
];

export function randomSpecialInstruction(): string {
  return randomElement(specialInstructions);
}

// Contact form subjects
const subjects = [
  'Booking Inquiry',
  'Special Request',
  'Feedback',
  'Complaint',
  'Event Booking',
  'Group Reservation',
];

export function randomSubject(): string {
  return randomElement(subjects);
}

// Status progression for orders (matches backend enum)
export const ORDER_STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed'];

export function nextOrderStatus(current: string): string | null {
  const idx = ORDER_STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx >= ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1];
}
