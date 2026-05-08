'use client';

import React from 'react';

interface FloorPlanProps {
  items?: any[];
  onSelect?: (item: any) => void;
  selectedItem?: any;
  engineType?: string;
}

export const FloorPlan: React.FC<FloorPlanProps> = ({
  items = [],
  onSelect,
  selectedItem,
  engineType = 'generic'
}) => {
  const getTitle = () => {
    switch (engineType) {
      case 'instant_transaction': return 'Restaurant Floor Plan';
      case 'shared_capacity_access': return 'Pool Area Layout';
      case 'time_exclusive_reservation': return 'Chalet Layout';
      default: return 'Floor Plan';
    }
  };

  const getItemDisplay = (item: any) => {
    switch (engineType) {
      case 'instant_transaction':
        return {
          identifier: item.table_number || item.number,
          status: item.status
        };
      case 'shared_capacity_access':
        return {
          identifier: item.ticket_number || item.number,
          status: item.status
        };
      case 'time_exclusive_reservation':
        return {
          identifier: item.booking_number || item.number,
          status: item.status
        };
      default:
        return {
          identifier: item.number || item.id,
          status: item.status
        };
    }
  };

  return (
    <div className="floor-plan">
      <div className="floor-plan-container">
        <h3>{getTitle()}</h3>
        <div className="items-grid">
          {items.map((item) => {
            const display = getItemDisplay(item);
            return (
              <div
                key={item.id}
                className={`floor-item ${selectedItem?.id === item.id ? 'selected' : ''} ${display.status}`}
                onClick={() => onSelect?.(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelect?.(item);
                  }
                }}
              >
                <div className="item-identifier">{display.identifier}</div>
                <div className="item-status">{display.status}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
