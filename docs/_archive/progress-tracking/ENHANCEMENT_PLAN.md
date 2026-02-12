# V2 Resort Major Feature Enhancements Plan

## Part 1: Housekeeping System Enhancements

### Current State
- Basic task management (create, assign, complete tasks)
- Task types with checklists
- Simple scheduling (daily/weekly/checkout patterns)
- Staff can view their tasks
- Admin can view all tasks and stats

### Planned Enhancements

#### 1. Chalet Checkout Integration (Priority: HIGH)
**Purpose:** Auto-create housekeeping tasks when guests check out

**Backend Changes:**
- Create webhook/event listener in `housekeeping.controller.ts`
- Listen to chalet booking status changes
- Auto-create "Checkout Clean" task when booking ends
- Link task to booking for audit trail

**Files to modify:**
- `backend/src/modules/housekeeping/housekeeping.controller.ts` - Add `handleCheckoutEvent()` method
- `backend/src/modules/chalets/chalet.controller.ts` - Emit event on checkout
- Create new `backend/src/modules/housekeeping/housekeeping.events.ts`

**New API Endpoints:**
- `POST /housekeeping/checkout-trigger/:bookingId` - Manual trigger for testing

#### 2. Photo Evidence System (Priority: HIGH)
**Purpose:** Staff uploads before/after photos for quality assurance

**Backend Changes:**
- Add `completion_photos` JSONB column to housekeeping_tasks table
- Create photo upload endpoint with Supabase storage
- Store before/after photo URLs with timestamps

**Files to modify:**
- Create migration `20260119110000_housekeeping_photos.sql`
- `backend/src/modules/housekeeping/housekeeping.controller.ts` - Add `uploadTaskPhoto()` method
- `backend/src/modules/housekeeping/housekeeping.routes.ts` - Add upload route

**Frontend Changes:**
- Add camera icon to task card for staff
- Create photo upload component with preview
- Show photo gallery in task details

**Files to create:**
- `frontend/src/components/housekeeping/PhotoUploader.tsx`
- `frontend/src/components/housekeeping/PhotoGallery.tsx`

#### 3. Real-Time Task Updates (Priority: MEDIUM)
**Purpose:** Live updates when tasks change status

**Backend Changes:**
- Emit socket events on task create/update/complete
- Add `housekeeping:task_updated` event
- Broadcast to relevant staff rooms

**Files to modify:**
- `backend/src/modules/housekeeping/housekeeping.controller.ts` - Emit events
- `backend/src/socket/index.ts` - Handle housekeeping room joins

**Frontend Changes:**
- Subscribe to housekeeping socket events
- Update task lists in real-time
- Show toast notifications for new assignments

#### 4. Mobile-Optimized Staff View (Priority: HIGH)
**Purpose:** Better UX for housekeeping staff on mobile devices

**Frontend Changes:**
- Create dedicated mobile layout for staff housekeeping
- Large touch targets for task actions
- Swipe gestures for status changes
- Offline-capable task list

**Files to create:**
- `frontend/src/app/staff/housekeeping/page.tsx` - Staff-specific view
- `frontend/src/app/staff/housekeeping/[taskId]/page.tsx` - Task detail
- `frontend/src/components/housekeeping/MobileTaskCard.tsx`

#### 5. Inventory Integration (Priority: MEDIUM)
**Purpose:** Track cleaning supplies usage per task

**Backend Changes:**
- Link housekeeping tasks to inventory items
- Auto-deduct supplies on task completion
- Alert when supplies low

**Database Changes:**
- Create `housekeeping_supply_usage` junction table
- Add supply tracking to task completion

#### 6. Performance Analytics (Priority: LOW)
**Purpose:** Track staff efficiency and quality metrics

**Backend Changes:**
- Calculate avg completion time per task type
- Track quality scores based on checklist compliance
- Generate weekly performance reports

**New API Endpoints:**
- `GET /housekeeping/analytics/staff/:staffId`
- `GET /housekeeping/analytics/efficiency`

---

## Part 2: Staff/Manager Dashboard Enhancements

### Current State
- Basic overview with revenue/order stats
- Staff list with activity
- Empty approvals section (no implementation)
- Performance data section (limited)

### Planned Enhancements

#### 1. Approval Workflow System (Priority: HIGH)
**Purpose:** Real approval flow for refunds, discounts, voids

**Database Changes:**
```sql
CREATE TABLE manager_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL, -- 'refund', 'discount', 'void', 'override'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  amount DECIMAL(10,2),
  description TEXT,
  reference_type VARCHAR(50), -- 'order', 'booking', etc.
  reference_id UUID,
  requested_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend Changes:**
- Create `backend/src/modules/manager/approvals.controller.ts`
- Add routes for request/approve/reject approvals
- Send notifications on status change

**Frontend Changes:**
- Real approval cards with action buttons
- Approve/Reject with notes
- History of past approvals

#### 2. Shift Management (Priority: HIGH)
**Purpose:** Schedule and track staff shifts

**Database Changes:**
```sql
CREATE TABLE staff_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID REFERENCES users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  break_minutes INT DEFAULT 0,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'active', 'completed', 'missed'
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend Changes:**
- Create `backend/src/modules/manager/shifts.controller.ts`
- Clock in/out endpoints
- Shift schedule CRUD

**Frontend Changes:**
- Calendar view for shift scheduling
- Staff can view their upcoming shifts
- Clock in/out buttons

#### 3. Task Assignment Dashboard (Priority: MEDIUM)
**Purpose:** Drag-and-drop task assignment interface

**Frontend Changes:**
- Create assignment board with staff columns
- Drag tasks between staff
- Show workload balance indicator
- Filter by task type/priority

**Files to create:**
- `frontend/src/app/staff/manager/assignments/page.tsx`
- `frontend/src/components/manager/AssignmentBoard.tsx`

#### 4. Real-Time Staff Tracking (Priority: MEDIUM)
**Purpose:** See what staff are doing in real-time

**Backend Changes:**
- Track staff location/activity via socket events
- Store last activity timestamps
- Track current page/action

**Frontend Changes:**
- Live staff status indicators
- Activity feed with recent actions
- "Currently working on" display

#### 5. Alert System (Priority: HIGH)
**Purpose:** Proactive notifications for managers

**Types of Alerts:**
- Order delayed > 15 minutes
- Staff idle > 30 minutes
- Inventory low
- High priority task unassigned
- Customer complaint received

**Backend Changes:**
- Create alert generation service
- Store alerts in database
- Push via socket to managers

**Frontend Changes:**
- Alert bell with count badge
- Alert dropdown/panel
- Dismiss/acknowledge actions

---

## Implementation Priority Order

### Phase 1: Core Fixes (Immediate)
1. ✅ Module deletion cascade
2. ✅ Loyalty points auto-award
3. ✅ Footer gift cards link
4. ✅ Live user count fix

### Phase 2: Housekeeping Essentials (Week 1)
1. Checkout integration
2. Photo evidence system
3. Mobile staff view

### Phase 3: Manager Dashboard (Week 2)
1. Approval workflow system
2. Shift management
3. Alert system

### Phase 4: Enhanced Features (Week 3-4)
1. Real-time updates
2. Task assignment board
3. Performance analytics
4. Inventory integration

---

## Database Migrations Needed

1. `20260119110000_housekeeping_photos.sql` - Photo storage
2. `20260119120000_manager_approvals.sql` - Approval workflow
3. `20260119130000_staff_shifts.sql` - Shift management
4. `20260119140000_manager_alerts.sql` - Alert system
