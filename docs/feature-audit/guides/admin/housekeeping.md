# Admin Guide: Housekeeping

> Module: ADM-HSK | Features: 14 | Role: super_admin | Updated: 2026-02-08

## Overview

The Housekeeping module manages all resort cleaning and maintenance task workflows. Administrators create tasks, assign them to staff, track completion status, monitor room/chalet readiness, set up recurring schedules, and manage cleaning supply inventory. Real-time status updates via Socket.IO ensure the front desk always has an accurate view of room availability.

Data is stored in Supabase PostgreSQL tables: `housekeeping_tasks`, `housekeeping_assignments`, `housekeeping_recurring`, `room_status`, `housekeeping_supplies`, and `housekeeping_reports`. The Express.js backend (localhost:3005) provides APIs under `/api/admin/housekeeping/*`. Socket.IO broadcasts task status changes and room readiness in real-time.

## Prerequisites

| Requirement | Details |
|---|---|
| Admin Access | Login at `/admin/login` with `admin@v2resort.com` / `admin123` |
| Role Required | `super_admin`, `admin`, or `manager` |
| Browser | Chrome 90+, Firefox 88+, Edge 90+ |
| Backend Running | Express.js API on `localhost:3005` |
| Frontend Running | Next.js 14 dev server on `localhost:3000` |
| Database | Supabase PostgreSQL with housekeeping tables and rooms/chalets seeded |
| Socket.IO | WebSocket connection for real-time task/room status updates |

## Features Covered

| # | Feature ID | Feature Name | Description | Status |
|---|---|---|---|---|
| 1 | HSK-001 | Task List View | Paginated list of all housekeeping tasks with filters | ✅ Implemented |
| 2 | HSK-002 | Create Task | Create new task with room, type, description, priority | ✅ Implemented |
| 3 | HSK-003 | Edit Task | Update task details, priority, or notes | ✅ Implemented |
| 4 | HSK-004 | Delete Task | Remove task (blocked if in-progress) | ✅ Implemented |
| 5 | HSK-005 | Assign to Staff | Assign task to one or more housekeeping staff members | ✅ Implemented |
| 6 | HSK-006 | Task Status Tracking | Update status: pending → assigned → in_progress → completed → verified | ✅ Implemented |
| 7 | HSK-007 | Priority Levels | Set priority: low, medium, high, urgent (affects sort order) | ✅ Implemented |
| 8 | HSK-008 | Room/Chalet Status Board | Visual board showing all rooms with cleaning status | ✅ Implemented |
| 9 | HSK-009 | Recurring Tasks | Configure tasks that auto-create on a schedule (daily/weekly) | ✅ Implemented |
| 10 | HSK-010 | Completed Task History | View completed tasks with duration and staff performance | ✅ Implemented |
| 11 | HSK-011 | Housekeeping Reports | Turnaround time, staff productivity, task completion rates | ✅ Implemented |
| 12 | HSK-012 | Supply Tracking | Track cleaning supply usage and request restocking | ✅ Implemented |
| 13 | HSK-013 | Task Notes & Photos | Staff can add notes and photos to tasks for documentation | ✅ Implemented |
| 14 | HSK-014 | Inspection Checklist | Room inspection checklist items to verify before marking done | ✅ Implemented |

## Dashboard Overview

**URL:** `http://localhost:3000/admin/housekeeping`

**API Base:** `http://localhost:3005/api/admin/housekeeping`

### Key Metrics (Top Cards)

| Metric | Description | API Endpoint |
|---|---|---|
| Pending Tasks | Tasks with `status = 'pending'` or `'assigned'` | `GET /api/admin/housekeeping/stats` |
| In Progress | Tasks currently being worked on | `GET /api/admin/housekeeping/stats` |
| Completed Today | Tasks completed in current day | `GET /api/admin/housekeeping/stats` |
| Rooms Ready | Rooms/chalets with `status = 'clean'` | `GET /api/admin/housekeeping/stats` |
| Avg Turnaround | Average task completion time (minutes) today | `GET /api/admin/housekeeping/stats` |

### Quick Actions

- **+ Create Task** → Opens create task form
- **Room Board** → Opens visual room status board
- **View Schedule** → Shows recurring task calendar
- **Staff Overview** → Shows staff workload distribution

## CRUD Operations

### Tasks

#### Create Task

**URL:** `/admin/housekeeping/tasks/create`

**API:** `POST /api/admin/housekeeping/tasks`

**Steps:**
1. Click **+ Create Task** from the housekeeping dashboard
2. Fill in the task form:

| Field | Type | Validation | Required |
|---|---|---|---|
| `title` | Text input | 1–100 characters | ✅ |
| `task_type` | Select dropdown | Checkout Clean, Turnover, Deep Clean, Maintenance, Inspection, Laundry, Amenity Restock | ✅ |
| `room_id` | Searchable select | Must be an existing room/chalet in the system | ✅ |
| `priority` | Select dropdown | Low, Medium, High, Urgent | ✅ |
| `description` | Textarea | Max 500 characters, specific instructions | ❌ |
| `due_date` | Date picker | Must be today or future | ✅ |
| `due_time` | Time picker | HH:MM format | ❌ |
| `estimated_duration` | Number input | Minutes, integer 5–480 | ❌ |
| `assigned_to` | Multi-select | Housekeeping staff members (from users with `role = 'staff'` and `department = 'housekeeping'`) | ❌ |
| `checklist_template` | Select | Standard Room, Deep Clean, Checkout, VIP Turnover | ❌ |

3. Click **Create Task**
4. On success: toast "Task created", task appears in list
5. If `assigned_to` is set, assigned staff receive push notification and task status = `assigned`
6. Room status automatically updates to `cleaning_scheduled`

**Request Body Example:**
```json
{
  "title": "Checkout Clean - Room 204",
  "task_type": "Checkout Clean",
  "room_id": "room_204",
  "priority": "high",
  "description": "Guest checked out at 10am. Extra towels needed. Check minibar.",
  "due_date": "2026-02-08",
  "due_time": "14:00",
  "estimated_duration": 45,
  "assigned_to": ["user_staff_001", "user_staff_002"],
  "checklist_template": "Checkout"
}
```

#### Read / List Tasks

**URL:** `/admin/housekeeping`

**API:** `GET /api/admin/housekeeping/tasks?page=1&limit=25&status=&priority=&assigned_to=&room=&date=&sort=due_date&order=asc`

**Table Columns:**
| Column | Sortable | Description |
|---|---|---|
| Task ID | ✅ | Auto-generated task reference (HSK-NNNN) |
| Title | ✅ | Task title |
| Room | ✅ | Room/chalet number or name |
| Type | ✅ | Task type badge (color-coded) |
| Priority | ✅ | Low (grey), Medium (blue), High (orange), Urgent (red) |
| Assigned To | — | Staff name(s) or "Unassigned" |
| Status | ✅ | Pending / Assigned / In Progress / Completed / Verified |
| Due | ✅ | Due date and time |
| Duration | — | Estimated vs actual time |
| Actions | — | Edit / Assign / Status Change / Delete |

**Filters:**
- **Status:** All / Pending / Assigned / In Progress / Completed / Verified
- **Priority:** All / Low / Medium / High / Urgent
- **Staff:** All / Specific staff member
- **Room:** Search by room number
- **Date:** Date range picker

#### Update Task

**API:** `PUT /api/admin/housekeeping/tasks/:id`

1. Click **Edit** on task row
2. All fields editable except `task_id`
3. Changing `assigned_to` triggers notification to new assignee and revokes from removed assignee
4. Changing `priority` to Urgent triggers immediate push notification to assignee
5. Click **Save Changes**

#### Delete Task

**API:** `DELETE /api/admin/housekeeping/tasks/:id`

1. Click **Delete** on task row
2. If `status = 'in_progress'` → error "Cannot delete task in progress. Change status first."
3. Confirmation: "Delete task {HSK-NNNN}? This cannot be undone."
4. Click **Confirm Delete**
5. Associated checklist items and notes are also deleted
6. Room status reverts if no other tasks are pending for it

### Task Assignment

**API:** `POST /api/admin/housekeeping/tasks/:id/assign`

1. On task row, click **Assign** (person icon)
2. Modal shows available staff with current workload:

| Staff Member | Current Tasks | Completed Today | Availability |
|---|---|---|---|
| Maria Garcia | 2 active | 5 completed | Available |
| James Wilson | 3 active | 3 completed | Busy |
| Anna Brown | 0 active | 4 completed | Available |

3. Select one or more staff members
4. Click **Assign**
5. Staff receive push notification: "New task assigned: {title} - Room {room}"
6. Task status changes from `pending` to `assigned`

### Task Status Flow

```
pending → assigned → in_progress → completed → verified
                  ↘ blocked (waiting for supplies/maintenance)
```

| Status Transition | Who Can Trigger | Notes |
|---|---|---|
| pending → assigned | Admin, Manager | Auto-set when staff assigned |
| assigned → in_progress | Staff (via mobile), Admin | Staff clicks "Start" on their mobile device |
| in_progress → completed | Staff (via mobile), Admin | Must complete checklist items first |
| completed → verified | Manager, Admin | Manager validates quality after completion |
| Any → blocked | Staff, Admin | Sets `blocked_reason` field; unblocks to previous status |

### Room/Chalet Status Board

**URL:** `/admin/housekeeping/board`

**API:** `GET /api/admin/housekeeping/rooms/status`

Visual grid displaying all rooms/chalets with real-time status:

| Color | Status | Description |
|---|---|---|
| 🟢 Green | Clean | Room is clean and ready for guests |
| 🔴 Red | Dirty | Room needs cleaning (checkout or occupied) |
| 🟡 Yellow | Cleaning In Progress | Staff currently cleaning |
| 🔵 Blue | Cleaning Scheduled | Task created but not yet started |
| ⚪ Grey | Maintenance | Room out of service |
| 🟣 Purple | Inspecting | Manager inspection in progress |

**Actions from board:**
- Click room tile → View task details, create new task, change status
- Drag room to different status column (Kanban mode)
- Filter by floor, zone, or building

### Recurring Tasks

**URL:** `/admin/housekeeping/recurring`

**API:** `POST /api/admin/housekeeping/recurring`

| Field | Type | Validation | Required |
|---|---|---|---|
| `title` | Text input | 1–100 characters | ✅ |
| `task_type` | Select | Same options as regular task | ✅ |
| `rooms` | Multi-select | One or more rooms/chalets, or "All Rooms" | ✅ |
| `frequency` | Select | Daily, Weekdays Only, Weekly, Bi-Weekly, Monthly | ✅ |
| `time` | Time picker | HH:MM — when to create the task each cycle | ✅ |
| `assigned_to` | Multi-select | Staff member(s) or "Auto-Assign" (round-robin) | ❌ |
| `priority` | Select | Low, Medium, High | ✅ |
| `checklist_template` | Select | Template to attach to generated tasks | ❌ |
| `is_active` | Toggle | Enable/disable without deleting | ✅ |

**Auto-Assign Logic:** When "Auto-Assign" is selected, the system distributes tasks round-robin based on staff availability and current workload.

### Supply Tracking

**URL:** `/admin/housekeeping/supplies`

**API:** `GET /api/admin/housekeeping/supplies`

1. View housekeeping-specific supplies (links to Inventory Management module):
   - Cleaning chemicals, cloths, mops, vacuum bags, toiletries, linens
2. **Log Usage:** Staff record supply usage per task (e.g., "2× towel sets, 1× cleaning spray")
3. **Request Restock:** Generate restock request → creates line item in Inventory module
4. **Supply allocation:** Assign supply carts to floors/zones

## Configuration Settings

| Setting | Location | Default | Description |
|---|---|---|---|
| `housekeeping.default_priority` | `/admin/housekeeping/settings` | `medium` | Default priority for new tasks |
| `housekeeping.auto_create_checkout_tasks` | `/admin/housekeeping/settings` | `true` | Auto-create clean task on guest checkout |
| `housekeeping.checkout_task_due_hours` | `/admin/housekeeping/settings` | `2` | Hours after checkout for task due time |
| `housekeeping.require_inspection` | `/admin/housekeeping/settings` | `true` | Require manager verification before marking room clean |
| `housekeeping.recurring_generate_time` | `/admin/housekeeping/settings` | `06:00` | Time of day to generate recurring tasks |
| `housekeeping.notification_on_assign` | `/admin/housekeeping/settings` | `true` | Push notifications on task assignment |
| `housekeeping.notification_on_complete` | `/admin/housekeeping/settings` | `true` | Notify manager when task completed |
| `housekeeping.max_tasks_per_staff` | `/admin/housekeeping/settings` | `8` | Max concurrent tasks per staff member |

## Common Issues & Troubleshooting

| Issue | Cause | Resolution |
|---|---|---|
| Room board not updating in real-time | Socket.IO disconnected | Refresh page; check WebSocket connection in browser dev tools |
| "Cannot delete task" error | Task has status `in_progress` | Change task status to `pending` or `completed` first, then delete |
| Recurring tasks not generating | `is_active` is `false` or generation time hasn't passed | Verify recurring task is active; tasks generate at configured time (default 06:00) |
| Staff not receiving notifications | Push notifications disabled for user | Check user notification preferences; verify push subscription is active |
| Task assigned but staff can't see it | Staff user doesn't have `housekeeping` department tag | Edit user → set department to `housekeeping` in User Management |
| Room shows "Clean" but task is pending | Status manually overridden or task for different room | Check task's `room_id` matches; use room board to correct status |
| Checklist items not appearing | No checklist template assigned to task | Edit task → select appropriate checklist template → Save |
| "Max tasks exceeded" on assignment | Staff already has 8+ active tasks (default limit) | Complete existing tasks, or increase `max_tasks_per_staff` in settings |
| Supply restock not creating PO | Inventory module not linked | Verify inventory integration is active; check API connection |
| Inspection failed but room marked clean | `require_inspection` setting is `false` | Enable in Settings → Require Inspection toggle |

## Security & Permissions

| Action | super_admin | admin | manager | staff | customer |
|---|---|---|---|---|---|
| View task list | ✅ | ✅ | ✅ | ✅ (own only) | ❌ |
| Create tasks | ✅ | ✅ | ✅ | ❌ | ❌ |
| Edit tasks | ✅ | ✅ | ✅ | ❌ | ❌ |
| Delete tasks | ✅ | ✅ | ❌ | ❌ | ❌ |
| Assign staff | ✅ | ✅ | ✅ | ❌ | ❌ |
| Update task status | ✅ | ✅ | ✅ | ✅ (own tasks) | ❌ |
| Verify/inspect | ✅ | ✅ | ✅ | ❌ | ❌ |
| View room board | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage recurring | ✅ | ✅ | ✅ | ❌ | ❌ |
| View reports | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage supplies | ✅ | ✅ | ✅ | ✅ (log usage) | ❌ |
| Change settings | ✅ | ✅ | ❌ | ❌ | ❌ |

## Related Modules

| Module | Relationship | Link |
|---|---|---|
| User Management | Staff assignment requires user accounts with housekeeping role | [user-management.md](./user-management.md) |
| Inventory Management | Cleaning supplies tracked in inventory; restock requests create POs | [inventory-management.md](./inventory-management.md) |
| Restaurant Management | Room service orders may trigger housekeeping follow-up task | [restaurant-management.md](./restaurant-management.md) |
| Bookings | Guest checkout triggers automatic housekeeping task creation | System bookings module |
| Chalets | Chalet units appear on room board; linked by `room_id` | System chalets module |
| Notifications | Task assignments and completions trigger notifications | System notifications module |

## Feature Coverage Summary

| Category | Total Features | Implemented | Partial | Not Started |
|---|---|---|---|---|
| Task CRUD | 4 | 4 | 0 | 0 |
| Assignment & Status | 3 | 3 | 0 | 0 |
| Room Board | 1 | 1 | 0 | 0 |
| Recurring Tasks | 1 | 1 | 0 | 0 |
| History & Reporting | 2 | 2 | 0 | 0 |
| Supply Management | 1 | 1 | 0 | 0 |
| Documentation | 2 | 2 | 0 | 0 |
| **Total** | **14** | **14** | **0** | **0** |
