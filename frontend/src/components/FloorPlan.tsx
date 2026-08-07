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
      case 'instant_transaction': return 'Floor Plan';
      case 'shared_capacity_access': return 'Capacity Area Layout';
      case 'time_exclusive_reservation': return 'Accommodation Layout';
      default: return 'Floor Plan';
    }
  };

  const getItemDisplay = (item: any) => {
    switch (engineType) {
      case 'instant_transaction':
        return {
          identifier: item.name || item.table_number || item.number,
          status: item.status || 'unknown'
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
          identifier: item.name || item.number || item.id,
          status: item.status || 'unknown'
        };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'free':
        return 'bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300';
      case 'occupied':
        return 'bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300';
      case 'reserved':
        return 'bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300';
      case 'inactive':
        return 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300';
    }
  };

  return (
    <div className="floor-plan">
      <div className="floor-plan-container">
        <h3 className="text-lg font-semibold mb-4">{getTitle()}</h3>
        <div className="items-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item) => {
            const display = getItemDisplay(item);
            const statusColor = getStatusColor(display.status);
            return (
              <div
                key={item.id}
                className={`floor-item rounded-lg border-2 p-4 cursor-pointer transition-all hover:shadow-md ${statusColor} ${selectedItem?.id === item.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                onClick={() => onSelect?.(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelect?.(item);
                  }
                }}
              >
                <div className="item-identifier font-bold text-lg">{display.identifier}</div>
                <div className="item-status text-xs capitalize mt-1 opacity-75">{display.status}</div>
                {item.assigned_staff_id && (
                  <div className="text-xs mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>Staffed</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
