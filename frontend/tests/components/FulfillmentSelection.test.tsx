import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FulfillmentModeSelector } from '@/components/customer/FulfillmentModeSelector';
import { DestinationRequirementsEditor, type ServiceLocationItem } from '@/components/customer/DestinationRequirementsEditor';
import { CANONICAL_ENGINE_A_CAPABILITIES, type FulfillmentOption, type FulfillmentMode } from '@/lib/engine-a/types';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      selectFulfillmentMode: 'Select Fulfillment Method',
      fulfillmentModeOnPremise: 'On-Premise',
      fulfillmentDescOnPremise: 'Service or pickup at our physical location',
      fulfillmentModePickup: 'Pickup',
      fulfillmentDescPickup: 'Collect your order at the designated counter',
      fulfillmentModeLocalDelivery: 'Local Delivery',
      fulfillmentDescLocalDelivery: 'Delivered directly to your local address',
      fulfillmentModeDigitalDelivery: 'Digital Delivery',
      fulfillmentDescDigitalDelivery: 'Instant digital delivery to your account or email',
      fulfillmentModeShipment: 'Shipment',
      fulfillmentDescShipment: 'Shipped via courier to your destination',
      fulfillmentModeServiceExecution: 'Service Execution',
      fulfillmentDescServiceExecution: 'Executed at designated service station or chair',
      fulfillmentModeNone: 'Direct Settlement (No Fulfillment)',
      fulfillmentDescNone: 'Direct commercial transaction with no physical delivery',
      selectLocationOrTable: 'Select Table / Location',
      occupied: 'Occupied',
      selected: 'Selected',
      available: 'Available',
      pickupNotes: 'Pickup Instructions (Optional)',
      deliveryAddress: 'Delivery Address',
      shippingAddress: 'Shipping Address',
      digitalDeliveryHandle: 'Recipient Email or Digital Account',
      pickupNotesPlaceholder: 'e.g. Will pick up in 20 minutes',
      addressPlaceholder: 'Street address, building/suite, city, postal code, special delivery directions',
      digitalAccountPlaceholder: 'e.g. user@example.com',
      serviceStationPlaceholder: 'e.g. Spa Treatment Room 3, Station B',
      fulfillmentNoneNotice: 'This transaction settles directly with no physical fulfillment required.',
    };
    return translations[key] || '';
  },
}));

describe('FulfillmentModeSelector — Phase F4 Canonical Modes Presentation', () => {
  const allSevenOptions: FulfillmentOption[] = [
    { mode: 'on_premise', destinations: ['on_premise_location'] },
    { mode: 'pickup', destinations: ['pickup_location'] },
    { mode: 'local_delivery', destinations: ['address'] },
    { mode: 'digital_delivery', destinations: ['digital_account'] },
    { mode: 'shipment', destinations: ['address'] },
    { mode: 'service_execution', destinations: ['service_location'] },
    { mode: 'none', destinations: ['none'] },
  ];

  it('renders all 6 selectable fulfillment modes and the 1 non-fulfillment mode (none)', () => {
    const handleSelect = vi.fn();
    render(
      <FulfillmentModeSelector
        options={allSevenOptions}
        selectedMode="on_premise"
        onSelectMode={handleSelect}
      />
    );

    // 6 Selectable modes
    expect(screen.getByTestId('mode-option-on_premise')).toBeDefined();
    expect(screen.getByTestId('mode-option-pickup')).toBeDefined();
    expect(screen.getByTestId('mode-option-local_delivery')).toBeDefined();
    expect(screen.getByTestId('mode-option-digital_delivery')).toBeDefined();
    expect(screen.getByTestId('mode-option-shipment')).toBeDefined();
    expect(screen.getByTestId('mode-option-service_execution')).toBeDefined();

    // 1 Non-fulfillment mode
    expect(screen.getByTestId('mode-option-none')).toBeDefined();
  });

  it('fails closed when options are empty: renders unavailable state and NEVER invents on_premise or pickup', () => {
    const handleSelect = vi.fn();
    render(
      <FulfillmentModeSelector
        options={[]}
        selectedMode={undefined}
        onSelectMode={handleSelect}
      />
    );

    expect(screen.getByTestId('fulfillment-modes-unavailable')).toBeDefined();
    expect(screen.queryByTestId('mode-option-on_premise')).toBeNull();
    expect(screen.queryByTestId('mode-option-pickup')).toBeNull();
  });

  it('renders loading skeleton when loading={true}', () => {
    const handleSelect = vi.fn();
    render(
      <FulfillmentModeSelector
        options={allSevenOptions}
        selectedMode="on_premise"
        onSelectMode={handleSelect}
        loading={true}
      />
    );

    expect(screen.getByTestId('fulfillment-mode-selector-loading')).toBeDefined();
  });

  it('invokes onSelectMode with the canonical mode when clicked', () => {
    const handleSelect = vi.fn();
    render(
      <FulfillmentModeSelector
        options={allSevenOptions}
        selectedMode="on_premise"
        onSelectMode={handleSelect}
      />
    );

    fireEvent.click(screen.getByTestId('mode-option-digital_delivery'));
    expect(handleSelect).toHaveBeenCalledWith('digital_delivery');

    fireEvent.click(screen.getByTestId('mode-option-none'));
    expect(handleSelect).toHaveBeenCalledWith('none');
  });
});

describe('DestinationRequirementsEditor — Phase F4 Destination Semantics', () => {
  it('renders service locations for on_premise mode and enforces occupancy disabled state', () => {
    const handleChange = vi.fn();
    const mockLocations: ServiceLocationItem[] = [
      { id: 'loc-1', name: 'Table 1', is_active: true, is_occupied: false },
      { id: 'loc-2', name: 'Table 2', is_active: true, is_occupied: true },
      { id: 'loc-3', name: 'Table 3', is_active: false }, // inactive
    ];

    render(
      <DestinationRequirementsEditor
        mode="on_premise"
        destinationType="on_premise_location"
        destinationRef="loc-1"
        onChange={handleChange}
        serviceLocations={mockLocations}
      />
    );

    expect(screen.getByTestId('destination-editor-on-premise')).toBeDefined();
    expect(screen.getByTestId('location-option-loc-1')).toBeDefined();
    expect(screen.getByTestId('location-option-loc-2')).toBeDefined();
    expect(screen.queryByTestId('location-option-loc-3')).toBeNull(); // Inactive excluded

    // Table 2 is occupied and disabled
    const occupiedBtn = screen.getByTestId('location-option-loc-2') as HTMLButtonElement;
    expect(occupiedBtn.disabled).toBe(true);

    // Table 1 can be clicked
    const availableBtn = screen.getByTestId('location-option-loc-1') as HTMLButtonElement;
    expect(availableBtn.disabled).toBe(false);
    fireEvent.click(availableBtn);
    expect(handleChange).toHaveBeenCalledWith('on_premise_location', 'loc-1');
  });

  it('fails closed when no service locations are available for on_premise mode (no text input fallback)', () => {
    const handleChange = vi.fn();
    render(
      <DestinationRequirementsEditor
        mode="on_premise"
        destinationType="on_premise_location"
        destinationRef={null}
        onChange={handleChange}
        serviceLocations={[]}
      />
    );

    expect(screen.getByTestId('no-locations-available')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('renders pickup instructions for pickup mode', () => {
    const handleChange = vi.fn();
    render(
      <DestinationRequirementsEditor
        mode="pickup"
        destinationType="pickup_location"
        destinationRef=""
        onChange={handleChange}
      />
    );

    expect(screen.getByTestId('destination-editor-pickup')).toBeDefined();
    const input = screen.getByPlaceholderText(/pick up in 20 minutes/i);
    fireEvent.change(input, { target: { value: 'Ready by 5pm' } });
    expect(handleChange).toHaveBeenCalledWith('pickup_location', 'Ready by 5pm');
  });

  it('renders address requirements for local_delivery and shipment modes', () => {
    const handleChange = vi.fn();
    render(
      <DestinationRequirementsEditor
        mode="local_delivery"
        destinationType="address"
        destinationRef=""
        onChange={handleChange}
      />
    );

    expect(screen.getByTestId('destination-editor-delivery')).toBeDefined();
    const textarea = screen.getByPlaceholderText(/street address/i);
    fireEvent.change(textarea, { target: { value: '123 Palm Grove Ave' } });
    expect(handleChange).toHaveBeenCalledWith('address', '123 Palm Grove Ave');
  });

  it('renders digital account requirement for digital_delivery mode', () => {
    const handleChange = vi.fn();
    render(
      <DestinationRequirementsEditor
        mode="digital_delivery"
        destinationType="digital_account"
        destinationRef=""
        onChange={handleChange}
      />
    );

    expect(screen.getByTestId('destination-editor-digital')).toBeDefined();
    const input = screen.getByPlaceholderText(/user@example.com/i);
    fireEvent.change(input, { target: { value: 'alessandro@example.com' } });
    expect(handleChange).toHaveBeenCalledWith('digital_account', 'alessandro@example.com');
  });

  it('renders service station requirement for service_execution mode', () => {
    const handleChange = vi.fn();
    render(
      <DestinationRequirementsEditor
        mode="service_execution"
        destinationType="service_location"
        destinationRef=""
        onChange={handleChange}
      />
    );

    expect(screen.getByTestId('destination-editor-service')).toBeDefined();
    const input = screen.getByPlaceholderText(/spa treatment room/i);
    fireEvent.change(input, { target: { value: 'Room 102' } });
    expect(handleChange).toHaveBeenCalledWith('service_location', 'Room 102');
  });

  it('renders direct settlement notice for none mode with no destination input required', () => {
    const handleChange = vi.fn();
    render(
      <DestinationRequirementsEditor
        mode="none"
        destinationType="none"
        destinationRef={null}
        onChange={handleChange}
      />
    );

    expect(screen.getByText(/no physical fulfillment required/i)).toBeDefined();
  });
});
