# V2 Resort - Proof of Functionality Questionnaire

## Document Purpose

This questionnaire demands **concrete evidence** that features actually work, not just that code exists. For each question, provide:

- ✅ **Test results** (passing tests, screenshots, logs)
- ✅ **Actual runtime behavior** (API responses, database records)
- ✅ **Integration proof** (Stripe events, webhook calls, email delivery)
- ✅ **Error handling proof** (what happens when things fail)
- ✅ **Performance proof** (load test results, response times)

**Instructions for GitHub Copilot:**
- Don't just show code - show **evidence it works**
- If tests exist, show **test output** (pass/fail results)
- If no tests exist, **explicitly state "NO TESTS FOUND"**
- Show **actual database records** created by the code
- Show **actual API responses** from running endpoints
- Show **actual error messages** from failure scenarios
- Provide **file paths to test files** that prove functionality
- Show **CI/CD pipeline results** if available

---

## Section 1: Transaction System - Proof Required (40 Questions)

### 1.1 Basic Transaction Functionality

**Q1.** Is there a **passing test** that verifies database transactions work correctly?
- If YES: Show the test file path and test output
- If NO: State "NO TRANSACTION TESTS FOUND"

**Q2.** Show the **actual test code** that verifies rollback on failure.
- What is the test file path?
- Does the test actually run? Show `npm test` output for this specific test.

**Q3.** Show a **test that proves** payment succeeds but order creation fails, and payment is rolled back.
- File path to test
- Test output showing the rollback happened
- Database state before and after the test

**Q4.** Is there a test that creates 100 orders simultaneously and verifies no data corruption?
- File path to test
- Test output (pass/fail)
- How long does it take to run?

**Q5.** Show the **actual database logs** from a failed transaction that was rolled back.
- What does the log look like?
- Where are these logs stored?
- Can you show a real example?

### 1.2 Order Creation Flow - Real Evidence

**Q6.** Run the order creation API endpoint and show the **actual response**.
- Endpoint: `POST /api/restaurant/orders`
- Show the curl command
- Show the exact JSON response
- Show the database record created

**Q7.** What happens when you create an order with invalid data?
- Show the actual error response
- What HTTP status code is returned?
- Show a real example curl command and response

**Q8.** Create an order, then **show the actual database records** created:
- The order record (full JSON)
- The order_items records
- The payment record
- The inventory_movements records
- Show the SQL query to retrieve these

**Q9.** Is there a test that verifies order creation creates ALL required records?
- Test file path
- Test output
- What assertions does it make?

**Q10.** Show proof that if `order_items` insert fails, the `order` record is deleted.
- Test file path
- Test code
- Test output showing rollback

### 1.3 Payment Integration - Real Proof

**Q11.** Is there a **passing test** for Stripe webhook handling?
- Test file path
- Test output
- Does it use Stripe test mode or mocks?

**Q12.** Show the **actual webhook payload** that Stripe sends.
- Real example JSON
- How is this tested? (Stripe CLI? Mock?)

**Q13.** When a payment_intent.succeeded webhook arrives, show the **database changes**:
- What query updates the order?
- Show the SQL UPDATE statement
- Show before/after database records

**Q14.** Is there a test that simulates webhook arriving twice (idempotency)?
- Test file path
- Test output
- What happens the second time?

**Q15.** Show proof that webhook signature validation works:
- Test file with invalid signature
- Expected error message
- Actual test output

**Q16.** Is Stripe configured in test mode?
- Show the environment variable value (redacted)
- How do you verify test vs live mode?
- Show code that checks this

**Q17.** Show a **real Stripe payment** that was created:
- Payment Intent ID
- Amount
- Status
- Metadata (if any)

**Q18.** Is there a test for payment refunds?
- Test file path
- Test output
- Show the refund flow

**Q19.** Show proof that refunding a payment updates the order status:
- Test code
- Database state before refund
- Database state after refund

**Q20.** Is there a test for partial refunds?
- Test file path
- What scenarios does it cover?

### 1.4 Supabase Client vs node-postgres

**Q21.** Show the **package.json dependencies** section.
- Is `pg` (node-postgres) installed?
- Is `@supabase/supabase-js` installed?
- What versions?

**Q22.** Search the codebase for `BEGIN`, `COMMIT`, `ROLLBACK` - are these keywords used anywhere?
- Provide grep results
- File paths where found
- Context of usage

**Q23.** Show the **actual database connection pool configuration**.
- File path
- Full configuration object
- Max connections setting

**Q24.** Is there monitoring for database connection pool exhaustion?
- What happens when pool is full?
- Show error handling code
- Any alerts configured?

**Q25.** Show a **real database error log** from production or testing.
- What does it look like?
- Where is it stored?
- Show an example

### 1.5 Error Handling - Proof of Resilience

**Q26.** Is there a test that simulates database connection loss during order creation?
- Test file path
- How is connection loss simulated?
- What is the expected behavior?

**Q27.** Show proof that duplicate order creation is prevented:
- Test file path
- What constraint prevents duplicates?
- Show the database error when duplicate attempted

**Q28.** Is there a test for concurrent order creation from the same user?
- Test file path
- How many concurrent requests?
- What prevents conflicts?

**Q29.** Show the **actual error response** when creating an order fails:
- HTTP status code
- Error JSON structure
- Is the error message user-friendly?

**Q30.** Is there request ID tracking across logs?
- Show code that generates request IDs
- Show example log entries with same request ID
- How are they used for debugging?

### 1.6 Logging - Real Evidence

**Q31.** Show the **actual log file** or log output from a successful order creation.
- Full log entry
- What information is captured?
- Timestamp format?

**Q32.** Show logs from a **failed** order creation.
- What error details are logged?
- Stack trace included?
- Sensitive data redacted?

**Q33.** Is there a log aggregation service configured?
- What service? (CloudWatch, DataDog, etc.)
- Show configuration
- Can you query logs?

**Q34.** Show proof that errors are logged with full context:
- User ID
- Request ID
- Timestamp
- Error stack trace
- Database query that failed

**Q35.** Is there alerting configured for critical errors?
- What triggers an alert?
- Who receives alerts?
- Show configuration

### 1.7 Migration System

**Q36.** List **all migration files** in the project.
- Full file paths
- Naming convention
- Are they numbered/timestamped?

**Q37.** Show the **most recent migration**.
- File path
- Full SQL content
- When was it created?

**Q38.** Is there a migration that adds database constraints?
- File path
- What constraints?
- Show the SQL

**Q39.** Show proof that migrations run successfully:
- Migration table name
- Query to see applied migrations
- Show the results

**Q40.** Is there a rollback migration for the most recent change?
- File path
- SQL to reverse changes
- Has it been tested?

---

## Section 2: Race Conditions & Concurrency - Proof Required (50 Questions)

### 2.1 Inventory Race Conditions

**Q41.** Is there a **load test** that proves no race conditions in inventory?
- Test file path
- How many concurrent requests?
- Test results (pass/fail)

**Q42.** Show the **actual SQL query** that deducts inventory:
- Full query text
- Is it atomic? (uses `stock = stock - 1`?)
- File path where this query is defined

**Q43.** Create a test: 10 users buy the last item simultaneously. Show results:
- Test code
- Expected behavior: Only 1 succeeds, 9 get "out of stock"
- Actual results from running the test
- Database stock level after test

**Q44.** Is there a database constraint preventing negative stock?
- Show the constraint SQL
- What happens when violated?
- Show an example error

**Q45.** Show proof that stock levels never go negative:
- Test file path
- Test output
- Database schema with CHECK constraint

**Q46.** Is there a test for concurrent stock deductions?
- Test file path
- How many concurrent requests?
- Final stock level verification

**Q47.** Show the **actual inventory table** after 100 concurrent orders:
- Query to check stock levels
- Are there any negative values?
- Show the results

**Q48.** Is there logging for inventory deductions?
- Show a log entry
- What information is captured?
- User ID, item ID, quantity?

**Q49.** Show proof that inventory movements are recorded:
- Table name: `inventory_movements`
- Show actual records from a test order
- Columns: what's tracked?

**Q50.** Is there an audit trail for inventory changes?
- Query to see all changes to a specific item
- Show example results
- Who made the change? When?

### 2.2 Booking Race Conditions

**Q51.** Is there a test for double booking prevention?
- Test file path
- Scenario: 2 users book same chalet, same time
- Expected: 1 succeeds, 1 fails
- Show test results

**Q52.** Show the **actual booking table constraints**:
- Unique constraints
- Check constraints
- How is double booking prevented?

**Q53.** Create 100 simultaneous booking requests for the same chalet. Show results:
- Test code
- How many succeeded?
- How many failed?
- Database state after test

**Q54.** Is there a database lock when checking availability?
- What type of lock? (row-level, table-level)
- Show the SQL with lock
- File path

**Q55.** Show proof that overlapping bookings are impossible:
- Test file path
- Test scenarios covered
- Test results

**Q56.** What happens when two bookings are created at the exact same millisecond?
- Test file path
- How is this simulated?
- Results?

**Q57.** Is there optimistic locking implemented?
- Version field in booking table?
- Show the schema
- Test file path

**Q58.** Show the **actual error** when a double booking is attempted:
- Error message
- HTTP status code
- JSON response

**Q59.** Is there a booking reservation/hold mechanism?
- How long is a booking held?
- What table stores reservations?
- Show cleanup job for expired holds

**Q60.** Show proof that expired reservations are released:
- Cron job configuration
- Query that cleans up
- Logs from cleanup job

### 2.3 Distributed Locking (Redis)

**Q61.** Is Redis installed and configured?
- Show package.json
- Show connection configuration
- Is it used for locking?

**Q62.** Show the **actual Redis lock implementation**:
- File path
- Function name
- Full code

**Q63.** Is there a test for Redis locking?
- Test file path
- What scenarios?
- Test results

**Q64.** Show proof that Redis locks prevent race conditions:
- Test with 50 concurrent requests
- All trying to modify same resource
- Results: sequential processing

**Q65.** What happens if Redis is down?
- Fallback behavior?
- Error handling code
- Show a test for this scenario

**Q66.** Is there a lock timeout configured?
- How long are locks held?
- What happens on timeout?
- Show configuration

**Q67.** Show actual Redis keys created during a lock:
- Key format
- TTL (time to live)
- Value stored

**Q68.** Is there monitoring for Redis connection issues?
- Alerts configured?
- Error logging?
- Show configuration

**Q69.** Show proof that locks are released after operation completes:
- Test file path
- Verification that key is deleted
- Test results

**Q70.** Is there a test for lock contention (many requests waiting)?
- Test file path
- How many concurrent requests?
- Average wait time?

### 2.4 Atomic Operations

**Q71.** Show all SQL queries that use `RETURNING` clause:
- Grep results
- File paths
- Why is RETURNING used?

**Q72.** Are there any `SELECT FOR UPDATE` queries?
- Grep results
- File paths
- What are they locking?

**Q73.** Show proof that updates are atomic:
- Test file path
- Concurrent update test
- Final state verification

**Q74.** Is there a test for lost updates problem?
- Test file path
- Scenario: 2 users update same record
- Expected vs actual results

**Q75.** Show the **actual RPC functions** in the database:
- Function names (e.g., `deduct_stock_fifo`)
- Full SQL code
- Where are they called from?

**Q76.** Is `deduct_stock_fifo` atomic?
- Show the function SQL
- Does it use proper locking?
- Test file path

**Q77.** Show proof that RPCs handle errors correctly:
- Test file path
- Error scenarios tested
- Results

**Q78.** What happens if an RPC function fails?
- Is it retried?
- Is there rollback?
- Show error handling

**Q79.** Show the **actual database transaction isolation level**:
- How to check current level?
- What is it set to? (READ COMMITTED, SERIALIZABLE?)
- Where is this configured?

**Q80.** Is there a test for phantom reads?
- Test file path
- Scenario
- Results

### 2.5 Performance Under Load

**Q81.** Is there a load testing tool configured?
- Tool name? (k6, Artillery, JMeter?)
- Show configuration file
- When was it last run?

**Q82.** Show the **results** of the most recent load test:
- Requests per second achieved
- Average response time
- Error rate
- 95th percentile latency

**Q83.** At what concurrency level does the system start failing?
- Test results
- Error rate by concurrency level
- Bottleneck identified?

**Q84.** Show proof that database connection pooling works under load:
- Monitor connection count during load test
- Max connections reached?
- Any connection errors?

**Q85.** Is there a test for database deadlocks?
- Test file path
- How are deadlocks simulated?
- How are they handled?

**Q86.** Show **actual error logs** from a deadlock:
- Full error message
- Stack trace
- How was it resolved?

**Q87.** Is there automatic retry logic for deadlocks?
- Code file path
- How many retries?
- Exponential backoff?

**Q88.** Show proof that the system handles 1000 concurrent users:
- Load test configuration
- Results
- Response time degradation

**Q89.** What is the maximum throughput achieved?
- Orders per second
- Bookings per second
- Test configuration used

**Q90.** Is there database query performance monitoring?
- Tool name? (pg_stat_statements, APM?)
- Slowest queries identified
- Show query performance data

---

## Section 3: Payment Security - Proof Required (40 Questions)

### 3.1 Stripe Integration

**Q91.** Show the **actual Stripe API keys** being used (redacted):
- Are they test or live keys?
- Where are they stored?
- Show the environment variable names

**Q92.** Is Stripe Radar enabled?
- How to verify?
- Show dashboard screenshot or config
- When was it enabled?

**Q93.** Is 3D Secure configured?
- Show the payment intent creation code
- Is `payment_method_options.card.request_three_d_secure` set?
- Show a real payment with 3D Secure

**Q94.** Show proof that 3D Secure works:
- Test file path
- Real Stripe payment ID with 3DS
- Customer journey: how does it look?

**Q95.** Is there a test for SCA (Strong Customer Authentication)?
- Test file path
- EU compliance verified?
- Results

**Q96.** Show the **actual webhook endpoint configuration** in Stripe:
- Webhook URL
- Events subscribed to
- Webhook secret (redacted)

**Q97.** What webhooks is the system listening for?
- Full list of event types
- File path where handled
- What action is taken for each?

**Q98.** Is there a test for each webhook type?
- Test file paths
- Coverage of all webhook events
- Results

**Q99.** Show proof that webhook signatures are validated:
- Code file path
- What happens with invalid signature?
- Test results

**Q100.** Is there idempotency key usage in Stripe API calls?
- Show code example
- Where are keys stored?
- Format of keys

### 3.2 Payment Flow Integrity

**Q101.** Show the **complete payment flow** from frontend to database:
- Step-by-step sequence
- Each API call made
- Database records created at each step

**Q102.** Is there a test for "payment succeeds, order creation fails"?
- Test file path
- What is the expected behavior?
- Actual results

**Q103.** Show proof that failed payments don't create orders:
- Test file path
- Database state verification
- Results

**Q104.** Is there a payment retry mechanism?
- Code file path
- How many retries?
- Backoff strategy?

**Q105.** Show the **actual payment ledger** table schema:
- All columns
- Indexes
- Foreign keys

**Q106.** Show proof that all payments are recorded in the ledger:
- Query to verify
- Sample records
- Are failed payments logged?

**Q107.** Is there reconciliation between Stripe and local database?
- Script file path
- How often does it run?
- What discrepancies are found?

**Q108.** Show a real discrepancy example:
- Payment in Stripe but not in database (or vice versa)
- How was it discovered?
- How was it resolved?

**Q109.** Is there a test for payment timeout scenarios?
- Test file path
- Timeout duration
- Expected behavior

**Q110.** Show proof that partial refunds work correctly:
- Test file path
- Database state before/after
- Stripe payment intent state

### 3.3 Fraud Detection

**Q111.** Is Stripe Radar configured to block high-risk payments?
- Radar rules screenshot/config
- Blocked payment example
- How is the customer notified?

**Q112.** Is there payment velocity checking?
- Code file path
- Limits: X payments per Y minutes
- Test file path

**Q113.** Show proof that suspicious payments are flagged:
- Test scenario
- Flagging logic
- Admin notification

**Q114.** Is there manual review for flagged payments?
- Workflow description
- Where are flagged payments shown?
- Review decision options

**Q115.** Show the **actual fraud detection rules**:
- File path or database table
- Examples of rules
- How are they evaluated?

**Q116.** Is there IP-based fraud detection?
- Code file path
- What triggers suspicion?
- Blocklist/allowlist?

**Q117.** Show proof that multiple failed payment attempts are blocked:
- Test file path
- Limit: X failures in Y minutes
- Account lockout behavior

**Q118.** Is there device fingerprinting?
- Library used
- What information is collected?
- How is it used?

**Q119.** Show the **actual payment metadata** sent to Stripe:
- Example JSON
- What custom fields are included?
- User ID, Order ID, etc.?

**Q120.** Is there geolocation checking for payments?
- Code file path
- Mismatch handling (billing vs shipping country)
- Test results

### 3.4 Refund Handling

**Q121.** Show the **complete refund flow**:
- API endpoint
- Database updates
- Stripe API call
- Notification to customer

**Q122.** Is there a test for full refunds?
- Test file path
- Verification steps
- Results

**Q123.** Is there a test for partial refunds?
- Test file path
- Amount calculation
- Results

**Q124.** Show proof that refunds update order status:
- Database query
- Before/after state
- Payment status changes

**Q125.** Is there a refund reason tracking?
- Database field
- Required or optional?
- Admin-facing or customer-facing?

**Q126.** Show the **refund webhook handling**:
- Code file path
- What happens on `charge.refunded`?
- Database updates

**Q127.** Is there a test for refund webhooks?
- Test file path
- Mock webhook payload
- Results

**Q128.** Show proof that inventory is restored on refund:
- Test file path
- Stock level before/after
- Inventory movement records

**Q129.** Is there a time limit for refunds?
- Policy: X days after purchase
- Enforced in code?
- File path

**Q130.** Show the **actual refund records** in database:
- Table name
- Schema
- Sample records

---

## Section 4: Authentication & Security - Proof Required (40 Questions)

### 4.1 JWT Authentication

**Q131.** Is there a test for JWT generation and validation?
- Test file path
- What claims are tested?
- Results

**Q132.** Show the **actual JWT payload** for a real user:
- Decoded token (redacted sensitive data)
- Claims included
- Expiration time

**Q133.** Show proof that expired tokens are rejected:
- Test file path
- Error message
- HTTP status code

**Q134.** Is there a test for token refresh flow?
- Test file path
- Refresh token validation
- New token generation

**Q135.** Show the **actual refresh token** storage:
- Database table name
- Schema
- Sample record (redacted)

**Q136.** Show proof that refresh tokens are rotated:
- Test file path
- Old token invalidated
- New token generated

**Q137.** Is there a test for token reuse detection?
- Test file path
- Scenario: same refresh token used twice
- Expected behavior

**Q138.** Show the **actual JWT secret** storage:
- Environment variable name
- How many secrets are configured?
- Rotation policy?

**Q139.** Is there a test for "logout all devices"?
- Test file path
- What happens to all active sessions?
- Results

**Q140.** Show proof that logout invalidates tokens:
- Database changes
- Token blacklist or session deletion
- API response when using invalidated token

### 4.2 Password Security

**Q141.** Show the **actual bcrypt cost factor** used:
- Code file path
- Value (10, 12, 14?)
- When was it last changed?

**Q142.** Is there a test for password hashing?
- Test file path
- Verification that same password gives different hashes
- Results

**Q143.** Show proof that passwords are never logged:
- Grep search for password logging
- Results (should be empty)
- Sanitization code

**Q144.** Is there a password strength meter on frontend?
- Code file path
- Library used
- Criteria checked

**Q145.** Show the **actual password validation rules**:
- Code file path (Zod schema)
- All requirements
- Error messages

**Q146.** Is there a test for password reset flow?
- Test file path
- Reset token generation
- Expiration time
- Results

**Q147.** Show proof that reset tokens expire:
- Test file path
- Expiration duration
- What happens after expiration?

**Q148.** Show the **actual reset token** stored in database:
- Table name
- Schema
- Token format (plain or hashed?)

**Q149.** Is there rate limiting on password reset requests?
- Code file path
- Limit: X requests per Y minutes
- Test results

**Q150.** Show proof that old password is required for password change:
- API endpoint code
- Validation logic
- Test results

### 4.3 Two-Factor Authentication

**Q151.** Is there a test for 2FA enrollment?
- Test file path
- QR code generation
- Secret storage
- Results

**Q152.** Show the **actual TOTP secret** storage:
- Database table and column
- Encryption method
- Sample encrypted value

**Q153.** Show proof that TOTP secrets are encrypted:
- Encryption code file path
- Algorithm used (AES-256?)
- Key storage

**Q154.** Is there a test for TOTP validation?
- Test file path
- Valid code accepted
- Invalid code rejected
- Results

**Q155.** Show the **actual backup codes** generated:
- How many codes?
- Format (length, charset)
- Storage method (hashed?)

**Q156.** Is there a test for backup code usage?
- Test file path
- One-time use verification
- Results

**Q157.** Show proof that backup codes are invalidated after use:
- Database state before/after
- Test results

**Q158.** Is there a test for 2FA recovery?
- Test file path
- Lost device scenario
- Admin override or backup codes

**Q159.** Show the **actual 2FA configuration**:
- TOTP window size (30 seconds?)
- Allowed time drift
- Code file path

**Q160.** Is there a test for time drift tolerance?
- Test file path
- Codes from past/future accepted?
- Limit on drift

### 4.4 CSRF Protection

**Q161.** Is there a test for CSRF protection?
- Test file path
- Request without CSRF token rejected
- Request with valid token accepted
- Results

**Q162.** Show the **actual CSRF token** generation code:
- File path
- Token format
- Expiration

**Q163.** Show proof that state-changing requests require CSRF tokens:
- Middleware code
- List of protected endpoints
- Error on missing token

**Q164.** Is there a test for CSRF token validation?
- Test file path
- Invalid token rejection
- Results

**Q165.** Show the **actual CSRF cookie** configuration:
- Cookie name
- HttpOnly flag
- SameSite attribute
- Secure flag

**Q166.** Is there a test for double submit cookie pattern?
- Test file path
- Token in cookie matches token in header
- Results

**Q167.** Show proof that CSRF tokens rotate:
- Test file path
- Token changes per request or session
- Results

**Q168.** Is there CSRF exemption for public APIs?
- Endpoint list
- How is exemption implemented?
- Code file path

**Q169.** Show the **actual CSRF error response**:
- HTTP status code
- Error message
- JSON structure

**Q170.** Is there logging for CSRF failures?
- Log entry example
- What information is captured?
- Alert threshold?

### 4.5 Session Management

**Q171.** Show the **actual user sessions table** schema:
- All columns
- Indexes
- Foreign keys

**Q172.** Is there a test for session creation?
- Test file path
- Session attributes stored
- Results

**Q173.** Show proof that concurrent sessions are limited:
- Test file path
- Limit value
- Oldest session removed behavior

**Q174.** Is there device fingerprinting in sessions?
- Fields stored: user agent, IP, device ID
- Code file path
- Sample session record

**Q175.** Show the **actual session cleanup job**:
- Cron configuration
- Query to delete expired sessions
- Last run timestamp

**Q176.** Is there a test for session cleanup?
- Test file path
- Expired sessions deleted
- Active sessions retained
- Results

**Q177.** Show proof that sessions expire after inactivity:
- Inactivity timeout value
- Last activity tracking code
- Test results

**Q178.** Is there a test for "logout all devices" affecting all sessions?
- Test file path
- Multiple sessions deleted
- Results

**Q179.** Show the **actual session cookie** configuration:
- Cookie name
- HttpOnly, Secure, SameSite settings
- Max age

**Q180.** Is there session hijacking protection?
- IP binding code
- User agent validation
- Test file path

---

## Section 5: Data Integrity - Proof Required (30 Questions)

### 5.1 Database Constraints

**Q181.** List **all UNIQUE constraints** in the database:
- Table and column
- Constraint name
- Purpose

**Q182.** List **all CHECK constraints**:
- Table and column
- Constraint definition
- Example: `CHECK (stock >= 0)`

**Q183.** List **all FOREIGN KEY constraints**:
- Parent table → Child table
- ON DELETE behavior
- ON UPDATE behavior

**Q184.** Show proof that foreign key violations are caught:
- Test file path
- Attempt to insert invalid reference
- Error message received

**Q185.** Is there a test for cascade deletes?
- Test file path
- Parent record deleted
- Child records deleted automatically
- Results

**Q186.** Show the **actual database triggers**:
- Trigger names
- Purpose (audit, validation, etc.)
- Trigger SQL code

**Q187.** Is there a trigger for updated_at timestamp?
- Trigger SQL
- Which tables use it?
- Test verification

**Q188.** Show proof that soft deletes work:
- Test file path
- Record marked deleted_at
- Record excluded from queries
- Results

**Q189.** Is there a test for unique constraints with soft deletes?
- Test file path
- Deleted record allows duplicate
- Results

**Q190.** Show the **actual database indexes**:
- Index names
- Columns indexed
- Index type (B-tree, GIN, etc.)

### 5.2 Data Validation

**Q191.** Show all **Zod schemas** used for validation:
- File paths
- Examples of validation rules
- Error messages

**Q192.** Is there a test for input validation?
- Test file path
- Invalid input rejected
- Valid input accepted
- Results

**Q193.** Show proof that SQL injection is prevented:
- Parameterized query example
- Test file path for SQL injection attempt
- Results

**Q194.** Is there a test for XSS prevention?
- Test file path
- Malicious script input
- Output sanitization verification
- Results

**Q195.** Show the **actual input sanitization** code:
- File path
- Library used (DOMPurify, validator.js?)
- Example usage

**Q196.** Is there a test for file upload validation?
- Test file path
- File type checking
- File size limits
- Malicious file rejection

**Q197.** Show proof that numeric fields reject non-numeric input:
- Test file path
- Validation error message
- Results

**Q198.** Is there a test for date validation?
- Test file path
- Invalid date formats rejected
- Future/past date constraints

**Q199.** Show the **actual email validation** rules:
- Regex pattern
- Library used
- Test file path

**Q200.** Is there a test for phone number validation?
- Test file path
- International format support
- Results

### 5.3 Audit Trail

**Q201.** Show the **audit log table** schema:
- All columns
- Retention policy
- Indexes

**Q202.** Is there a test for audit logging?
- Test file path
- Create/Update/Delete events logged
- Results

**Q203.** Show **actual audit log entries**:
- Sample records
- What information is captured?
- Query to retrieve them

**Q204.** Is there a test for "who changed what when"?
- Test file path
- User identification in logs
- Timestamp verification
- Results

**Q205.** Show proof that sensitive fields are redacted in logs:
- Code file path
- Fields redacted: password, credit card, etc.
- Log entry example

**Q206.** Is there a test for audit log immutability?
- Test file path
- Attempt to modify log entry fails
- Results

**Q207.** Show the **actual database permissions** for audit logs:
- Only INSERT allowed
- No UPDATE/DELETE
- How is this enforced?

**Q208.** Is there log retention policy implementation?
- Cleanup job
- Retention period (X days/months)
- Archived logs location

**Q209.** Show proof that deleted records are preserved in audit logs:
- Test file path
- Soft delete event logged
- Original data retrievable
- Results

**Q210.** Is there a search interface for audit logs?
- API endpoint or admin UI
- Search criteria supported
- Example query

---

## Section 6: Performance & Scalability - Proof Required (30 Questions)

### 6.1 Database Performance

**Q211.** Show the **actual slow query log**:
- How to enable it?
- Threshold for "slow" (milliseconds)
- Sample slow queries

**Q212.** Is there query performance monitoring?
- Tool name (pg_stat_statements, APM)
- Top 10 slowest queries
- Execution count and average time

**Q213.** Show proof that indexes improve query performance:
- Before/after index creation
- Query execution time
- EXPLAIN ANALYZE output

**Q214.** Is there a test for N+1 query problems?
- Test file path
- Detection mechanism
- Example N+1 query found

**Q215.** Show the **actual database connection pool** settings:
- Min connections
- Max connections
- Idle timeout
- Configuration file path

**Q216.** Show proof that connection pooling works:
- Monitor active connections during load
- No connection exhaustion errors
- Logs showing connection reuse

**Q217.** Is there database replication configured?
- Primary server
- Replica servers (count)
- Replication lag monitoring

**Q218.** Show the **actual read replica** usage:
- Code that routes reads to replica
- File path
- Load distribution

**Q219.** Is there a test for failover to replica?
- Test file path
- Primary down, replica promoted
- Results

**Q220.** Show proof that database backups work:
- Backup schedule
- Last successful backup timestamp
- Restore test results

### 6.2 Caching

**Q221.** Is Redis configured for caching?
- Package.json dependency
- Connection configuration
- Cache key patterns

**Q222.** Show the **actual Redis cache usage**:
- Code file path
- What is cached?
- TTL values

**Q223.** Is there a test for cache hit/miss?
- Test file path
- Cache population
- Retrieval verification
- Results

**Q224.** Show proof that cache invalidation works:
- Test file path
- Data updated → Cache cleared
- Results

**Q225.** Show the **actual cache statistics**:
- Hit rate
- Miss rate
- Memory usage
- How to access these stats?

**Q226.** Is there cache warming on startup?
- Script file path
- What data is preloaded?
- How long does it take?

**Q227.** Show proof that the system works when cache is down:
- Test file path
- Fallback to database
- Performance degradation acceptable
- Results

**Q228.** Is there cache monitoring/alerting?
- Memory usage alerts
- Eviction rate monitoring
- Configuration

**Q229.** Show the **actual cached data** format:
- Key naming convention
- Value structure (JSON, string, binary)
- Example key-value pairs

**Q230.** Is there a cache eviction policy configured?
- LRU, LFU, TTL?
- Configuration file path
- When does eviction happen?

### 6.3 API Performance

**Q231.** Show the **actual API response times**:
- Average response time per endpoint
- 95th percentile
- 99th percentile
- How are these measured?

**Q232.** Is there APM (Application Performance Monitoring)?
- Tool name (New Relic, DataDog, AppDynamics)
- Dashboard screenshot or metrics
- Slowest endpoints identified

**Q233.** Show proof that rate limiting works:
- Test file path
- Exceed limit → 429 Too Many Requests
- Results

**Q234.** Show the **actual rate limit** configuration:
- Requests per minute
- Per IP or per user?
- Code file path

**Q235.** Is there a test for rate limit bypass attempts?
- Test file path
- Different IPs, same user
- Results

**Q236.** Show proof that pagination works:
- Test file path
- Large dataset handling
- Performance comparison: with/without pagination
- Results

**Q237.** Show the **actual pagination** implementation:
- Code file path
- Page size limits
- Cursor-based or offset-based?

**Q238.** Is there compression enabled (gzip/brotli)?
- Middleware configuration
- File path
- Response size before/after

**Q239.** Show proof that compression reduces response size:
- Test file path
- Example API response
- Size reduction percentage
- Results

**Q240.** Is there CDN configuration for static assets?
- CDN provider (CloudFlare, CloudFront)
- Cache rules
- Verification: are assets served from CDN?

---

## Section 7: Testing Coverage - Proof Required (30 Questions)

### 7.1 Unit Tests

**Q241.** Show the **actual test coverage** report:
- Overall coverage percentage
- Per-file coverage
- How to generate this report?

**Q242.** Show the **test configuration**:
- Testing framework (Jest, Mocha, Vitest)
- Configuration file path
- Test file patterns

**Q243.** How many unit tests exist?
- Total count
- Command to run all tests: `npm test`
- Execution time

**Q244.** Show the **test output** from running all tests:
- Pass/fail count
- Any failing tests?
- Error messages

**Q245.** Is there a test for every critical service?
- Order service
- Payment service
- Booking service
- Authentication service
- Test file paths

**Q246.** Show a **sample unit test**:
- File path
- Test code
- Assertions made
- Mocking used

**Q247.** Is there mocking for external services?
- Stripe mocked?
- Email service mocked?
- Database mocked?
- Library used (sinon, jest.mock)

**Q248.** Show proof that tests run in isolation:
- No shared state between tests
- Database reset between tests
- Test file path demonstrating this

**Q249.** Is there continuous test execution (watch mode)?
- Command to run
- Configuration
- Developer workflow integration

**Q250.** Show the **slowest unit tests**:
- Test file and name
- Execution time
- Why are they slow?

### 7.2 Integration Tests

**Q251.** How many integration tests exist?
- Total count
- Test file paths
- What do they test?

**Q252.** Show the **actual integration test** for order creation:
- Test file path
- Full test code
- Results

**Q253.** Is there a test for the complete booking flow?
- Test file path
- Steps covered
- Results

**Q254.** Show proof that integration tests use test database:
- Database configuration
- Reset/seed scripts
- Test file path

**Q255.** Is there a test for API endpoint authorization?
- Test file path
- Unauthorized request rejected
- Authorized request accepted
- Results

**Q256.** Show the **actual API integration test**:
- HTTP request/response
- Test assertions
- Mock vs real database

**Q257.** Is there a test for webhook processing?
- Test file path
- Mock webhook payload
- Database state verification
- Results

**Q258.** Show proof that tests clean up after themselves:
- Database records deleted
- Files removed
- Test isolation verified

**Q259.** Is there parallel test execution?
- Configuration
- How many workers?
- Execution time improvement

**Q260.** Show the **integration test coverage**:
- Which flows are tested end-to-end?
- Missing coverage areas
- Report

### 7.3 End-to-End (E2E) Tests

**Q261.** Is Playwright/Cypress configured?
- Configuration file path
- Browser settings
- Base URL

**Q262.** How many E2E tests exist?
- Total count
- Test file paths
- What user journeys are tested?

**Q263.** Show the **actual E2E test** for user registration:
- Test file path
- Full test code
- Screenshots/videos available?

**Q264.** Is there an E2E test for checkout flow?
- Test file path
- Steps: Browse → Add to Cart → Checkout → Payment
- Results

**Q265.** Show proof that E2E tests run on CI:
- CI configuration file
- Test execution logs
- Pass/fail status

**Q266.** Is there visual regression testing?
- Tool used (Percy, Chromatic)
- Sample screenshots
- Baseline vs current comparison

**Q267.** Show the **actual E2E test execution**:
- Command to run
- Browser launched
- Test output
- Time to complete

**Q268.** Is there E2E test for mobile responsive design?
- Test file path
- Device emulation
- Viewports tested

**Q269.** Show proof that E2E tests catch real bugs:
- Example bug found by E2E test
- Test file path
- Bug fix verification

**Q270.** Is there a test for error states in UI?
- Test file path
- API failure simulation
- Error message verification
- Results

### 7.4 Load/Stress Testing

**Q271.** Is there a load testing tool configured?
- Tool name (k6, Artillery, Locust)
- Configuration file path
- Last run date

**Q272.** Show the **load test script**:
- File path
- Scenarios tested
- Virtual user count

**Q273.** Show the **actual load test results**:
- Requests per second
- Response time (avg, p95, p99)
- Error rate
- Resource utilization

**Q274.** At what load does the system break?
- Virtual users count
- Error rate threshold
- Results

**Q275.** Is there a test for database connection pool exhaustion?
- Test scenario
- Max connections reached
- Error handling
- Results

**Q276.** Show proof that auto-scaling works:
- Load test triggering scale-up
- New instances launched
- Load distributed
- Metrics

**Q277.** Is there a stress test for inventory race conditions?
- Test file path
- Concurrent order attempts
- Stock level verification
- Results

**Q278.** Show the **actual memory usage** under load:
- Monitoring tool
- Peak memory
- Memory leaks detected?

**Q279.** Is there a soak test (long-running load)?
- Duration (hours)
- Performance degradation over time?
- Results

**Q280.** Show proof that the system recovers from overload:
- Load removed
- Response time returns to normal
- No lingering errors
- Metrics

---

## Section 8: Deployment & DevOps - Proof Required (20 Questions)

### 8.1 CI/CD Pipeline

**Q281.** Show the **actual CI/CD configuration**:
- File path (.github/workflows, .gitlab-ci.yml)
- Build steps
- Test steps
- Deployment steps

**Q282.** Show the **latest CI/CD run**:
- Build status (pass/fail)
- Test results
- Deployment status
- Logs

**Q283.** Is there automated testing in CI?
- Which tests run?
- Failure blocks deployment?
- Results

**Q284.** Show proof that builds are reproducible:
- Same code → same artifact
- Build hashing/checksums
- Verification method

**Q285.** Is there rollback capability?
- How to trigger rollback?
- Time to rollback?
- Automatic or manual?

**Q286.** Show the **deployment frequency**:
- How often are deploys done?
- Last 10 deploy timestamps
- Success rate

**Q287.** Is there blue-green deployment?
- Configuration
- Traffic switching mechanism
- Rollback process

**Q288.** Show proof that zero-downtime deployment works:
- Deployment logs
- No 5xx errors during deploy
- Traffic metrics

**Q289.** Is there canary deployment?
- Configuration
- Percentage of traffic to canary
- Automatic rollback on errors

**Q290.** Show the **actual deployment script**:
- File path
- Steps executed
- Verification checks

### 8.2 Monitoring & Alerting

**Q291.** Is there uptime monitoring?
- Tool name (UptimeRobot, Pingdom)
- Endpoints monitored
- Alert configuration

**Q292.** Show the **current uptime percentage**:
- Last 30 days
- Downtime incidents
- Resolution time

**Q293.** Is there error tracking?
- Tool (Sentry, Rollbar, Bugsnag)
- Error count (last 24 hours)
- Most common errors

**Q294.** Show **actual error logs** from production:
- Sample errors
- Frequency
- Resolution status

**Q295.** Is there alerting configured?
- Alert rules
- Notification channels (email, Slack, PagerDuty)
- On-call rotation

**Q296.** Show proof that alerts are triggered:
- Example alert
- Trigger condition
- Response time

**Q297.** Is there health check endpoint?
- Endpoint URL
- Response format
- Checks performed (DB, Redis, etc.)

**Q298.** Show the **actual health check response**:
- JSON output
- All systems operational?
- Latency for each check

**Q299.** Is there application metrics dashboard?
- Tool (Grafana, CloudWatch, DataDog)
- Key metrics displayed
- Screenshot

**Q300.** Show proof that metrics are accurate:
- Manual verification vs dashboard
- Discrepancy check
- Results

---

## Section 9: Security Auditing - Proof Required (20 Questions)

### 9.1 Vulnerability Scanning

**Q301.** Is there automated security scanning?
- Tool name (Snyk, Dependabot, npm audit)
- Scan frequency
- Last scan date

**Q302.** Show the **npm audit results**:
- Command: `npm audit`
- Vulnerability count (high/medium/low)
- Packages affected

**Q303.** Are there any critical vulnerabilities?
- List them
- CVE numbers
- Remediation plan

**Q304.** Show proof that vulnerabilities are patched:
- Before/after npm audit
- Package updates
- Verification

**Q305.** Is there dependency update automation?
- Dependabot configuration
- Auto-merge rules
- PR review process

**Q306.** Show the **actual Dependabot PRs**:
- Recent PRs
- Merged or closed?
- Review comments

**Q307.** Is there license compliance checking?
- Tool used
- Incompatible licenses flagged
- Results

**Q308.** Show proof that no banned licenses are used:
- License report
- Allowed vs banned list
- Compliance status

**Q309.** Is there secret scanning in repo?
- GitHub secret scanning enabled?
- Leaked secrets found?
- Remediation

**Q310.** Show the **actual .gitignore file**:
- .env excluded
- node_modules excluded
- Build artifacts excluded
- Verification

### 9.2 Penetration Testing

**Q311.** Has a security audit been performed?
- Auditor name
- Audit date
- Report available?

**Q312.** Show the **penetration test report**:
- Findings summary
- Severity classification
- Remediation status

**Q313.** Is there SQL injection testing?
- Test file path
- Malicious inputs tested
- Results (all blocked?)

**Q314.** Is there XSS testing?
- Test file path
- Script injection attempts
- Output sanitization verification

**Q315.** Is there CSRF testing?
- Test file path
- Request without token
- Results

**Q316.** Show proof that authentication bypass attempts fail:
- Test scenarios
- Negative testing results
- Security controls validated

**Q317.** Is there authorization bypass testing?
- Test file path
- Privilege escalation attempts
- Results

**Q318.** Show the **actual security headers** in HTTP responses:
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- Content-Security-Policy
- How to verify?

**Q319.** Is there API rate limiting testing?
- Test file path
- Brute force attempt
- Rate limit enforcement

**Q320.** Show proof that sensitive data is encrypted at rest:
- Database column encryption
- Encryption keys management
- Verification query

---

## Section 10: Code Quality - Proof Required (15 Questions)

### 10.1 Static Analysis

**Q321.** Is there a linter configured?
- ESLint, TSLint, Biome?
- Configuration file path
- Rules enabled

**Q322.** Show the **linter output**:
- Command: `npm run lint`
- Warnings and errors
- Violation count

**Q323.** Is there a code formatter?
- Prettier, Biome?
- Configuration file path
- Auto-format on save?

**Q324.** Show proof that code is formatted consistently:
- Before/after prettier run
- Style guide adherence
- Verification

**Q325.** Is there TypeScript strict mode enabled?
- tsconfig.json settings
- Strict flags
- Compile errors

**Q326.** Show the **actual TypeScript configuration**:
- File path
- Strict mode
- Target version
- Module system

**Q327.** Is there code complexity analysis?
- Tool (SonarQube, Code Climate)
- Cyclomatic complexity threshold
- High-complexity functions identified

**Q328.** Show the **actual code smells** found:
- Duplicated code
- Long functions
- God objects
- Tool report

**Q329.** Is there dead code detection?
- Tool used
- Unused functions/variables
- Cleanup plan

**Q330.** Show proof that no commented-out code exists:
- Grep search results
- File paths with comments
- Cleanup status

### 10.2 Documentation

**Q331.** Is there API documentation?
- Swagger/OpenAPI spec
- Endpoint URL for docs
- Auto-generated or manual?

**Q332.** Show the **actual API documentation**:
- Screenshot or URL
- Endpoints documented
- Request/response examples

**Q333.** Is there code documentation (JSDoc)?
- Coverage percentage
- Example documented function
- Documentation linting

**Q334.** Show proof that public functions are documented:
- Sample JSDoc comments
- Type definitions
- Usage examples

**Q335.** Is there a README for developers?
- File path
- Setup instructions
- Running tests
- Contributing guidelines

---

## Section 11: Business Logic - Proof Required (15 Questions)

### 11.1 Pricing & Discounts

**Q336.** Is there a test for discount calculation?
- Test file path
- Scenarios tested
- Results

**Q337.** Show the **actual discount logic**:
- Code file path
- Function name
- Calculation formula

**Q338.** Is there a test for coupon code application?
- Test file path
- Valid vs invalid coupons
- One-time use verification
- Results

**Q339.** Show proof that expired coupons are rejected:
- Test file path
- Date validation
- Error message

**Q340.** Is there a test for loyalty points calculation?
- Test file path
- Points earned per dollar
- Tier multipliers
- Results

**Q341.** Show the **actual loyalty points** table:
- Schema
- Sample records
- Point balance calculation

**Q342.** Is there a test for gift card redemption?
- Test file path
- Balance deduction
- Insufficient balance handling
- Results

**Q343.** Show proof that gift cards can't be over-redeemed:
- Test file path
- Balance validation
- Results

**Q344.** Is there a test for tax calculation?
- Test file path
- Tax rate source
- Rounding rules
- Results

**Q345.** Show the **actual tax calculation** code:
- File path
- Formula
- Different tax rates by region?

### 11.2 Inventory & Menu Management

**Q346.** Is there a test for recipe/BOM explosion?
- Test file path
- Recipe with 5 ingredients
- Stock deduction for each
- Results

**Q347.** Show proof that BOM deduction is accurate:
- Recipe definition
- Order quantity
- Ingredient stock before/after
- Calculations match

**Q348.** Is there a test for menu item availability based on stock?
- Test file path
- Out-of-stock items unavailable
- Results

**Q349.** Show the **actual menu availability** logic:
- Code file path
- Stock check
- Real-time updates

**Q350.** Is there a test for low stock alerts?
- Test file path
- Threshold configuration
- Alert triggered
- Results

---

## Section 12: Real-World Scenarios - Proof Required (20 Questions)

### 12.1 Failure Recovery

**Q351.** What happens when Stripe is down?
- Test file path
- Fallback behavior
- User experience
- Results

**Q352.** Show proof that system handles Stripe timeout:
- Test scenario
- Retry logic
- User notification
- Results

**Q353.** What happens when database is down?
- Error handling
- User message
- Recovery process

**Q354.** Is there a circuit breaker for external services?
- Code file path
- Threshold config
- Fallback behavior

**Q355.** Show proof that email sending failures don't block orders:
- Test file path
- Order created, email fails
- Order still succeeds
- Results

**Q356.** What happens when Redis is down?
- Cache bypass
- Performance impact
- System stability

**Q357.** Is there graceful degradation?
- Feature flags
- Non-critical features disabled
- Core functionality maintained

**Q358.** Show the **actual feature flags**:
- Configuration
- How to toggle
- Deployment strategy

**Q359.** What happens during deployment?
- In-flight requests
- Active WebSocket connections
- User experience

**Q360.** Show proof that in-flight requests complete during deploy:
- Test scenario
- Request started before deploy
- Response after deploy
- Results

### 12.2 Data Consistency

**Q361.** What happens when two users book the last chalet simultaneously?
- Test file path
- Expected: one succeeds, one fails
- Actual results
- Error message

**Q362.** Show proof that overbooking is impossible:
- Load test with 100 concurrent bookings
- Only available slots booked
- No double bookings
- Results

**Q363.** What happens when payment succeeds but order creation fails?
- Test scenario
- Payment refunded?
- User notified?
- Results

**Q364.** Show proof that partial order failures are handled:
- Order created
- Order items insert fails
- Entire order rolled back
- Results

**Q365.** What happens when inventory deduction fails after order creation?
- Test scenario
- Order status
- Inventory status
- Rollback behavior

**Q366.** Show the **actual orphaned records** in database:
- Query to find them
- How many exist?
- Cleanup process

**Q367.** What happens when webhook arrives multiple times?
- Idempotency key check
- Duplicate processing prevented
- Results

**Q368.** Show proof that webhook idempotency works:
- Test file path
- Same webhook sent twice
- Only processed once
- Results

**Q369.** What happens when order is cancelled after payment?
- Refund triggered?
- Inventory restored?
- Loyalty points reversed?
- Results

**Q370.** Show the **actual cancellation flow**:
- Code file path
- Steps executed
- Database state changes
- User notification

---

## Section 13: Edge Cases - Proof Required (15 Questions)

**Q371.** What happens when user's session expires mid-checkout?
- Test scenario
- Error message
- Cart preservation
- Results

**Q372.** What happens when user's loyalty points are redeemed simultaneously in two orders?
- Test file path
- Expected: one succeeds, one fails
- Actual results
- Point balance verification

**Q373.** What happens when gift card is used by two users at the same time?
- Test file path
- Balance checked atomically?
- Results

**Q374.** What happens when coupon usage limit is reached?
- Test scenario
- 100 users, 100 coupons, 50 usage limit
- Only 50 succeed
- Results

**Q375.** What happens when booking extends past midnight?
- Pricing calculation
- Date boundary handling
- Results

**Q376.** What happens when timezone changes (DST)?
- Booking time interpretation
- Database storage (UTC?)
- Display timezone handling

**Q377.** What happens when user changes email during 2FA enrollment?
- Test scenario
- Email verification
- TOTP secret tied to account
- Results

**Q378.** What happens when admin deletes a user with active orders?
- Soft delete?
- Order history preserved?
- Results

**Q379.** What happens when menu item price changes during checkout?
- Price locked at cart addition?
- Updated at checkout?
- User notified?

**Q380.** What happens when payment is pending for >10 minutes?
- Timeout logic
- Inventory released?
- Order cancelled?
- Results

**Q381.** What happens when user's card is declined?
- Error message
- Retry allowed?
- Alternative payment methods?
- Results

**Q382.** What happens when refund is requested for partially delivered order?
- Partial refund logic
- Inventory restoration (undelivered items)
- Results

**Q383.** What happens when kitchen marks item as unavailable after order placed?
- User notified?
- Refund triggered?
- Substitution offered?

**Q384.** What happens when table number is changed mid-order?
- Order reassignment
- Kitchen notification
- Results

**Q385.** What happens when user logs out with items in cart?
- Cart persistence
- Duration
- Restoration on login

---

## Section 14: Documentation & Knowledge Transfer - Final Proof (15 Questions)

**Q386.** Is there a system architecture diagram?
- File path or URL
- Components illustrated
- Data flow shown

**Q387.** Is there a database ER diagram?
- File path or URL
- Tables and relationships
- Cardinality notation

**Q388.** Is there a deployment architecture diagram?
- Infrastructure components
- Load balancers, servers, databases
- Network topology

**Q389.** Is there a runbook for common operations?
- How to deploy
- How to rollback
- How to scale
- How to investigate issues

**Q390.** Is there an incident response plan?
- File path
- Escalation process
- Communication templates

**Q391.** Is there a disaster recovery plan?
- RTO/RPO targets
- Backup restoration steps
- Tested?

**Q392.** Is there developer onboarding documentation?
- Setup guide
- Architecture overview
- Contribution guidelines

**Q393.** Is there API versioning strategy documented?
- Versioning scheme
- Deprecation policy
- Migration guide

**Q394.** Is there a changelog maintained?
- File path
- Format (Keep a Changelog?)
- Last update

**Q395.** Are environment variables documented?
- Full list
- Purpose of each
- Required vs optional

**Q396.** Is there troubleshooting guide?
- Common issues
- Solutions
- Log locations

**Q397.** Is there performance tuning guide?
- Database optimization
- Caching strategy
- CDN configuration

**Q398.** Is there security best practices document?
- Password policy
- Key rotation
- Access control

**Q399.** Is there monitoring & alerting runbook?
- What alerts exist
- How to respond
- Escalation process

**Q400.** Is there a business continuity plan?
- Key dependencies
- Single points of failure
- Mitigation strategies

---

## Final Validation Questions (Proof of Production Readiness)

### Critical Questions That Demand Real Evidence

**Q401.** Has the system been tested with **real customers**?
- Number of test users
- Real transactions processed
- Feedback collected
- Issues found

**Q402.** Has the system run for **30 consecutive days** without critical bugs?
- Uptime percentage
- Incidents logged
- Resolution times
- Evidence

**Q403.** Has a **security professional** reviewed the code?
- Auditor name/company
- Audit date
- Findings count
- Remediation status

**Q404.** Has a **load test** with 500+ concurrent users been run?
- Test tool and configuration
- Results: RPS, latency, errors
- System behavior under load
- Evidence

**Q405.** Has a **penetration test** been performed?
- Testing company
- Test date
- Vulnerabilities found
- Remediation proof

**Q406.** Has the **disaster recovery plan** been tested?
- Test date
- Scenario tested
- Recovery time
- Success/failure

**Q407.** Has a **database backup restoration** been tested?
- Test date
- Data integrity verified
- Time to restore
- Success proof

**Q408.** Has the **payment flow** been tested with real Stripe live mode?
- Test transactions
- Webhook delivery
- Refund processing
- Evidence

**Q409.** Has **concurrent booking** been tested in production-like environment?
- Number of concurrent users
- No double bookings verified
- Evidence

**Q410.** Has **inventory accuracy** been verified over 1000+ orders?
- Order count
- Stock discrepancies found
- Variance percentage
- Evidence

**Q411.** Show the **production environment** configuration:
- Server specs
- Database specs
- Redis specs
- CDN configuration

**Q412.** Show **production logs** from last 7 days:
- Error count
- Warning count
- Critical issues
- Resolution status

**Q413.** Show **production metrics** from last 30 days:
- Uptime percentage
- Average response time
- Error rate
- Throughput (orders/hour)

**Q414.** Show **real customer feedback** or support tickets:
- Number of tickets
- Common issues
- Resolution rate
- Customer satisfaction

**Q415.** Show **code repository insights**:
- Commit frequency
- Active contributors
- Open PRs
- Open issues

---

## Final Summary Questions

**Q416.** What is the **single biggest risk** in the current system?
- Identified by testing
- Impact on users
- Likelihood of occurrence
- Mitigation plan

**Q417.** What is the **test coverage** across the entire project?
- Unit test coverage %
- Integration test coverage %
- E2E test coverage %
- Overall risk assessment

**Q418.** What **bugs have been found** in production in the last 30 days?
- Bug count
- Severity distribution
- Root causes
- Prevention measures

**Q419.** What is the **mean time to recovery (MTTR)** for incidents?
- Average time
- Longest incident
- Shortest incident
- Improvement trend

**Q420.** What is the **change failure rate**?
- Percentage of deployments causing incidents
- Last 10 deployments
- Failed deployment details
- Rollback frequency

**Q421.** Are there any **known issues** that are **not fixed**?
- Issue list
- Priority
- Reason not fixed
- Workarounds

**Q422.** Are there any **missing features** that buyers would expect?
- Feature list
- Priority
- Effort to implement
- Competitive analysis

**Q423.** What is the **technical debt** level?
- Major debt items
- Impact on maintainability
- Refactoring plan
- Timeline

**Q424.** What is the **bus factor** for this project?
- Key person dependencies
- Knowledge documentation
- Onboarding process
- Risk mitigation

**Q425.** What would it take to make this **truly production-ready**?
- Remaining work items
- Estimated effort
- Critical path
- Risk assessment

---

## Deliverables Expected

For this questionnaire to be considered "answered", provide:

1. **Test Execution Report**: Run all tests and provide full output
2. **Load Test Report**: Execute load tests and provide metrics
3. **Security Scan Report**: Run npm audit, dependency scanning, provide results
4. **Code Coverage Report**: Generate and provide HTML report
5. **API Documentation**: Provide Swagger/OpenAPI spec or equivalent
6. **Deployment Evidence**: Show recent successful deployments
7. **Monitoring Dashboard**: Show actual metrics from production/staging
8. **Database Schema**: Export and provide complete schema with constraints
9. **Sample Data**: Provide anonymized production data showing real usage
10. **Incident Log**: Show last 30 days of incidents and resolutions

---

**End of Proof of Functionality Questionnaire**

This questionnaire shifts from "what exists" to "prove it works". Every question demands evidence, not just code explanations.
