/**
 * Shared LLM Parser Utility
 * Shared across all dynamic import module types
 */

import axios from 'axios';
import { logger } from '../../../utils/logger.js';

/**
 * Call Anthropic Claude API to parse unstructured text into structured JSON
 * @param systemPrompt - The system prompt defining the expected output schema
 * @param userInput - The unstructured text to parse
 * @returns Parsed JSON array from LLM response
 */
export async function callLlmParser(systemPrompt: string, userInput: string): Promise<unknown[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('AI parsing is disabled: ANTHROPIC_API_KEY is missing');
  }

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userInput }]
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    });

    const content = response.data.content[0].text;
    const jsonStart = content.indexOf('[');
    const jsonEnd = content.lastIndexOf(']') + 1;

    if (jsonStart === -1 || jsonEnd === 0) {
      throw new Error('LLM output could not be parsed as JSON array');
    }

    const rawJson = JSON.parse(content.substring(jsonStart, jsonEnd));
    return Array.isArray(rawJson) ? rawJson : [rawJson];
  } catch (err: unknown) {
    logger.error('LLM Parsing Error:', err);
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`LLM parsing failed: ${message}`);
  }
}

/**
 * Base system prompts for different module imports
 */
export const LLM_SYSTEM_PROMPTS = {
  instant_transaction: `You are a menu parsing expert. Convert the following unstructured text into a structured JSON array of menu items.
Each item must follow this schema:
{
  "name": string (required),
  "price": number (required),
  "category": string (required, use 'General' if unknown),
  "description": string (optional),
  "is_available": boolean (default true),
  "discount_price": number (optional),
  "preparation_time": number (minutes, optional),
  "calories": number (optional),
  "allergens": string[] (optional),
  "modifiers": [
    {
      "name": string (group name, e.g., 'Size', 'Toppings'),
      "is_required": boolean,
      "options": [{ "name": string, "price": number, "modifierType": "add" | "remove" | "swap" }]
    }
  ] (optional),
  "ingredients": [
    {
      "name": string (ingredient name),
      "estimatedQuantity": number,
      "estimatedUnit": string (one of: 'g', 'ml', 'piece', 'kg', 'l')
    }
  ] (optional)
}
Rules:
1. Prices must be numbers. If a range is given, use the lowest price.
2. If multiple sizes are given, create one item with a 'Size' modifier group.
3. Respond ONLY with the JSON array. No preamble or markdown.
4. If ingredients or components are mentioned or strongly implied by the item name (e.g. 'Cheese Pizza' implies mozzarella, dough, tomato sauce), add an 'ingredients' array. Each ingredient: { name, estimatedQuantity, estimatedUnit }. Use sensible F&B quantities (e.g. mozzarella: 80g, dough: 200g). If you cannot reasonably infer ingredients, omit the field.
5. If a modifier option is an ingredient (e.g. 'extra cheese +$1.50'), add inventoryItemName to the option with the ingredient name.`,

  shared_capacity_access: `You are a session-based access configuration parsing expert. Convert unstructured text into a structured JSON array of sessions.
Each session must follow this schema:
{
  "name": string (required, e.g., "Morning Session"),
  "startTime": string (required, "HH:MM" 24hr format),
  "endTime": string (required, "HH:MM" 24hr format),
  "adultPrice": number (required),
  "childPrice": number (optional),
  "capacity": number (required, max concurrent users),
  "genderRestriction": "mixed" | "male" | "female" (optional, default "mixed"),
  "daysOfWeek": number[] (optional, 0=Sun to 6=Sat, empty means all days),
  "isActive": boolean (default true),
  "memberDiscount": number (optional, percentage 0-100),
  "description": string (optional)
}
Rules:
1. If times are given as ranges like '9am-12pm', convert to 24hr format (09:00-12:00).
2. Prices must be numbers.
3. Gender restriction: use "mixed" unless specified otherwise.
4. Respond ONLY with the JSON array. No preamble or markdown.`,

  time_exclusive_reservation: `You are an accommodation/bookable unit parsing expert. Convert unstructured text into a structured JSON array of bookable units.
Each unit must follow this schema:
{
  "name": string (required, e.g., "Unit A", "Sunset Villa"),
  "description": string (optional),
  "maxGuests": number (required),
  "bedrooms": number (optional),
  "bathrooms": number (optional),
  "basePrice": number (required, price per night),
  "weekendPrice": number (optional, if different from base),
  "weeklyDiscount": number (optional, percentage discount for 7+ nights),
  "amenities": string[] (optional, e.g., ["WiFi", "Pool", "BBQ", "AC"]),
  "policies": {
    "checkInTime": string (optional, "HH:MM"),
    "checkOutTime": string (optional, "HH:MM"),
    "cancellationHours": number (optional, free cancellation window in hours),
    "petFriendly": boolean (optional),
    "smokingAllowed": boolean (optional)
  },
  "addOns": [
    {
      "name": string,
      "price": number,
      "pricingType": "per_night" | "one_time" | "per_person",
      "description": string (optional)
    }
  ] (optional),
  "images": string[] (optional, URLs if provided)
}
Rules:
1. Prices must be numbers.
2. Extract all amenities as a string array.
3. Extract add-on services separately (e.g. 'Airport transfer $50', 'Breakfast $15/person').
4. Extract check-in/check-out times in HH:MM format.
5. If cancellation policy mentions hours/days, extract as cancellationHours (convert days to hours).
6. Respond ONLY with the JSON array. No preamble or markdown.`,

  loyaltyTiers: `You are a loyalty program tier parsing expert. Convert unstructured text into a structured JSON array of loyalty tiers.
Each tier must follow this schema:
{
  "name": string (required, e.g., "Silver", "Gold", "Platinum"),
  "minPoints": number (required, threshold to reach this tier),
  "pointsMultiplier": number (required, e.g., 1.5 means 1.5x points per dollar),
  "color": string (optional, hex color for UI badge),
  "benefits": string[] (optional, e.g., ["Free breakfast", "Late checkout"]),
  "description": string (optional),
  "pointsExpiryDays": number (optional, how long points last at this tier)
}
Rules:
1. Tiers should be ordered from lowest to highest points threshold.
2. Points multiplier is relative to base (1.0 = normal, 1.5 = 50% bonus).
3. Extract benefits as a plain string array.
4. Respond ONLY with the JSON array. No preamble or markdown.`,

  coupons: `You are a coupon/promotion parsing expert. Convert unstructured text into a structured JSON array of coupon definitions.
Each coupon must follow this schema:
{
  "code": string (optional, if omitted will be auto-generated),
  "name": string (required),
  "description": string (optional),
  "discountType": "percentage" | "fixed" (required),
  "discountValue": number (required),
  "minOrderAmount": number (optional),
  "maxDiscountAmount": number (optional, cap for percentage discounts),
  "usageLimit": number (optional, total redemptions allowed),
  "perUserLimit": number (optional, per-customer limit),
  "expiresAt": string (optional, ISO date string),
  "appliesTo": "all" | "<module-slug>" (optional, default "all" — pass the target module's slug or "all" for sitewide)
}
Rules:
1. If a code is given, use it. If not, it will be auto-generated.
2. Discount type must be "percentage" or "fixed".
3. If expiry is mentioned (e.g. 'valid until December', 'expires in 30 days'), convert to a future ISO date.
4. If the coupon applies only to a specific service, set appliesTo accordingly.
5. Respond ONLY with the JSON array. No preamble or markdown.`,

  housekeepingTemplates: `You are a housekeeping task template parsing expert. Convert unstructured text into a structured JSON array of task templates.
Each template must follow this schema:
{
  "title": string (required),
  "description": string (optional),
  "category": "room" | "common_area" | "pool" | "kitchen" | "other" (optional),
  "priority": "low" | "medium" | "high" | "urgent" (optional, default "medium"),
  "estimatedMinutes": number (optional),
  "checklist": string[] (optional, ordered list of subtasks),
  "requiredSupplies": [
    {
      "name": string,
      "quantity": number,
      "unit": string
    }
  ] (optional),
  "assignableRoles": string[] (optional, which staff roles can be assigned)
}
Rules:
1. Each template is a type of cleaning or maintenance job.
2. Extract a checklist of steps if detailed instructions are given.
3. Extract required supplies (cleaning products, linens, etc.) with quantities.
4. Category must be one of: room, common_area, pool, kitchen, other.
5. Priority must be one of: low, medium, high, urgent.
6. Respond ONLY with the JSON array. No preamble or markdown.`
};
