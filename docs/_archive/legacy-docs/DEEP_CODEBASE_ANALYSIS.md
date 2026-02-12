# V2 Resort - Deep Codebase Analysis Questionnaire

## Document Purpose

This questionnaire is designed to extract **granular implementation details** from the V2 Resort codebase. The previous analysis answered "what" and "why" - this questionnaire focuses on **"how" and "where"** at the code level.

**Instructions for GitHub Copilot:**
- Provide **specific file paths** for all answers
- Include **actual code snippets** (not pseudocode)
- Reference **exact function/class names**
- Note **line numbers** where relevant
- Explain **why** decisions were made (if documented in comments/commits)
- Flag **TODO comments** and **technical debt**
- Identify **duplicated code** patterns
- Point out **unused code** or **dead code**
- List **all dependencies** used for each feature

---

## Section 1: Transaction System Deep Dive (50 Questions)

### Database Transaction Implementation

1. What is the **exact file path** of the current pseudo-transaction implementation mentioned in the analysis?

2. Provide the **complete code** of the `transactionRollback` helper function. Where is it defined?

3. Which endpoints/functions currently use this `transactionRollback` helper? List all file paths and function names.

4. Why was Supabase client chosen over node-postgres? Is there documentation explaining this decision?

5. What specific Supabase client methods are being used? (e.g., `.from()`, `.select()`, `.insert()`)

6. Show the **exact code** of a typical order creation flow. Which file contains this logic?

7. In the order creation flow, what is the **exact sequence** of database operations? (Line by line)

8. If payment succeeds but order creation fails, what **exact error** is thrown? Show the error handling code.

9. Where is the Stripe payment confirmation webhook handler located? Show the complete function.

10. In the webhook handler, what happens if the database write fails after Stripe confirms payment?

11. Is there a `payments` table? If yes, what are **all the columns** and their types?

12. Is there an `orders` table? Show the **complete schema** (all columns, constraints, indexes).

13. Are payment records and orders linked? What is the foreign key relationship?

14. When an order is created, are related records created in other tables (order_items, inventory_movements)? Show the code.

15. If creating an order_item fails, is the order record rolled back? Show the error handling.

16. Are there any database constraints (UNIQUE, CHECK, FOREIGN KEY) that would prevent invalid states?

17. What package/version is currently used for database access? (`package.json` excerpt)

18. Show the **database connection initialization** code. Which file contains it?

19. Is there connection pooling configured? Show the configuration code.

20. What happens when the database connection pool is exhausted? Show error handling.

21. Are there any raw SQL queries in the codebase? If yes, list all files containing them.

22. Show an example of a raw SQL query. Why was raw SQL used instead of ORM?

23. Is there a database query logger? If yes, where is it configured and what does it log?

24. Are there any long-running queries (>1 second)? How do we identify them?

25. What is the **exact error message** when a database constraint violation occurs?

26. Show the code that handles duplicate key errors (e.g., booking same slot twice).

27. Are there any database migrations that failed or were skipped? How do we know?

28. What is the naming convention for migration files? Show examples of actual filenames.

29. Is there a migration that adds the `deleted_at` column? Show the SQL.

30. Are there any irreversible migrations? List them and explain why.

31. Show the code for soft-delete implementation. Which models use it?

32. When soft-deleting an order, are related records (order_items) also soft-deleted? Show the code.

33. How are soft-deleted records excluded from queries? Show example query code.

34. Is there a way to hard-delete soft-deleted records? Show the function.

35. Show the **exact Prisma/ORM schema** for the Order model.

36. What validation happens before inserting an order into the database? Show the Zod schema.

37. Where is the Zod schema for order creation defined? Full file path.

38. Show an example API endpoint that creates an order. Full request handler code.

39. In the order creation endpoint, what middleware runs before the handler? List them in order.

40. Show the authentication middleware code. How does it attach user info to the request?

41. Show the authorization middleware code. How does it check permissions?

42. If a user lacks permission to create an order, what **exact error response** is sent?

43. Are there any `console.log` statements in the order creation flow? List their locations.

44. Are there proper try-catch blocks? Show an example of error handling in order creation.

45. What logging library is used? Show an example of a log statement.

46. Where are logs stored? (File path, external service, database?)

47. Show the configuration for the Winston logger (if used).

48. Is there request ID tracking across logs? Show how request IDs are generated and passed.

49. In production, what log level is used? (debug, info, warn, error)

50. Show an example of a logged database error with the full error object structure.

---

## Section 2: Race Condition & Concurrency Deep Dive (50 Questions)

### Inventory Management Race Conditions

51. Where is the inventory stock deduction logic? **Exact file path and function name.**

52. Show the **complete code** of the stock deduction function.

53. Is this function called directly from the order creation endpoint, or is it in a service layer?

54. Before deducting stock, is the current stock level queried? Show the query code.

55. After querying stock, is there any delay before the update? (e.g., validation, API calls)

56. Show the **exact SQL/ORM query** that updates stock levels.

57. Is the stock update query atomic? Does it use `SET stock = stock - 1` or fetch-then-update?

58. What happens if stock is already zero when an order is placed? Show the error handling.

59. Is there a database constraint preventing negative stock? Show the constraint definition.

60. If we tried to set stock to -1, what error would the database return?

61. Are stock levels checked in JavaScript before the database update? Show the code.

62. Is there a time gap between the JavaScript check and database update where race conditions occur?

63. How many database queries happen during an order placement? List them in sequence.

64. Are these queries executed in parallel or sequentially? Show the code (Promise.all vs await chain).

65. Show the code that handles "out of stock" errors when creating an order.

66. If two orders are placed simultaneously for the last item, which one succeeds? How is this determined?

67. Is there any locking mechanism (application-level or database-level) for inventory? Show code.

68. Is Redis installed and configured? Show the Redis connection code.

69. If Redis is available, is it currently used for anything? List all uses.

70. Show an example of a Redis SET/GET operation in the codebase.

71. Is there Redis locking (redlock) implemented anywhere? Show the code.

72. If not, are there TODO comments or plans to implement Redis locking?

73. How would you implement a distributed lock for inventory? Show proposed pseudocode.

74. Are there any mutex/semaphore patterns in the JavaScript code? Show examples.

75. Is there a rate limiter that prevents rapid concurrent requests from the same user?

76. Show the rate limiting middleware code. What library is used?

77. How many requests per second are allowed per user/IP? Show the configuration.

78. If rate limit is exceeded, what HTTP status code and error message is returned?

79. Is rate limiting applied to order creation endpoints? Show the route configuration.

80. Are there any debounce or throttle mechanisms on the frontend for order submission?

### Booking System Race Conditions

81. Where is the booking availability check located? **File path and function name.**

82. Show the **complete code** of the availability check function.

83. When checking availability, is a specific time slot queried? Show the SQL/ORM query.

84. How are overlapping bookings prevented? Show the logic.

85. Is there a unique constraint on (chalet_id, date, time_slot)? Show the schema.

86. If two bookings are submitted for the same slot simultaneously, what happens?

87. Show the error handling when a duplicate booking is detected.

88. What error message does the user see if their booking conflicts with another?

89. Is there a `bookings` table? Show the **complete schema** with all columns.

90. Are there any database indexes on the bookings table? List them.

91. Show the code that creates a new booking record.

92. Before inserting a booking, what validation happens? Show the validation code.

93. Is there a Zod schema for booking creation? Show it.

94. After creating a booking, is the chalet's availability updated? Show the code.

95. Is availability stored in a separate table or calculated from bookings? Explain the design.

96. If availability is calculated, show the query that counts current bookings.

97. How is the maximum capacity per time slot enforced? Show the code.

98. Can a user book multiple chalets simultaneously? Is this prevented? Show the logic.

99. Is there a booking expiration mechanism (unpaid bookings auto-cancelled)? Show the code.

100. Where is the booking expiration job located? How often does it run?

---

## Section 3: Payment Flow Deep Dive (50 Questions)

### Stripe Integration Implementation

101. What Stripe SDK version is installed? Show the `package.json` entry.

102. Where is the Stripe client initialized? Show the exact code.

103. Are test and live API keys stored separately? Show the environment variable names.

104. How is the correct API key selected based on environment? Show the code.

105. Show the code that creates a Stripe Payment Intent.

106. What metadata is attached to the Payment Intent? Show the metadata object.

107. Is the order ID included in Payment Intent metadata? Show the code.

108. After creating a Payment Intent, is an order record created immediately or after payment?

109. Show the complete payment flow from frontend to backend to Stripe. List all steps.

110. Where is the Stripe webhook endpoint defined? **File path and route.**

111. Show the **complete webhook handler function** code.

112. How is the Stripe webhook signature verified? Show the verification code.

113. What happens if webhook signature verification fails? Show error handling.

114. Which Stripe webhook events are handled? List all event types.

115. Show the code that handles `payment_intent.succeeded` event.

116. Show the code that handles `payment_intent.payment_failed` event.

117. Show the code that handles `charge.refunded` event.

118. Are there any other webhook events handled? List them with file locations.

119. When a payment succeeds, how is the order marked as paid? Show the database update code.

120. Is there a `payment_status` column in the orders table? What are the possible values?

121. Show the code that updates order status from "pending" to "paid".

122. If the order doesn't exist when webhook arrives, what happens? Show error handling.

123. Is there webhook event deduplication? How is it implemented?

124. Are webhook events stored in a database table? If yes, show the schema.

125. Is there webhook retry logic if processing fails? Show the code.

126. What is the webhook endpoint URL in production? (Shown in Stripe dashboard)

127. Are webhook events processed synchronously or asynchronously (job queue)?

128. If using a job queue, which library is used? (Bull, BullMQ, etc.)

129. Show the job queue configuration code.

130. How many workers process webhook jobs? Is this configurable?

131. What happens if a webhook job fails 3 times? Is it sent to a dead letter queue?

132. Show the code that handles refunds.

133. When initiating a refund, is Stripe API called? Show the code.

134. After Stripe confirms refund, how is the order updated? Show the code.

135. Is inventory restored when an order is refunded? Show the code.

136. Show the code that handles partial refunds.

137. Are refund records stored separately from payment records? Show the schema.

138. Is there a `refunds` table? Show the complete schema.

139. How are payment fees (Stripe fees) calculated and stored? Show the code.

140. Is there a field for `net_amount` (after fees)? Show where it's calculated.

141. Show the code that calculates total order amount including tax and fees.

142. Are tax calculations done on backend or frontend? Show the code.

143. What tax rates are supported? Are they hardcoded or in database?

144. Show the code that applies discounts to order totals.

145. Can discounts and taxes stack? Show the calculation order.

146. Is there an `order_totals` or `payment_totals` table? Show the schema.

147. How are failed payments retried? Is there auto-retry logic?

148. Show the code that notifies users of payment success/failure.

149. Which email template is used for payment confirmation? Show the template file path.

150. Show the SendGrid email sending code for payment confirmations.

---

## Section 4: Inventory System Deep Dive (40 Questions)

### Inventory Schema & Logic

151. Is there an `inventory` table? Show the **complete schema** with all columns.

152. Are there separate tables for `inventory_items` and `inventory_movements`? Show both schemas.

153. How is current stock calculated - stored value or sum of movements?

154. If stock is calculated, show the SQL query that computes current stock.

155. Show the code that logs inventory movements (sale, waste, transfer, etc.).

156. What are all the possible inventory movement types? List them.

157. Is there an enum or constant for movement types? Show the code.

158. Show the code that creates an inventory movement record.

159. Are movements linked to orders, bookings, or other entities? Show foreign key relationships.

160. When an order is cancelled, is an inventory movement created? Show the code.

161. Show the code that handles inventory transfers between locations.

162. Are there multiple inventory locations? Show the locations table schema.

163. How is inventory tracked per location? Show the query.

164. Is there a low stock alert system? Show the code.

165. What threshold triggers a low stock alert? Is it configurable per item?

166. Show the code that sends low stock notifications.

167. Are inventory adjustments logged in an audit trail? Show the schema.

168. Who can make inventory adjustments? Show the permission check code.

169. Is there a Bill of Materials (BOM) system? Show the schema.

170. How are recipes linked to inventory items? Show the relationship.

171. When a menu item is ordered, are multiple inventory items deducted? Show the code.

172. Show an example BOM for a menu item (e.g., burger = bun + patty + lettuce).

173. Is there a `recipe_ingredients` table? Show the schema.

174. How are ingredient quantities specified in recipes? (units, weights, etc.)

175. Show the code that calculates ingredient costs for a menu item.

176. Is Cost of Goods Sold (COGS) calculated? Show the code.

177. Are ingredient costs stored in the database? Show where.

178. How are cost updates handled when supplier prices change?

179. Is there a supplier management system? Show the schema.

180. Can purchase orders be created from the system? Show the code.

181. Show the code that handles inventory receiving (deliveries).

182. Is there barcode scanning support? Show the implementation.

183. Are inventory counts (stocktaking) supported? Show the code.

184. Show the code that calculates inventory variance (expected vs actual).

185. Is there an inventory expiry tracking system? Show the schema.

186. How are expiring items identified? Show the query.

187. Show the code that alerts about expiring inventory.

188. Is there waste tracking? Show the waste logging code.

189. What waste reasons are tracked? (spoilage, damage, theft, etc.)

190. Show the code that generates inventory reports.

---

## Section 5: API Architecture Deep Dive (40 Questions)

### Route Structure & Middleware

191. What is the main Express app file? **Full path.**

192. Show the complete Express app initialization code.

193. How are routes organized? (Single file, folder structure, route modules?)

194. List all route files and their paths (e.g., `routes/auth.ts`, `routes/orders.ts`).

195. Show the code that registers all routes in the Express app.

196. Is there route versioning (`/api/v1/`)? Show how it's implemented.

197. Are routes grouped by feature or by HTTP method? Show examples.

198. Show the middleware stack for a typical authenticated endpoint.

199. What middleware runs on every request? List them in order.

200. Show the CORS configuration code.

201. What origins are allowed in CORS? Is it configurable?

202. Show the body parser middleware configuration.

203. What is the maximum request body size? Show the configuration.

204. Is there request size validation? Show the middleware code.

205. Show the authentication middleware implementation.

206. How is the JWT token extracted from the request? (Header, cookie, query param?)

207. Show the code that validates and decodes the JWT.

208. After validating JWT, how is user info attached to the request object?

209. Show the type definition for the request object with user attached.

210. Is there a `req.user` property? What fields does it contain?

211. Show the authorization middleware implementation.

212. How are required permissions specified for an endpoint? Show examples.

213. Show the code that checks if a user has required permissions.

214. If permission check fails, what error is returned? Show the response.

215. Is there role hierarchy (admin > manager > staff)? Show the logic.

216. Are there route-specific rate limiters? Show examples.

217. Show the rate limiting configuration for login endpoint.

218. Show the rate limiting configuration for order creation endpoint.

219. Is there different rate limiting for authenticated vs unauthenticated users?

220. Show the error handler middleware code.

221. How are different error types distinguished? (ValidationError, AuthError, etc.)

222. Show the code that formats error responses.

223. Are error stack traces included in responses? Only in development?

224. Show the code that logs errors to Sentry.

225. What Sentry environment is configured? (development, staging, production)

226. Are user details sent to Sentry with errors? Show the context code.

227. Show the request logging middleware code.

228. What information is logged per request? (method, path, duration, status code?)

229. Is request/response body logged? Show the configuration.

230. Show the helmet.js security headers configuration.

---

## Section 6: Real-Time System Deep Dive (30 Questions)

### Socket.io Implementation

231. Where is Socket.io server initialized? **File path and code.**

232. Show the Socket.io configuration (options, adapters, etc.).

233. Is Redis adapter used for Socket.io? Show the configuration.

234. How are Socket.io namespaces organized? List all namespaces.

235. Show the authentication logic for Socket.io connections.

236. How is the JWT validated for WebSocket connections?

237. After WebSocket authentication, how is user info stored in the socket?

238. Show the code that handles Socket.io connection event.

239. Show the code that handles Socket.io disconnection event.

240. What custom events are emitted by the server? List all event names.

241. Show the code that emits "order:created" event (or similar).

242. Show the code that emits "order:status_updated" event.

243. How are events broadcast to specific users? Show the code.

244. How are events broadcast to all kitchen staff? Show the code.

245. Is there a room system for Socket.io? Show how rooms are managed.

246. When a user joins, are they added to specific rooms? Show the code.

247. Show the code that broadcasts to a specific room.

248. Are Socket.io events logged? Show the logging code.

249. How are Socket.io errors handled? Show error handling.

250. Is there reconnection logic on the client side? Show the code.

251. What happens when a WebSocket message fails to send? Show retry logic.

252. Are messages queued if the client is offline? Show the implementation.

253. Show the client-side Socket.io initialization code. **Frontend file path.**

254. How does the frontend authenticate with Socket.io? Show the code.

255. Show the frontend code that listens for "order:created" events.

256. How are real-time updates applied to the frontend state? (Redux, Zustand, etc.)

257. Show the code that updates the UI when a WebSocket event arrives.

258. Is there optimistic UI updating? Show an example.

259. How are WebSocket reconnections handled on the frontend?

260. Is there a visual indicator for WebSocket connection status? Show the component.

---

## Section 7: Testing Deep Dive (30 Questions)

### Test Coverage & Implementation

261. What testing framework is used? (Jest, Vitest, Mocha, etc.)

262. Where are test files located? (Same directory as source, separate `tests/` folder?)

263. What is the naming convention for test files? (`.test.ts`, `.spec.ts`, `__tests__/`?)

264. How many test files exist in the project? List the count by type (unit, integration, e2e).

265. Show an example unit test file. **Full code.**

266. Show an example integration test file. **Full code.**

267. Show an example E2E test file. **Full code.**

268. Is there a test setup file that runs before all tests? Show the code.

269. How is the test database initialized? Show the setup code.

270. Are tests using a real database or mocking? Explain the strategy.

271. Show the code that seeds test data.

272. Are there database fixtures for tests? Show example fixtures.

273. How are API calls mocked in tests? Show example mock code.

274. Is Stripe API mocked in tests? Show the mock implementation.

275. Show a test for the order creation endpoint.

276. Show a test for the payment webhook handler.

277. Show a test for inventory deduction.

278. Are there tests for race conditions? Show an example.

279. How are concurrent requests simulated in tests? Show the code.

280. Is there a load testing script? **File path and code.**

281. What load testing tool is used? (k6, Artillery, JMeter, custom?)

282. Show the load test configuration for order creation endpoint.

283. What is the target load (requests per second, concurrent users)?

284. Are load test results stored? Where?

285. Show the test coverage reporting configuration.

286. What is the current overall test coverage percentage?

287. Which modules have the lowest test coverage? List them.

288. Are there any untested critical paths? List them.

289. Is there a CI/CD pipeline that runs tests? Show the config file.

290. At what stage in CI/CD do tests run? (On PR, before merge, before deploy?)

---

## Section 8: Frontend Architecture Deep Dive (30 Questions)

### Next.js Implementation

291. What Next.js version is being used? Show the `package.json` entry.

292. Is the project using App Router or Pages Router?

293. Where is the Next.js configuration file? Show `next.config.js` contents.

294. Are there any custom webpack configurations? Show them.

295. Show the file structure of the `app/` or `pages/` directory.

296. Where is the main layout component? Show the code.

297. How is global state managed? (Redux, Zustand, Context API, etc.)

298. If using Zustand, where are the stores defined? List all store files.

299. Show an example Zustand store implementation.

300. How is API communication handled on frontend? Show the API client code.

301. Is there an Axios instance or fetch wrapper? Show the configuration.

302. Where are API endpoints defined? (Hardcoded, environment variables, constants file?)

303. Show the code that sets the base API URL.

304. How are authentication tokens attached to API requests? Show the code.

305. Show the code that handles API request errors.

306. Is there automatic token refresh on 401 errors? Show the implementation.

307. How are forms handled? (React Hook Form, Formik, vanilla React state?)

308. Show an example form component using React Hook Form.

309. How is form validation implemented? Show a Zod schema used in forms.

310. Show the code that handles form submission errors.

311. Where are UI components located? (components/, src/components/, etc.)

312. Is there a component library being used? (MUI, Ant Design, shadcn, custom?)

313. Show the Tailwind CSS configuration file.

314. Are there custom Tailwind classes defined? Show them.

315. How is dark mode implemented? Show the code.

316. Is there a theme system? Show the theme configuration.

317. Show the code that applies themes dynamically.

318. How are translations managed? (i18next, next-intl, etc.)

319. Where are translation files located? Show the directory structure.

320. Show an example translation file (e.g., `en.json` or `ar.json`).

---

## Section 9: Security Implementation Deep Dive (30 Questions)

### Input Validation & Sanitization

321. Where is input sanitization implemented? Show example code.

322. Is there a central sanitization utility? Show the function.

323. Show the Zod schema for user registration.

324. Show the Zod schema for order creation.

325. Are there custom Zod validators? Show examples.

326. How is XSS prevention implemented? Show the code.

327. Are HTML tags stripped from user input? Show the sanitization code.

328. Is there output encoding when rendering user content? Show examples.

329. How are file uploads validated? Show the validation code.

330. What file types are allowed for upload? Show the whitelist.

331. What is the maximum file upload size? Show the configuration.

332. How are uploaded files stored? (Local disk, S3, Supabase Storage?)

333. Show the code that handles file uploads.

334. Are uploaded file names sanitized? Show the code.

335. Is there virus scanning for uploaded files? Show the integration.

336. How are SQL injection attempts detected? Show the middleware code.

337. Show an example of a blocked SQL injection attempt (logs or tests).

338. Is there NoSQL injection prevention? Show relevant code.

339. How are command injection attempts prevented?

340. Show the code that validates and sanitizes environment variables.

341. Are sensitive values masked in logs? Show the masking code.

342. Show an example log entry with masked sensitive data.

343. Is there a Content Security Policy header? Show the configuration.

344. What CSP directives are enabled? List them.

345. Is there a CSRF token implementation? Show the code.

346. How are CSRF tokens generated? Show the function.

347. How are CSRF tokens validated? Show the middleware.

348. Are there security headers configured? (X-Frame-Options, X-Content-Type-Options, etc.)

349. Show the security headers middleware configuration.

350. Is there HTTP Strict Transport Security (HSTS) enabled? Show the config.

---

## Section 10: Performance & Optimization Deep Dive (30 Questions)

### Caching & Query Optimization

351. Is Redis being used for caching? Show the cache implementation code.

352. What data is cached in Redis? List all cache keys.

353. Show the code that sets a cache value with TTL.

354. Show the code that retrieves a cached value.

355. How is cache invalidation handled? Show the code.

356. When an order is updated, is related cache invalidated? Show the code.

357. Are database query results cached? Show examples.

358. What is the cache hit rate? How is it measured?

359. Show the cache configuration (host, port, password, TTL defaults).

360. Is there a cache warming strategy? Show the code.

361. Show an example of a slow database query (>1 second).

362. How are slow queries identified? Is there logging or monitoring?

363. Are there database indexes on frequently queried columns? List them.

364. Show the indexes on the `orders` table.

365. Show the indexes on the `inventory` table.

366. Show the indexes on the `bookings` table.

367. Are there composite indexes? Show examples.

368. Is there query result pagination? Show the implementation.

369. What is the default page size for API responses?

370. Show the code that handles pagination query params (page, limit, offset).

371. Are images optimized on upload? Show the code.

372. What image formats are supported? (JPEG, PNG, WebP, AVIF?)

373. Is there image resizing/compression? Show the code.

374. Are images served from a CDN? Show the URL structure.

375. Show the Next.js Image component configuration.

376. Are static assets versioned for cache busting? Show the implementation.

377. What is the cache duration for static assets? Show the headers.

378. Is Gzip compression enabled? Show the configuration.

379. Is Brotli compression enabled? Show the configuration.

380. What is the average bundle size for the main JavaScript file?

---

## Section 11: Error Handling & Logging Deep Dive (25 Questions)

### Error Management System

381. Where is the global error handler defined? Show the complete code.

382. How are async errors caught in Express? Show the wrapper code.

383. Show an example custom error class (e.g., `ValidationError`, `AuthenticationError`).

384. How many custom error classes are defined? List them all.

385. Show the code that creates and throws a custom error.

386. Are error codes used? Show examples (e.g., `ERR_INVALID_TOKEN`).

387. Show the error response format for a 400 Bad Request.

388. Show the error response format for a 500 Internal Server Error.

389. Are errors translated to user's language? Show the implementation.

390. Where are error message translations stored? Show the file.

391. Show the Winston logger configuration.

392. What log levels are used? (debug, info, warn, error, fatal?)

393. Are logs written to files, console, or external service?

394. What is the log file rotation policy? Show the configuration.

395. Show an example log entry in JSON format.

396. Are errors logged with stack traces? Show example logged error.

397. How is user context attached to logs? Show the code.

398. Are request IDs generated and tracked? Show the middleware.

399. Show a log entry with request ID included.

400. Is there structured logging? Show the log format schema.

401. How are database errors logged? Show example code.

402. How are Stripe errors logged? Show example code.

403. Show the Sentry error reporting code.

404. What information is sent to Sentry? (User, request, breadcrumbs?)

405. Are errors grouped/fingerprinted in Sentry? Show the configuration.

---

## Section 12: Business Logic Deep Dive (25 Questions)

### Core Business Rules

406. Where are discount calculation rules defined? Show the code.

407. How are percentage discounts applied? Show the formula.

408. How are fixed-amount discounts applied? Show the code.

409. Can discounts be stacked? Show the validation logic.

410. Show the code that validates discount codes.

411. Are there discount usage limits? Show the enforcement code.

412. Show the code that tracks discount usage.

413. How are loyalty points earned? Show the calculation.

414. How are loyalty points redeemed? Show the code.

415. Are there loyalty tiers? Show the tier definitions.

416. Show the code that upgrades a user to a higher loyalty tier.

417. How is customer lifetime value (CLV) calculated? Show the code.

418. How are abandoned carts tracked? Show the implementation.

419. Is there an abandoned cart recovery system? Show the code.

420. Show the code that sends abandoned cart reminder emails.

421. How are peak vs off-peak hours defined? Show the configuration.

422. Is there dynamic pricing based on time? Show the implementation.

423. Show the code that calculates surge pricing.

424. How are group bookings handled? Show the code.

425. Is there a minimum/maximum order value? Show the validation.

426. Show the code that enforces minimum order amount.

427. How are special dietary requirements flagged? Show the schema and code.

428. Is there allergen tracking? Show the implementation.

429. Show the code that filters menu items by dietary preference.

430. How are reviews moderated? Show the approval workflow code.

---

## Section 13: Email & Notifications Deep Dive (20 Questions)

### Communication System

431. What email service is used? (SendGrid, AWS SES, etc.)

432. Show the email service configuration code.

433. Where are email templates located? List all template files.

434. Show an example email template (e.g., order confirmation).

435. How are email templates rendered with dynamic data? Show the code.

436. Show the code that sends an order confirmation email.

437. Show the code that sends a password reset email.

438. Are emails queued for sending or sent immediately? Show the implementation.

439. If queued, what queue system is used? (Bull, BullMQ, RabbitMQ?)

440. Show the email queue configuration.

441. How are failed email sends handled? Show retry logic.

442. Is there email sending logging? Show example logs.

443. Show the code that sends push notifications (if implemented).

444. What push notification service is used? (Firebase, OneSignal, etc.)

445. How are notification preferences managed? Show the schema.

446. Show the code that checks if a user has notifications enabled.

447. Are in-app notifications stored in database? Show the schema.

448. Show the code that marks notifications as read.

449. How are notification badges counted? Show the query.

450. Show the code that sends SMS notifications (if implemented).

---

## Section 14: Module Builder Deep Dive (15 Questions)

### Dynamic Module System

451. Where is the module builder code located? **File path.**

452. Show the complete module builder implementation.

453. How are dynamic modules stored in the database? Show the schema.

454. Show the code that generates a new module from user input.

455. Are generated modules saved as database records or actual code files?

456. If code files, where are they saved and how are they loaded dynamically?

457. Show an example of a generated module.

458. How are module routes registered dynamically? Show the code.

459. How are module permissions generated? Show the code.

460. Show the code that activates/deactivates a module.

461. When a module is deactivated, are its routes removed? Show the code.

462. Are there default module templates? Show examples.

463. Show the validation for module creation (naming, conflicts, etc.).

464. Can modules depend on other modules? Show the dependency system.

465. Is there version control for modules? Show the implementation.

---

## Section 15: Deployment & Infrastructure Deep Dive (15 Questions)

### Production Environment

466. Show the complete `Dockerfile` content.

467. Show the `docker-compose.yml` configuration.

468. Show the CI/CD pipeline configuration (GitHub Actions, GitLab CI, etc.).

469. What tests run in the CI pipeline? Show the test commands.

470. Is there automatic deployment on merge to main? Show the configuration.

471. Show the production environment variables (without sensitive values).

472. How many environment variables are required? List them all.

473. Show the health check endpoint code.

474. What checks are performed in the health check? (DB connection, Redis, etc.)

475. Show the graceful shutdown code for the Express server.

476. How are database migrations run in production? Show the deployment script.

477. Is there a rollback script? Show the code.

478. Show the Nginx configuration (if applicable).

479. Are there separate staging and production environments? Show the differences.

480. How is the production database backed up? Show the backup script.

---

## Final Analysis Questions (20 Questions)

### Code Quality & Technical Debt

481. How many TODO comments exist in the codebase? List their locations and content.

482. How many FIXME comments exist? List them.

483. How many HACK or XXX comments exist? List them.

484. Are there any `@ts-ignore` or `@ts-expect-error` comments? List them with explanations.

485. Are there any `any` types used? Show examples and why.

486. How many ESLint warnings exist? Show the count and top violations.

487. How many ESLint errors exist? List them.

488. Are there unused imports? How many?

489. Are there unused variables? List examples.

490. Are there unused functions? List them.

491. Is there duplicated code? Show examples of code that should be refactored.

492. Are there magic numbers in the code? Show examples and suggest constants.

493. Are there long functions (>100 lines)? List them.

494. Are there deeply nested conditionals (>3 levels)? Show examples.

495. What is the cyclomatic complexity of the most complex function?

496. Are there any security vulnerabilities in dependencies? Run `npm audit` and show results.

497. Are dependencies up to date? Show outdated packages.

498. What is the total lines of code in the backend?

499. What is the total lines of code in the frontend?

500. If you could change ONE thing about the codebase architecture, what would it be and why?

---

## Instructions for Answering

For each question, provide:

1. **Direct Answer** - The exact information requested
2. **Code Snippets** - Actual code from the project (not pseudocode)
3. **File Paths** - Absolute paths from project root
4. **Line Numbers** - Where relevant
5. **Context** - Brief explanation of why it's implemented this way
6. **Issues** - Any problems or concerns you notice
7. **Recommendations** - Suggested improvements

### Format Example:

**Question**: Show the code that creates a Stripe Payment Intent.

**Answer**:
```
File: backend/src/services/stripe.service.ts
Lines: 45-62

Code:
async createPaymentIntent(amount: number, orderId: string): Promise<Stripe.PaymentIntent> {
  return await this.stripe.paymentIntents.create({
    amount: amount * 100, // Convert to cents
    currency: 'usd',
    metadata: {
      orderId,
      environment: process.env.NODE_ENV
    }
  });
}

Context: Uses Stripe SDK v14.25, multiplies by 100 for cent conversion.

Issue: No error handling if Stripe API fails.

Recommendation: Wrap in try-catch, add retry logic for network failures.
```

---

**Total Questions**: 500  
**Expected Completion Time**: 4-6 hours for comprehensive answers  
**Output Format**: Markdown file with sections and code blocks  
**Purpose**: Complete understanding of implementation for fixing critical issues identified in previous analysis

