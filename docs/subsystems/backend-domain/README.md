# Backend Domain Subsystem (`backend/src/lib`)

## 🎯 Purpose
The **Backend Domain Subsystem** implements the core business logic of the resort using **Domain-Driven Design (DDD)** principles. It separates the business rules (Services) from data access (Repositories), allowing for testability and flexibility.

## 📦 Scope
### Explicitly Owns:
*   **Business Logic**: Reservations, Pricing, Inventory Management, Check-in/out rules.
*   **Data Access Abstraction**: Repository interfaces for all entities (`BookingRepository`, `GuestRepository`).
*   **Domain Entities**: Typed interfaces defining the shape of data.

### Does NOT Own:
*   **HTTP Layer**: Controllers are consumers of this layer, not part of it.
*   **Infrastructure**: It uses `EmailService` but does not implement SMTP protocols.

## 🏗️ Internal Architecture

### 1. Service Layer (`src/lib/services`)
*   **Pattern**: Dependency Injection (DI) via `container` pattern.
*   **Example**: `BookingService` depends on `ChaletRepository`, `EmailService`, `Logger`.
*   **Responsibility**:
    *   Validation of business invariants (e.g., "Cannot double book a chalet").
    *   Orchestration of side effects (db save -> email send -> socket emit).
    *   Error handling with domain-specific errors (`BookingServiceError`).

### 2. Repository Layer (`src/lib/repositories`)
*   **Pattern**: Repository Pattern.
*   **Implementations**:
    *   `*.repository.ts`: Production implementation (Postgres/Supabase).
    *   `*.repository.memory.ts`: In-Memory implementation for unit tests.
*   **Benefit**: Allows testing business logic without spinning up a real database.

## 🔑 Key Domains

### Booking Domain (`booking.service.ts`)
*   **Core Entity**: `ChaletBooking`.
*   **Complex Logic**:
    *   Overlap detection (`getByDateRange`).
    *   Seasonal pricing calculation.
    *   Add-on management.

### Rate/Price Domain (`rate.service.ts`)
*   **Logic**: Dynamic pricing rules based on seasonality, weekend modifiers, and special events.

## 🔄 Data Flow (Example: Create Booking)
1.  **Controller**: Calls `bookingService.createBooking(input)`.
2.  **Service**:
    *   Checks availability via `chaletRepository.findOverlapping(dates)`.
    *   Calculates total price via `rateService`.
    *   Creates entity object.
    *   Saves via `chaletRepository.create()`.
    *   Sends email via `emailService`.
3.  **Return**: Returns created booking object.

## 🛡️ Security Considerations
*   **Input Validation**: Assumes inputs are structurally valid (Zod done in controller), but validates *semantic* validity (dates, availability).
*   **Authorization**: Service layer generally assumes the caller (Controller) has checked permissions, but some services might check ownership.

## ⚠️ Known Debt / Weaknesses
*   **In-Memory Reliance**: Many tests rely on `*.repository.memory.ts`. We must ensure the production `*.repository.ts` has parity in behavior.
*   **Transaction Boundaries**: Services currently may not support atomic transactions across multiple repositories (unless `Prisma` interactive transactions are passed through).
