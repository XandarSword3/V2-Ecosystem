'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Users,
  Clock,
  Check,
  X,
  Utensils,
  Sparkles,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/Tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/ContextMenu';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';

interface TablePosition {
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  shape: 'rectangle' | 'circle' | 'square';
}

interface Table {
  id: string;
  number: number;
  name: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'OUT_OF_SERVICE';
  position: TablePosition;
  section: string;
  features: string[];
  currentReservation?: {
    guestName: string;
    partySize: number;
    time: string;
  };
}

interface FloorPlanProps {
  onTableSelect?: (table: Table) => void;
  selectedTableId?: string;
  isEditable?: boolean;
}

const STATUS_COLORS = {
  AVAILABLE: 'bg-green-500 hover:bg-green-600',
  OCCUPIED: 'bg-red-500 hover:bg-red-600',
  RESERVED: 'bg-yellow-500 hover:bg-yellow-600',
  CLEANING: 'bg-blue-500 hover:bg-blue-600',
  OUT_OF_SERVICE: 'bg-gray-500',
};

const STATUS_LABELS = {
  AVAILABLE: 'Available',
  OCCUPIED: 'Occupied',
  RESERVED: 'Reserved',
  CLEANING: 'Cleaning',
  OUT_OF_SERVICE: 'Out of Service',
};

export function RestaurantFloorPlan({
  onTableSelect,
  selectedTableId,
  isEditable = false,
}: FloorPlanProps) {
  const t = useTranslations('restaurant');
  const socket = useSocket();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tables, setTables] = useState<Table[]>([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [sections, setSections] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string | 'all'>('all');
  
  // Dragging state for editable mode
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Fetch floor plan data
  const fetchFloorPlan = useCallback(async () => {
    try {
      const response = await api.get('/restaurant/floor-plan');
      const { tables: fetchedTables, sections: fetchedSections, dimensions: dims } = response.data.data;
      
      setTables(fetchedTables);
      setSections(fetchedSections);
      setDimensions(dims);
    } catch (error) {
      console.error('Failed to fetch floor plan:', error);
      toast.error('Failed to load floor plan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFloorPlan();
  }, [fetchFloorPlan]);

  // Socket listeners for real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleTableStatusChanged = (data: { tableId: string; status: string }) => {
      setTables(prev =>
        prev.map(table =>
          table.id === data.tableId
            ? { ...table, status: data.status as Table['status'] }
            : table
        )
      );
    };

    const handleTablePositionUpdated = (data: { tableId: string; position: TablePosition }) => {
      setTables(prev =>
        prev.map(table =>
          table.id === data.tableId
            ? { ...table, position: data.position }
            : table
        )
      );
    };

    socket.on('table-status-changed', handleTableStatusChanged);
    socket.on('table-position-updated', handleTablePositionUpdated);

    return () => {
      socket.off('table-status-changed', handleTableStatusChanged);
      socket.off('table-position-updated', handleTablePositionUpdated);
    };
  }, [socket]);

  // Handle table status change
  const handleStatusChange = async (tableId: string, newStatus: string) => {
    try {
      await api.put(`/restaurant/tables/${tableId}/status`, { status: newStatus });
      toast.success('Table status updated');
    } catch (error) {
      toast.error('Failed to update table status');
    }
  };

  // Handle dragging in edit mode
  const handleMouseDown = (e: React.MouseEvent, table: Table) => {
    if (!isEditable) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDraggingTable(table.id);
    setDragOffset({
      x: e.clientX - rect.left - table.position.x,
      y: e.clientY - rect.top - table.position.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingTable || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const newX = Math.max(0, Math.min(dimensions.width - 50, e.clientX - rect.left - dragOffset.x));
    const newY = Math.max(0, Math.min(dimensions.height - 50, e.clientY - rect.top - dragOffset.y));

    setTables(prev =>
      prev.map(table =>
        table.id === draggingTable
          ? { ...table, position: { ...table.position, x: newX, y: newY } }
          : table
      )
    );
  };

  const handleMouseUp = async () => {
    if (!draggingTable) return;

    const table = tables.find(t => t.id === draggingTable);
    if (table) {
      try {
        await api.put(`/restaurant/tables/${draggingTable}/position`, {
          position: table.position,
        });
      } catch (error) {
        toast.error('Failed to save table position');
        fetchFloorPlan(); // Revert
      }
    }

    setDraggingTable(null);
  };

  // Filter tables by section
  const filteredTables = activeSection === 'all'
    ? tables
    : tables.filter(t => t.section === activeSection);

  // Render table shape
  const renderTableShape = (table: Table) => {
    const { position, status } = table;
    const isSelected = selectedTableId === table.id;
    const baseClasses = cn(
      'absolute cursor-pointer transition-all duration-200',
      STATUS_COLORS[status],
      isSelected && 'ring-4 ring-primary ring-offset-2',
      isEditable && 'cursor-move'
    );

    const style: React.CSSProperties = {
      left: position.x,
      top: position.y,
      width: position.width,
      height: position.height,
      transform: `rotate(${position.rotation}deg)`,
    };

    if (position.shape === 'circle') {
      return (
        <div
          className={cn(baseClasses, 'rounded-full')}
          style={style}
        />
      );
    }

    return (
      <div
        className={cn(
          baseClasses,
          position.shape === 'square' ? 'rounded-lg' : 'rounded-lg'
        )}
        style={style}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section filters */}
      <div className="flex items-center gap-2">
        <Button
          variant={activeSection === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveSection('all')}
        >
          All
        </Button>
        {sections.map(section => (
          <Button
            key={section}
            variant={activeSection === section ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection(section)}
          >
            {section}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Reserved</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Cleaning</span>
          </div>
        </div>
      </div>

      {/* Floor plan */}
      <div
        ref={containerRef}
        className="relative bg-muted/50 rounded-lg border overflow-hidden"
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <TooltipProvider>
          {filteredTables.map(table => (
            <ContextMenu key={table.id}>
              <ContextMenuTrigger>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onMouseDown={(e) => handleMouseDown(e, table)}
                      onClick={() => !isEditable && onTableSelect?.(table)}
                    >
                      {renderTableShape(table)}
                      {/* Table label */}
                      <div
                        className="absolute flex flex-col items-center justify-center text-white text-xs font-medium pointer-events-none"
                        style={{
                          left: table.position.x,
                          top: table.position.y,
                          width: table.position.width,
                          height: table.position.height,
                        }}
                      >
                        <span>{table.number}</span>
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {table.capacity}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      <p className="font-medium">{table.name}</p>
                      <p className="text-xs">Capacity: {table.capacity}</p>
                      <p className="text-xs">Status: {STATUS_LABELS[table.status]}</p>
                      {table.currentReservation && (
                        <div className="text-xs border-t pt-1 mt-1">
                          <p>{table.currentReservation.guestName}</p>
                          <p>{table.currentReservation.time} - {table.currentReservation.partySize} guests</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => handleStatusChange(table.id, 'AVAILABLE')}
                  disabled={table.status === 'AVAILABLE'}
                >
                  <Check className="mr-2 h-4 w-4 text-green-500" />
                  Mark Available
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => handleStatusChange(table.id, 'OCCUPIED')}
                  disabled={table.status === 'OCCUPIED'}
                >
                  <Utensils className="mr-2 h-4 w-4 text-red-500" />
                  Mark Occupied
                </ContextMenuItem>
                <ContextMenuItem
                  onClick={() => handleStatusChange(table.id, 'CLEANING')}
                  disabled={table.status === 'CLEANING'}
                >
                  <Sparkles className="mr-2 h-4 w-4 text-blue-500" />
                  Mark Cleaning
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => handleStatusChange(table.id, 'OUT_OF_SERVICE')}
                  disabled={table.status === 'OUT_OF_SERVICE'}
                >
                  <AlertCircle className="mr-2 h-4 w-4 text-gray-500" />
                  Mark Out of Service
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
}

export default RestaurantFloorPlan;
