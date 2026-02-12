# V2 Resort - Admin Functionality & Business Logic Verification

## Document Purpose

This questionnaire verifies that **advertised features actually work** from an admin/business owner perspective. We're testing the gap between "what the system claims to do" vs "what it actually does."

**Focus Areas**:
1. What can admins actually edit without touching code?
2. How do real workflows function (adding menu items, managing inventory, etc.)?
3. Does customer-facing behavior match backend configuration?
4. Are business rules properly enforced?
5. Can a non-technical person run this system?

**Testing Approach**: For each feature, show:
- Where to access it in admin panel
- Step-by-step workflow with screenshots/code paths
- What's editable vs hardcoded
- Customer-facing verification (does it actually work?)

---

## Section 1: Admin Panel Access & Navigation (25 Questions)

### Login & Authentication

1. What is the exact URL to access the admin panel? (e.g., `/admin`, `/dashboard`)

2. Show the admin login page. Is it separate from customer login or the same interface?

3. What credentials are needed to access admin panel? (Role required, default credentials)

4. Show the code that restricts admin panel access. Which middleware checks for admin role?

5. If a non-admin tries to access `/admin`, what happens? Show the redirect/error.

6. Is there a separate super admin role? What additional permissions does it have?

7. Can admins reset their own passwords from the admin panel? Show the workflow.

8. Is there 2FA for admin accounts? Is it mandatory or optional?

9. Show the admin panel homepage/dashboard. What's displayed on first login?

10. Show the navigation menu structure. List all top-level menu items.

### Navigation Structure

11. Are menu items organized into sections (e.g., Restaurant, Bookings, Settings)?

12. Can admin panel navigation be customized per user role? Show configuration.

13. Show a screenshot or describe the sidebar/header navigation layout.

14. Is there a breadcrumb trail showing current location? Show example.

15. Are there quick action buttons on the dashboard (e.g., "New Order", "New Booking")?

16. Is there a search feature to find specific pages/settings? Show it.

17. Can admins bookmark frequently used pages? How?

18. Is there a mobile-responsive admin panel? Show on mobile viewport.

19. Are there keyboard shortcuts for common actions? List them.

20. Show the user profile dropdown. What options are available (settings, logout, etc.)?

### Multi-Language in Admin

21. Can admins switch the admin panel language? Show the language selector.

22. Is the admin panel fully translated to Arabic and French? Show proof.

23. Are form labels, buttons, and error messages translated?

24. When adding content (menu items, descriptions), can admins enter text in multiple languages?

25. Show the interface for multi-language content entry (e.g., tabs for EN/AR/FR).

---

## Section 2: Menu Management - Restaurant (50 Questions)

### Accessing Menu Management

26. Where in the admin panel do you manage restaurant menu items? Exact path/URL.

27. Show the menu items list page. What columns are displayed (name, price, status, etc.)?

28. Can you filter menu items (by category, status, price range)? Show filters.

29. Can you search menu items by name or SKU? Show the search box.

30. Can you bulk select and perform actions (delete, activate, deactivate)? Show UI.

### Creating a Menu Item

31. Click "Add New Menu Item". Show the complete form with all fields.

32. What fields are **required** to create a menu item? (Name, price, etc.)

33. What fields are **optional**? List them all.

34. Show how to add a menu item name in multiple languages (EN, AR, FR).

35. Show how to add a description in multiple languages.

36. How do you set the price? Is it per language or global?

37. Can you set different prices for different locations/branches? Show configuration.

38. Show how to upload a product image. What formats are accepted? Max size?

39. Can you upload multiple images for one item? Show the interface.

40. How do you assign a menu item to a category? Dropdown, autocomplete, or tags?

41. Can you create a new category on-the-fly while adding an item? Show workflow.

42. Show how to mark dietary preferences (vegetarian, vegan, gluten-free, halal, kosher).

43. Show how to add allergen information. Is it freeform text or checkboxes?

44. Show how to set availability (always, specific days, specific hours).

45. Can you set quantity limits per session/day? Show the interface.

46. Show how to mark an item as "popular", "new", or "recommended". Is it a toggle or badge?

47. Show how to set item status (draft, published, out of stock, discontinued).

48. Can you schedule a menu item to auto-publish on a future date? Show configuration.

49. Show how to add preparation time (e.g., "15 minutes"). Is it required?

50. Show how to add cooking instructions or kitchen notes.

### Modifiers & Variants

51. Show how to add modifiers to a menu item (e.g., "Add cheese +$2").

52. Can modifiers be required (e.g., "Choose a size") or optional? Show configuration.

53. Show the interface for creating a modifier group (e.g., "Sizes", "Add-ons").

54. Can modifiers have their own prices? Show the price input field.

55. Show how to limit modifier selections (e.g., "Choose up to 3 toppings").

56. Can modifiers be linked to inventory? (e.g., "Extra cheese" deducts cheese stock)

57. Show a completed menu item with modifiers. How does it display?

58. Show how to create item variants (e.g., "Small", "Medium", "Large" as separate SKUs).

59. For variants, can each have a different price and inventory? Show proof.

60. Show the customer-facing display of an item with modifiers. Does it match admin config?

### Categories & Organization

61. Where do you manage menu categories? Show the category management page.

62. Show the form to create a new category. What fields are available?

63. Can categories have descriptions and images? Show the fields.

64. Can categories be nested (parent/child categories)? Show the hierarchy.

65. Show how to reorder categories (drag-and-drop, number input, up/down arrows).

66. Can you set category visibility (show to customers or hide)? Show toggle.

67. Show how to assign a category to a specific module (Restaurant, Pool Snack Bar, etc.).

68. Can categories have time-based availability (e.g., "Breakfast" only 6-11 AM)? Show config.

69. Show a category on the customer-facing menu. Does it match admin settings?

70. Can you bulk move items from one category to another? Show the feature.

### Menu Display & Ordering

71. Show how to set the display order of menu items within a category.

72. Is ordering done by drag-and-drop, manual number input, or automatic (alphabetical, price)?

73. Show the reordering interface in action (screenshot or code path).

74. Can you preview how the menu looks to customers? Show the preview feature.

75. Show how to publish changes. Is there a "Save Draft" vs "Publish" workflow?

---

## Section 3: Inventory Management - Deep Dive (60 Questions)

### Inventory Items Setup

76. Where do you access inventory management in the admin panel? Exact path.

77. Show the inventory items list page. What columns are shown?

78. Click "Add New Inventory Item". Show the complete form.

79. What fields are required (item name, unit of measure, etc.)?

80. Show how to set the unit of measure (kg, g, L, ml, pcs). Is it a dropdown?

81. Can you define custom units of measure? Show how.

82. Show how to set conversion ratios (e.g., 1 kg = 1000 g). Is this automatic or manual?

83. Show how to enter the current stock quantity. Where is this field?

84. Show how to set minimum stock threshold (reorder point).

85. Show how to set maximum stock level (for perishables).

86. Show how to assign an item to a storage location (kitchen, bar, warehouse).

87. Can you create new storage locations on-the-fly? Show workflow.

88. Show how to enter supplier information (supplier name, cost, lead time).

89. Can you add multiple suppliers for one item? Show the interface.

90. Show how to set item cost/purchase price. Is it per unit?

91. Show how to track expiry dates. Is there a field for this?

92. Can you set shelf life (e.g., "30 days from receipt")? Show configuration.

93. Show how to add barcode or SKU. Is there a barcode generator?

94. Can you upload an image for the inventory item? Show the upload field.

95. Show how to categorize inventory items (raw ingredients, finished goods, consumables).

### Stock Movements & Adjustments

96. Show how to record a manual stock adjustment (add/remove inventory).

97. When adjusting stock, is a reason required? Show the reason dropdown/field.

98. Show the stock movement history for one item. What details are logged?

99. Can you filter stock movements by type (purchase, sale, waste, transfer)? Show filters.

100. Show how to record inventory waste/spoilage. What fields are captured?

101. Are waste reasons predefined (spoilage, breakage, theft) or freeform? Show options.

102. Show how to transfer inventory between locations (kitchen → bar).

103. For transfers, is there a two-step process (send/receive) or one-step? Show workflow.

104. Show how to record a supplier delivery (receiving stock).

105. When receiving stock, can you enter actual quantity vs ordered quantity? Show comparison.

106. Show how to record cost per delivery. Does it update average cost?

107. Can you attach documents to a delivery (invoice, delivery note)? Show upload.

108. Show the current stock report. Can you export it to CSV/Excel?

109. Show a stock movement ledger/audit trail. Is every movement logged?

110. Can you filter the audit trail by date, user, item, or movement type?

### Bill of Materials (BOM) / Recipes

111. Show where you create recipes/BOMs. Is it part of menu items or separate?

112. Click "Create Recipe" for a menu item (e.g., "Burger"). Show the form.

113. Show how to add ingredients to a recipe. Is it a list builder?

114. For each ingredient, show how to specify quantity needed (e.g., "100g beef").

115. Can you select the unit for each ingredient (different from storage unit)? Show conversion.

116. Show how to add sub-recipes (e.g., "Special Sauce" contains mayo + ketchup).

117. Can sub-recipes be nested multiple levels deep? Show an example.

118. Show how to specify recipe yield (e.g., "Makes 1 burger" or "Makes 4 servings").

119. Show how the system calculates cost per recipe based on ingredient costs.

120. When an order is placed, show proof that inventory is auto-deducted per the recipe.

121. Show the inventory movements created when a "Burger" is ordered. Are ingredients deducted?

122. Can you override auto-deduction for specific items? Show configuration.

123. Show how to handle menu item modifiers in recipes (e.g., "Extra cheese" adds 30g cheese).

124. Does adding a modifier correctly update the BOM and deduct extra inventory? Verify.

125. Show a recipe cost analysis report (ingredient costs, total cost, margin).

126. Can you set a target cost percentage and get alerts if exceeded? Show feature.

127. Show how to update ingredient costs. Does it recalculate recipe costs automatically?

128. Can you view recipe profitability (sale price - cost = margin)? Show report.

129. Show how to duplicate a recipe to create variations. Is there a "Clone" button?

130. Can recipes be versioned (track changes over time)? Show version history.

### Inventory Reports & Alerts

131. Show the low stock alert dashboard. What items are flagged?

132. Can admins configure alert thresholds per item? Show where to set this.

133. Show the expiring items report. How far ahead does it look (7 days, 30 days)?

134. Can you configure expiry alert timing? Show the setting.

135. Show how to generate a stocktaking report for physical counts.

---

## Section 4: Chalet & Room Booking Configuration (50 Questions)

### Chalet/Unit Setup

136. Where do you manage chalets/rooms in the admin panel? Show the path.

137. Show the chalets list page. What information is displayed (name, capacity, status)?

138. Click "Add New Chalet". Show the complete form with all fields.

139. What fields are required to create a chalet?

140. Show how to enter chalet name in multiple languages.

141. Show how to enter description in multiple languages.

142. Show how to set capacity (number of guests). Is it one field or min/max?

143. Can you set different pricing for different guest counts? Show configuration.

144. Show how to upload chalet images. Can you set a featured image?

145. Show how to reorder/delete images. Is there a gallery manager?

146. Show how to add amenities (WiFi, AC, Pool View, etc.). Checkboxes or tags?

147. Can you create custom amenities on-the-fly? Show how.

148. Show how to set base price per night.

149. Show how to set different prices for weekdays vs weekends. Is this automatic?

150. Show how to configure seasonal pricing (peak season, off-season).

151. For seasonal pricing, show the date range selector. Can you have multiple seasons?

152. Show how to set holiday pricing (Christmas, New Year, local holidays).

153. Can you import holiday calendars or define them manually? Show interface.

154. Show how to set minimum stay requirements (e.g., "2 nights minimum").

155. Can minimum stay vary by season or day of week? Show configuration.

156. Show how to set maximum stay limits.

157. Show how to configure advance booking window (e.g., "Book up to 365 days ahead").

158. Show how to set cancellation policies (free cancel 7 days before, etc.).

159. Can you create multiple cancellation policies and assign to different chalets? Show.

160. Show how to set deposit requirements. **This is critical - verify actual implementation.**

### Deposit & Payment Configuration

161. **CRITICAL**: Show where to configure deposit percentage (e.g., "20% deposit required").

162. Is deposit configurable per chalet or global? Show the setting location.

163. Show the exact field where you enter deposit percentage (10%, 20%, 50%, etc.).

164. **Customer Verification**: Book a chalet as a customer. Is deposit actually calculated and charged?

165. Show the booking confirmation screen. Does it display: "Deposit: $X, Due at Booking: $Y"?

166. Show the Stripe payment intent creation. Is the deposit amount sent to Stripe or full amount?

167. After deposit payment, show the booking record. What's the payment status?

168. Show where the remaining balance is displayed to the customer.

169. Can customers pay the remaining balance later? Show the payment flow.

170. When is the remaining balance due? Is this configurable (on arrival, 7 days before, etc.)?

171. Show the admin view of a booking with deposit paid. What payment info is shown?

172. Can admins manually mark remaining balance as paid? Show the button/workflow.

173. If a customer cancels after paying deposit, show the refund logic. Is deposit refunded or forfeited per policy?

174. **Code Verification**: Show the exact code that calculates deposit amount in booking creation.

175. **Code Verification**: Show the webhook handler for deposit payment confirmation.

### Booking Calendar & Availability

176. Show the booking calendar view in admin panel. Can you see all bookings at a glance?

177. Show how to block dates manually (maintenance, private event, etc.).

178. Can you block specific chalets or all chalets? Show the interface.

179. Show how to add notes to blocked dates (reason for unavailability).

180. Can customers see blocked dates as unavailable? Verify on customer-facing calendar.

181. Show how to set cleaning/turnaround time between bookings (e.g., "4 hours between guests").

182. Does the system enforce turnaround time? Test by trying to book back-to-back slots.

183. Show the check-in/check-out time configuration (e.g., "Check-in after 3 PM").

184. Can check-in times vary by chalet? Show configuration.

185. **Customer Verification**: Does the booking form display check-in/check-out times? Show proof.

---

## Section 5: Pool & Activity Booking Configuration (40 Questions)

### Pool Session Setup

186. Where do you manage pool sessions in the admin panel? Show the path.

187. Show the pool configuration page. What settings are available?

188. Show how to set pool capacity (maximum guests per session).

189. Can capacity vary by time slot (morning vs afternoon)? Show configuration.

190. Show how to define time slots (9 AM - 12 PM, 1 PM - 4 PM, etc.).

191. Can you create custom time slots or are they fixed? Show the interface.

192. Show how to set session duration (e.g., "3 hours per session").

193. Show how to price pool sessions. Is it per person or per session?

194. Can pricing vary by age group (adult, child, infant)? Show configuration.

195. Show how to set age brackets for pricing (e.g., "Child: 3-12 years").

196. Show where to configure gender-specific sessions (ladies only, men only, mixed).

197. **Customer Verification**: Can customers actually filter by gender preference? Show booking form.

198. Show how to set advance booking rules (book 24 hours ahead, 7 days max, etc.).

199. Show how to enable/disable pool bookings (maintenance mode).

200. When pool is disabled, what message do customers see? Show the UI.

201. Show the pool booking calendar. Can you see all sessions and capacity?

202. For a specific session, show how to view booked guests and available spots.

203. Can admins manually add/cancel pool bookings? Show the workflow.

204. Show how to issue QR code tickets for pool entry.

205. Show the QR code scanning interface for staff. Is it mobile-friendly?

206. When a QR code is scanned, what information is displayed (guest name, session, etc.)?

207. Can you track pool capacity in real-time (how many guests currently inside)? Show dashboard.

208. Show the check-in process. Does scanning QR code increment the occupancy counter?

209. Show the check-out process. How do guests check out?

210. Can you generate pool attendance reports (by session, by date)? Show report.

211. Show how to configure pool rules/policies displayed to customers.

212. Can you upload images of the pool? Show the image manager.

213. Show how to add amenities for the pool (towels, lockers, shower, etc.).

214. Can you charge for additional amenities (locker rental, towel fee)? Show configuration.

215. Show how to set cancellation policy for pool bookings.

216. **Customer Verification**: Book a pool session. Is cancellation policy displayed?

217. **Customer Verification**: Receive QR code. Can you actually scan it on the staff app?

218. Show the staff view of pool capacity. Is it updated in real-time via WebSocket?

219. If pool capacity is full, can customers join a waitlist? Show the feature.

220. Show how waitlist works. Are customers auto-notified when spots open?

221. Show how to set pool closing dates (winter closure, maintenance, etc.).

222. Can you configure recurring closures (e.g., "Closed every Tuesday")? Show interface.

223. Show the pool revenue report. Does it break down by session, day, month?

224. Can you export pool booking data to CSV? Show the export feature.

225. Show how to configure pool safety rules/disclaimers shown during booking.

---

## Section 6: Pricing & Discounts Management (50 Questions)

### Dynamic Pricing Configuration

226. Show where to configure dynamic pricing rules in admin panel.

227. Show how to set weekday pricing (Monday-Thursday vs Friday-Sunday).

228. Can you configure custom weekly schedules (e.g., Wednesday is also weekend rate)? Show.

229. Show the seasonal pricing interface. How do you define seasons?

230. For each season, show how to set a pricing multiplier (e.g., "1.5x base price").

231. Show how to set date ranges for seasons (e.g., "Peak: Dec 15 - Jan 15").

232. Can seasons overlap? If yes, which takes precedence? Show the logic.

233. Show how to configure holiday pricing (specific dates with custom multipliers).

234. Can you import a holiday calendar or must you enter dates manually? Show interface.

235. Show how to set occupancy-based pricing (higher rates when 80%+ booked).

236. **Code Verification**: Show the exact code that calculates occupancy-based pricing.

237. **Customer Verification**: Book when occupancy is high. Is price actually higher? Verify.

238. Show how to set early bird discounts (book 30+ days ahead = 10% off).

239. Show how to set last-minute discounts (book within 7 days = 20% off).

240. Can early bird and last-minute rules be active simultaneously? Show configuration.

241. Show how pricing rules are prioritized (which rule applies first?).

242. Can you preview calculated prices for a specific date range? Show the calculator.

243. **Customer Verification**: Check prices on customer-facing calendar. Do they match admin config?

### Coupon & Discount Management

244. Where do you create discount coupons in the admin panel? Show the path.

245. Click "Create Coupon". Show the complete form with all fields.

246. Show how to set coupon code (auto-generate or manual entry).

247. Show how to set discount type (percentage or fixed amount).

248. For percentage discounts, show how to set the percentage value.

249. For fixed discounts, show how to set the amount and currency.

250. Show how to set minimum order/booking value for coupon eligibility.

251. Show how to set maximum discount cap (e.g., "Max $50 discount").

252. Show how to restrict coupons to specific items/categories. Is it a multi-select?

253. Show how to restrict coupons to specific services (restaurant only, bookings only, etc.).

254. Show how to set coupon validity dates (start date, end date).

255. Show how to set usage limits (total uses, per-user uses).

256. Can you set coupon to be single-use per customer? Show toggle.

257. Show how to configure stackability (can multiple coupons be used together?).

258. Show how to generate bulk coupons (e.g., "100 codes for 10% off").

259. Can you export coupon codes to CSV? Show the export feature.

260. Show the coupon usage report. What data is shown (uses, revenue impact, etc.)?

261. **Customer Verification**: Apply a coupon during checkout. Is discount actually applied?

262. **Customer Verification**: Try to use expired coupon. Is it rejected with proper error?

263. **Customer Verification**: Try to use coupon below minimum order value. What happens?

264. Show how to deactivate a coupon without deleting it.

265. Show the coupon audit trail. Who created it, when, how many uses?

266. Can you clone an existing coupon to create a variation? Show the feature.

267. Show how to set automatic discounts (applied without code entry).

268. For automatic discounts, show how to set conditions (new customers, loyalty tier, etc.).

269. **Code Verification**: Show the code that validates and applies coupons during checkout.

270. **Code Verification**: Show the database record of a discount applied to an order.

### Gift Card Management

271. Where do you manage gift cards in admin panel? Show the path.

272. Show how to issue a new gift card. What fields are required?

273. Show how gift card codes are generated (format, length, character set).

274. Can you manually specify a gift card code or is it auto-generated? Show option.

275. Show how to set gift card value/balance.

---

## Section 7: CMS & Content Management (40 Questions)

### Homepage Configuration

276. Show where to edit homepage content in admin panel. Exact path.

277. **Critical from Planning.md**: Show how to upload background hero image for homepage.

278. Is hero image upload a simple file picker or image editor? Show the interface.

279. Can you set different hero images for different languages? Show configuration.

280. Show how to edit homepage headline/tagline in multiple languages.

281. Show the homepage section manager. What sections are available?

282. **Critical from Planning.md**: Can you reorder homepage sections by drag-and-drop? Show proof.

283. Show the section ordering interface in action. Does it persist correctly?

284. **Customer Verification**: Reorder sections in admin, then view homepage. Does order match?

285. Show how to add a new section to homepage (featured items, testimonials, etc.).

286. Can sections be enabled/disabled without deleting them? Show toggle.

287. **Critical from Planning.md**: Show the CTA (Call-to-Action) section configuration.

288. For CTA, show what's editable (text, button label, button link, background color).

289. **Customer Verification**: Edit CTA in admin, then check homepage. Does it update?

290. Show how to add promotional banners to homepage. Is there a banner manager?

291. Can banners be scheduled (show from X date to Y date)? Show scheduling interface.

292. Show how to configure homepage widgets (weather, upcoming events, special offers).

293. **Critical from Planning.md**: Show weather widget configuration. Where to add API key?

294. What weather APIs are supported (OpenWeather, WeatherAPI, etc.)? Show dropdown.

295. **Customer Verification**: Add weather API key, then check homepage. Does widget appear?

296. Show how to configure "featured items" section (auto or manual selection).

297. For manual featured items, show the item picker interface.

298. Show preview functionality. Can you see homepage before publishing? Show preview mode.

299. Show how to save as draft vs publish immediately. Are there version controls?

300. Can you schedule homepage changes to go live at a future date/time? Show scheduling.

### Footer Management

301. **Critical from Planning.md**: Show where to edit footer links in admin panel.

302. Are footer links editable via CMS or hardcoded? Show proof.

303. Show the footer link manager. Can you add/edit/delete links?

304. For each footer link, show what's editable (text, URL, open in new tab, icon).

305. Can footer links be organized into columns/sections? Show the grouping interface.

306. Show how to reorder footer links. Is it drag-and-drop or manual ordering?

307. **Critical from Planning.md**: Show where to edit contact information in footer.

308. For contact info, what fields are available (email, phone, address, social media)?

309. Can you add social media links with icons? Show the icon picker.

310. **Customer Verification**: Edit footer in admin, then check any page. Does it update?

311. Show how to edit copyright text in multiple languages.

312. Can you add custom footer sections (newsletter signup, certifications, etc.)? Show how.

313. Show how to upload logo for footer. Can it be different from header logo?

314. Show footer display settings (show/hide on specific pages, background color, etc.).

315. Can you configure footer to be different per language? Show configuration.

---

## Section 8: Theme & Branding Configuration (35 Questions)

### Theme Selection & Customization

316. Where do you access theme settings in admin panel? Show the path.

317. Show the theme selector. Are all 6 themes displayed with previews?

318. Click on a theme to activate it. Is there a live preview before applying?

319. **Critical from Planning.md**: Show how to override theme colors.

320. For color customization, show the color picker interface. Can you enter hex codes?

321. Show the list of customizable colors (primary, secondary, accent, background, text, etc.).

322. **Customer Verification**: Change primary color in admin, then check customer site. Does it update?

323. **Critical from Planning.md**: Show how to add a new custom theme (not just modify existing).

324. For custom theme creation, show the theme builder interface. What's configurable?

325. Can you set custom fonts for your theme? Show the font selector.

326. Are Google Fonts supported? Show the font library.

327. Can you upload custom fonts? Show the upload interface.

328. Show how to configure button styles (rounded, square, shadows, etc.).

329. Show how to set spacing/padding defaults for the theme.

330. Can you configure dark mode for your theme? Show the dark mode settings.

331. Show how to upload logo. Are there size requirements/recommendations?

332. Can you upload different logos for light and dark themes? Show configuration.

333. Show how to upload favicon. Is it auto-generated in multiple sizes?

334. Can you export a custom theme to reuse in other instances? Show export feature.

335. Can you import theme JSON files? Show import interface.

336. Show theme preview mode. Can you preview changes before publishing?

337. Show how to save theme changes. Is there "Save Draft" vs "Publish"?

338. Show theme version history. Can you roll back to previous theme?

339. **Customer Verification**: Apply Beach Paradise theme. Does entire site update correctly?

340. **Customer Verification**: Apply Midnight Oasis theme. Test all pages for visual consistency.

### Visual Effects Configuration

341. **Critical from Planning.md**: Show where to configure visual effects (snow, rain, leaves, fireflies).

342. For each effect, show the enable/disable toggle.

343. Can you configure effect intensity (light, medium, heavy)? Show the slider.

344. Can you schedule effects for specific seasons/dates? Show scheduling interface.

345. **Customer Verification**: Enable snow effect. Does it actually appear on customer site?

346. Show how to configure animation preferences (enable/disable all animations).

347. **Critical from Planning.md**: Is the "Animations and Performance" tab actually useful now or removed?

348. If it exists, show what settings are available in Animations and Performance tab.

349. Can you configure page transition effects? Show the options.

350. Show how to set loading animation (spinner style, color, etc.).

---

## Section 9: Staff & User Management (40 Questions)

### User Roles & Permissions

351. Where do you manage users in admin panel? Show the path.

352. Show the users list page. What columns are displayed (name, role, status, last login)?

353. Can you filter users by role (admin, manager, staff, customer)? Show filters.

354. Show the "Create New User" form. What fields are available?

355. Show how to assign a user role. Is it a dropdown or checkbox list?

356. What roles are available by default? List them all (super admin, admin, manager, waiter, kitchen, etc.).

357. Can you create custom roles? Show the custom role creation interface.

358. For custom roles, show how to assign granular permissions.

359. Show the permissions list. What permissions exist (create orders, refund payments, view reports, etc.)?

360. Show how to assign permissions to a role (checkboxes, multi-select, etc.).

361. **Critical from Planning.md**: Show the permission editing popup. Is it positioned correctly (center of screen)?

362. In the permission editor, are all permissions actually loading and visible? Show proof.

363. **Critical from Planning.md**: Show how to edit permissions for a specific user (not role).

364. Can individual users have permissions that override their role? Show configuration.

365. Show how to activate/deactivate a user account. Is it a toggle?

366. **Critical from Planning.md**: Is the account active toggle correctly styled (white circle stays in bounds)?

367. When creating an admin account, show the role selection. Does it actually create as admin?

368. **Customer Verification**: Create an admin account. Log in as that user. Do they have admin access?

369. **Critical from Planning.md**: Show the "Live Users" system. How many users are currently online?

370. Is the live user count accurate (not counting each user 3 times)? Show proof.

371. Show how to manually log out a user/force session termination.

372. Show the user activity log. What events are tracked (login, logout, actions)?

373. Can you search/filter the activity log? Show the search interface.

### Staff Shifts & Scheduling

374. Where do you manage staff shifts in admin panel? Show the path.

375. Show the shift creation form. What fields are required (user, start time, end time, role)?

376. Can you create recurring shifts (e.g., "Monday-Friday, 9 AM - 5 PM")? Show recurrence options.

377. Show the shift calendar view. Can you see all scheduled shifts at a glance?

378. Can staff clock in/out via the admin panel or mobile app? Show the interface.

379. Show the timesheet/hours worked report for a staff member.

380. Can you track breaks during shifts? Show how breaks are logged.

381. Show how to assign multiple staff to a shift (team shifts).

382. Show the shift approval workflow. Do managers need to approve shifts?

383. Can staff request shift swaps? Show the swap request interface.

384. Show how to calculate payroll data from shift hours. Is there an export feature?

385. Can you set different pay rates for different roles/times (overtime, night shift)? Show config.

386. Show the staff performance metrics. What KPIs are tracked (orders handled, avg time, etc.)?

387. **Critical from Analysis**: Show the "Orders handled per staff screen" report.

388. **Critical from Analysis**: Show the "Average handling time per role" report.

389. Can you track tips per staff member? Show the tip logging interface.

390. Show the tip pooling configuration. How are tips distributed?

---

## Section 10: Reports & Analytics Access (40 Questions)

### Dashboard & Key Metrics

391. Show the main admin dashboard. What metrics are displayed on first glance?

392. **Critical from Planning.md**: Is there an "Executive Overview" dashboard as specified?

393. On the dashboard, show the following metrics if they exist:
    - Total Revenue (today / MTD / YTD)
    - Net Revenue (after refunds, discounts, fees)
    - Orders Count & Growth %
    - Average Order Value (AOV)
    - Active Customers
    - System Health Indicators

394. Are these metrics updated in real-time or on page refresh? Show the update mechanism.

395. Can you customize which widgets appear on your dashboard? Show customization interface.

396. Can you set date ranges for dashboard metrics (today, this week, this month, custom)? Show date picker.

397. Show the revenue chart on dashboard. Is it a line graph, bar chart, or both?

398. Can you switch between chart types (line, bar, area)? Show the toggle.

399. Show how to drill down from dashboard metrics (e.g., click "Total Revenue" to see details).

400. Can you export dashboard data to PDF/CSV? Show the export button.

### Sales & Revenue Reports

401. **Critical from Planning.md**: Where do you access "Sales & Revenue Analytics" report?

402. Show the report. Can you break down revenue by:
    - Time period (hourly, daily, weekly, monthly)? Show the selector.
    - Service type (dine-in, takeaway, delivery, booking)? Show filters.
    - Location/branch? Show location filter.

403. **Critical from Analysis**: Show "Revenue per Seat/Table/Unit" calculation. Is it implemented?

404. **Critical from Analysis**: Show "Peak vs Off-Peak Revenue" analysis. How is peak/off-peak defined?

405. **Critical from Planning.md**: Show "Discount Impact Report". Does it show cost of discounts?

406. For discount impact, show: discounts given, revenue lost, impact on margin.

407. Can you export this report to CSV/Excel? Show the export button.

### Operations Reports

408. **Critical from Planning.md**: Show "Order Flow & Operations" report. Does it exist?

409. Show the following metrics if available:
    - Order Preparation Time (average, median, outliers)
    - Orders per Hour (load analysis)
    - Bottleneck Detection

410. **Critical from Planning.md**: Show "Order Status Conversion Funnel" visualization.

411. Is the funnel interactive (click to drill down)? Test it.

412. **Critical from Analysis**: Show "Cancelled/Abandoned Orders" report with reasons.

413. For cancelled orders, are cancellation reasons categorized or freeform? Show data.

414. Show alerts for SLA breaches (orders taking too long). Is there an alert system?

415. Can you set custom SLA thresholds (e.g., "Alert if prep time > 30 mins")? Show config.

### Customer Intelligence Reports

416. **Critical from Planning.md**: Show "Customer Intelligence" report/dashboard.

417. Show the following metrics if available:
    - New vs Returning Customers
    - Customer Retention Rate (7/30/90 days)
    - Customer Lifetime Value (CLV)

418. **Critical from Analysis**: How is CLV calculated? Show the formula or code.

419. Show "Top Customers by Revenue" list. Can you click to see customer details?

420. Show "Top Customers by Frequency" list.

421. **Critical from Planning.md**: Show "Churned Customers" report. How is churn defined?

422. Can you configure churn definition (e.g., "Inactive for 90 days")? Show setting.

423. Show customer segmentation (high-value, at-risk, loyal, new). Is this automatic or manual?

424. Can you export customer lists for marketing campaigns? Show export feature.

425. Does the export comply with GDPR (consent tracking)? Show data protection features.

### Product Performance Reports

426. **Critical from Planning.md**: Show "Product & Menu Performance" report.

427. Show "Top Selling Items" list. Is it by volume or revenue? Can you switch?

428. Show "Worst Performing Items" list. How is "worst" determined?

429. **Critical from Planning.md**: Show "Attach Rate" (items ordered together) analysis.

430. Is attach rate used to suggest combos or bundles? Show recommendations.

---

## Section 11: Payment & Financial Configuration (40 Questions)

### Stripe Integration Setup

431. Where do you configure Stripe in admin panel? Show the settings page.

432. Show the fields for Stripe API keys (publishable, secret, webhook secret).

433. Are test and live modes clearly separated? Show the mode toggle.

434. Show where to view Stripe connection status (connected, disconnected, error).

435. Can you test the Stripe connection? Show the "Test Connection" button.

436. **Critical from Analysis**: Show where to enable Stripe Radar for fraud detection.

437. Is Stripe Radar a simple toggle or does it require additional setup? Show the interface.

438. **Critical from Analysis**: Show where to configure 3D Secure (SCA) requirements.

439. Can you set 3D Secure rules (amount threshold, risk level)? Show configuration.

440. Show the webhook endpoint URL that should be entered in Stripe dashboard.

441. Can you view webhook delivery logs? Show the webhook log viewer.

442. Show failed webhook attempts and retry status.

443. Can you manually trigger webhook replay for failed events? Show the feature.

444. Show the payment method configuration. Which methods are enabled (card, wallet, etc.)?

445. Can you enable Apple Pay and Google Pay? Show the toggles.

446. Show where to configure payment currency. Can you support multiple currencies?

447. Show the accepted card brands configuration (Visa, Mastercard, Amex, etc.).

448. Can you set minimum/maximum payment amounts? Show the limits.

449. Show where to configure payment confirmation email template.

450. Can you customize the payment receipt? Show the template editor.

### Payment Reports & Reconciliation

451. **Critical from Planning.md**: Show "Payments & Finance" report dashboard.

452. Show revenue breakdown by payment method (card, cash, gift card, loyalty points).

453. Show failed/refunded payments report. What details are captured?

454. Show outstanding payments report (unpaid orders/bookings).

455. **Critical from Planning.md**: Show "Cash vs Digital Payment Ratio" chart.

456. **Critical from Planning.md**: Show "Stripe Fees & Net Payouts" calculation.

457. Is Stripe fee automatically calculated or entered manually? Show the logic.

458. **Critical from Planning.md**: Show "Daily Reconciliation Report". What's included?

459. Can you generate end-of-day Z-report? Show the report generator.

460. For Z-report, show what's included (sales by type, taxes, refunds, net amount).

461. Show the cash drawer management interface. Can you record opening/closing balance?

462. Show how to record cash drops during shift.

463. Show the variance report (expected vs actual cash). Is variance highlighted?

464. Can you add notes to explain variances? Show the notes field.

465. Show the payment ledger/transaction history. Can you filter by date, type, status?

466. Can you export financial data for accounting software (QuickBooks, Xero)? Show export formats.

467. Show the refund processing interface. What approvals are required?

468. For refunds, can you specify partial or full amount? Show the amount input.

469. Show the refund reason dropdown. What reasons are available?

470. Is there an audit trail for all financial transactions? Show the audit log.

---

## Section 12: Module Builder Usage (30 Questions)

### Creating Custom Modules

471. **Critical from Planning.md**: Where is the module builder in admin panel? Show exact location.

472. Is the module builder button prominent or hidden? Show its placement in UI.

473. Click "Create New Module". Show the complete module builder interface.

474. Show the module configuration form. What fields are required (name, icon, route, etc.)?

475. Can you enter module name in multiple languages? Show the multi-language input.

476. Show how to select an icon for the module. Is it from an icon library or upload?

477. Show how to define the module route/URL (e.g., `/custom-service`).

478. Can you set module permissions (which roles can access)? Show permission settings.

479. Show how to configure module visibility (show in main menu, customer app, staff app).

480. **Critical from Planning.md**: Show where to toggle "show_in_main" for module.

481. **Verification**: Create a module, enable it, toggle "show_in_main". Does it appear in menu?

482. **Critical from Planning.md**: Show where to change module visibility after creation.

483. **Verification**: Try to make a visible module invisible. Does the change persist?

484. **Critical from Planning.md**: Try to make an invisible module visible. Does it actually show?

485. Show the module builder's field designer. Can you add custom fields?

486. For custom fields, show what field types are available (text, number, date, dropdown, etc.).

487. Show how to set field validation rules (required, min/max length, etc.).

488. Can you define custom workflows for the module (statuses, transitions)? Show the workflow builder.

489. Show how to configure module-specific pricing/booking rules.

490. Can you link the module to inventory (items consumed)? Show the linkage interface.

491. Show how to set module display settings (layout, theme, colors).

492. Show the module preview feature. Can you test the module before publishing?

493. **Verification**: Create a complete custom module and test it end-to-end as a customer.

494. Can you clone an existing module to create a variation? Show the clone feature.

495. Can you export module configuration to reuse elsewhere? Show export option.

496. Show the list of all custom modules created. Can you edit/delete them?

497. When editing a module, are active bookings/orders affected? Show version control.

498. Can you deactivate a module without deleting it? Show the deactivate toggle.

499. Show the module analytics. Can you track usage, revenue per module?

500. **Critical from Planning.md**: Does module management scale properly on smaller screens (mobile/tablet)?

---

## Section 13: Notifications & Communications (30 Questions)

### Email Templates & Configuration

501. Where do you manage email templates in admin panel? Show the path.

502. Show the list of email templates. What templates exist (order confirmation, booking confirmation, password reset, etc.)?

503. Click to edit an email template. Show the template editor.

504. Can you edit email subject line in multiple languages? Show the multi-language fields.

505. Can you edit email body in multiple languages? Show the editor for each language.

506. Is the email editor WYSIWYG or plain text/HTML? Show the editor type.

507. Show the available variables/placeholders (customer name, order details, etc.).

508. Can you preview email with sample data? Show the preview feature.

509. Can you send a test email to yourself? Show the "Send Test" button.

510. Show where to configure "From" name and email address for automated emails.

511. Can you customize email header (logo, colors)? Show the branding settings.

512. Can you customize email footer? Show the footer editor.

513. Show where to configure SendGrid API key.

514. Can you test the SendGrid connection? Show the test interface.

515. Show the email delivery log. Can you see sent, failed, bounced emails?

516. For failed emails, can you retry sending? Show the retry button.

517. Can you schedule emails to send at specific times? Show scheduling feature.

518. Show the email analytics (open rate, click rate, bounce rate). Is this tracked?

519. Can you create custom email templates for specific events? Show template creator.

520. Show where to configure email sending limits (rate limiting to prevent spam).

### Push Notifications & In-App Alerts

521. Where do you configure push notifications? Show the settings page.

522. Show what events trigger notifications (order status, booking confirmation, payment success, etc.).

523. Can you customize notification messages? Show the message editor.

524. Can you enable/disable specific notification types? Show the toggles.

525. Show where to configure notification preferences per user role (staff vs customers).

526. Can customers opt-in/out of notifications? Show the preference center.

527. **Critical from Planning.md**: Show the notifications bell in staff interface.

528. **Verification**: Can you actually click and open the notifications bell? Does it work?

529. Show the notifications list. What information is displayed (message, timestamp, read status)?

530. Can you mark notifications as read/unread? Show the interaction.

---

## Section 14: Business Logic Verification - Customer vs Backend (50 Questions)

### Booking System - Deposit Logic

531. **Critical Test**: Admin sets "30% deposit required" for chalets. Save the setting.

532. **Customer Test**: As a customer, book a chalet worth $100. What's the deposit amount shown?

533. **Expected**: $30 deposit. **Actual**: [Show screenshot of booking confirmation]

534. **Code Verification**: Show the JavaScript code that calculates deposit on frontend.

535. **Code Verification**: Show the backend code that validates deposit amount.

536. **Stripe Verification**: Show the Payment Intent created. Is amount $30 or $100?

537. **Database Verification**: After booking, show the booking record. What's stored in `deposit_amount` field?

538. **Customer Test**: Try to modify deposit amount via browser dev tools. Is it rejected?

539. **Edge Case**: Set deposit to 100%. Customer should pay full amount upfront. Verify.

540. **Edge Case**: Set deposit to 0%. Customer should pay on arrival. Verify.

### Booking System - Cancellation Policy

541. **Admin Setup**: Set cancellation policy: "Free cancel 7 days before, 50% refund 3-7 days, no refund <3 days".

542. **Customer Test**: Book a chalet 10 days ahead, cancel immediately. Is refund 100%?

543. **Customer Test**: Book a chalet, wait 4 days, then cancel (3 days before check-in). Is refund 50%?

544. **Customer Test**: Book a chalet, try to cancel 2 days before. Is refund 0%?

545. **Code Verification**: Show the code that enforces cancellation policy.

546. **Database Verification**: Show the refund record. Does amount match policy?

547. **Stripe Verification**: Show the refund in Stripe dashboard. Does amount match?

548. **Customer Display**: Is cancellation policy shown BEFORE booking confirmation? Show proof.

549. **Edge Case**: What if customer cancels exactly 7 days before (boundary case)? Test it.

550. **Edge Case**: What if policy isn't set? Is there a default policy? Show the fallback.

### Pricing - Seasonal Multipliers

551. **Admin Setup**: Set "Peak Season: Dec 15 - Jan 15, Price Multiplier: 1.5x".

552. **Admin Setup**: Set base price for chalet: $100/night.

553. **Customer Test**: Check chalet price on Dec 20. Is it $150/night?

554. **Customer Test**: Check chalet price on Jan 10. Is it $150/night?

555. **Customer Test**: Check chalet price on Jan 20 (outside peak season). Is it $100/night?

556. **Code Verification**: Show the code that applies seasonal multipliers.

557. **Edge Case**: Booking spans peak and off-peak (Dec 14-16). How is price calculated?

558. **Expected**: Dec 14 = $100, Dec 15-16 = $150 each. **Actual**: [Show calculation]

559. **Database Verification**: Show the pricing breakdown in booking record.

560. **Customer Display**: Is seasonal pricing explained on the booking page? Show the UI.

### Pricing - Weekday/Weekend Rates

561. **Admin Setup**: Set "Weekend Multiplier: 1.3x" for Fridays and Saturdays.

562. **Customer Test**: Book for Thursday. Is price base rate?

563. **Customer Test**: Book for Friday. Is price base × 1.3?

564. **Customer Test**: Book for Saturday. Is price base × 1.3?

565. **Customer Test**: Book Thu-Sun (4 nights). Show the pricing breakdown.

566. **Expected**: Thu = $100, Fri = $130, Sat = $130, Sun = $100. **Actual**: [Verify]

567. **Code Verification**: Show the code that determines weekend days.

568. **Edge Case**: Can admin configure custom weekend days (e.g., Thu-Sat for Middle East)? Test it.

569. **Stacking Test**: Peak season (1.5x) + Weekend (1.3x). Are multipliers stacked or max? Verify.

570. **Expected**: If stacked: $100 × 1.5 × 1.3 = $195. If max: $150. **Actual**: [Show result]

### Discounts - Coupon Application

571. **Admin Setup**: Create coupon "SAVE20" for 20% off, minimum order $50.

572. **Customer Test**: Order $40 worth of food, apply SAVE20. Is it rejected?

573. **Customer Test**: Order $60 worth of food, apply SAVE20. Is discount $12 (20% of $60)?

574. **Customer Test**: Apply invalid coupon code "INVALID123". What error message appears?

575. **Code Verification**: Show the coupon validation code.

576. **Database Verification**: After order, show coupon usage record. Is it incremented?

577. **Limit Test**: Set coupon to "Max 5 uses". Use it 5 times, try 6th. Is it rejected?

578. **Expiry Test**: Set coupon to expire yesterday. Try to use it. Is it rejected?

579. **Stacking Test**: Apply two coupons (if stackable). Is total discount correct?

580. **Customer Display**: Is the discount clearly shown in order summary? Show the breakdown.

---

## Section 15: End-to-End Workflow Testing (50 Questions)

### Workflow 1: Adding a New Menu Item from Scratch

581. **Step 1**: Log in as admin. Navigate to menu management. Create category "Burgers".

582. **Step 2**: Add menu item "Classic Burger" to "Burgers" category. Set price $12.

583. **Step 3**: Upload burger image. Add description in English and Arabic.

584. **Step 4**: Add modifiers: "Size" (required): Small (+$0), Medium (+$2), Large (+$4).

585. **Step 5**: Add modifiers: "Add-ons" (optional): Cheese (+$1), Bacon (+$2), Extra Patty (+$3).

586. **Step 6**: Link to inventory. Show the recipe/BOM builder.

587. **Step 7**: Add ingredients: 
    - 150g beef patty
    - 1 bun
    - 50g lettuce
    - 30g tomato
    - 20ml special sauce

588. **Step 8**: Save and publish menu item.

589. **Step 9**: Check customer-facing menu. Is "Classic Burger" visible under "Burgers"?

590. **Step 10**: Customer orders "Classic Burger, Large, Add Cheese and Bacon".

591. **Step 11**: Verify final price calculation:
    - Base: $12
    - Large: +$4
    - Cheese: +$1
    - Bacon: +$2
    - **Total Expected**: $19
    - **Total Actual**: [Show order total]

592. **Step 12**: Check inventory. Are ingredients deducted?
    - Beef: -150g
    - Bun: -1
    - Lettuce: -50g
    - Tomato: -30g
    - Sauce: -20ml
    - Cheese: -30g (for add-on)
    - Bacon: -50g (for add-on)

593. **Step 13**: Show inventory movement records. Are all deductions logged?

594. **Step 14**: Show kitchen display. Does order appear with correct modifiers?

595. **Step 15**: Mark order as complete. Does inventory update finalize?

### Workflow 2: Booking a Chalet with Deposit

596. **Step 1**: Admin sets chalet "Villa Paradise" price $200/night, 25% deposit required.

597. **Step 2**: Admin sets peak season Dec 20-30 with 1.5x multiplier.

598. **Step 3**: Customer books Villa Paradise for Dec 25-27 (2 nights).

599. **Step 4**: Calculate expected price:
    - Base: $200/night
    - Peak multiplier: 1.5x
    - Total: $200 × 1.5 × 2 = $600
    - Deposit (25%): $150
    - **Expected Deposit**: $150

600. **Step 5**: Show booking summary on customer screen. Verify amounts displayed.

601. **Step 6**: Customer pays $150 deposit via Stripe. Show Payment Intent.

602. **Step 7**: Stripe webhook confirms payment. Show webhook log.

603. **Step 8**: Check booking status. Is it "confirmed" or "awaiting payment"?

604. **Step 9**: Check payment status. Is deposit marked as paid?

605. **Step 10**: Show remaining balance displayed to customer: $450.

606. **Step 11**: Customer arrives and pays remaining $450 (cash or card).

607. **Step 12**: Admin marks remaining balance as paid. Show the interface.

608. **Step 13**: Check final booking record. Is total paid = $600?

609. **Step 14**: Show financial report. Is revenue correctly categorized?

610. **Step 15**: Export booking to accounting software. Show the export data.

### Workflow 3: Inventory Receiving and Stock Update

611. **Step 1**: Admin receives delivery of 50kg beef from supplier.

612. **Step 2**: Navigate to inventory management, find "Beef Patty".

613. **Step 3**: Click "Receive Stock". Show the receiving form.

614. **Step 4**: Enter delivery details:
    - Quantity: 50kg
    - Supplier: "Prime Meats Co"
    - Invoice: INV-12345
    - Cost: $500 ($10/kg)
    - Delivery date: Today

615. **Step 5**: Save delivery record. Show confirmation.

616. **Step 6**: Check current stock level. Has it increased by 50kg?

617. **Step 7**: Show inventory movement log. Is delivery recorded?

618. **Step 8**: Show cost update. Is average cost recalculated?

619. **Step 9**: Check menu item (Burger) cost. Does it reflect new ingredient cost?

620. **Step 10**: Generate inventory valuation report. Is beef valued correctly?

### Workflow 4: Handling a Refund

621. **Step 1**: Customer places order #12345 for $80, pays via Stripe.

622. **Step 2**: Customer requests refund due to long wait time.

623. **Step 3**: Admin navigates to order #12345, clicks "Refund".

624. **Step 4**: Show refund interface. Can admin choose partial or full refund?

625. **Step 5**: Admin processes full refund ($80). Show confirmation.

626. **Step 6**: Check Stripe dashboard. Is refund initiated?

627. **Step 7**: Stripe confirms refund via webhook. Show webhook log.

628. **Step 8**: Check order status. Is it marked as "refunded"?

629. **Step 9**: Check inventory. Are ingredients added back to stock or marked as waste?

630. **Step 10**: Show financial report. Is refund deducted from revenue?

---

## Section 16: Code Path Verification for Critical Features (20 Questions)

### Backend Code Paths

631. **Deposit Calculation**: Show the exact file and function that calculates deposit percentage.

632. **Deposit Validation**: Show the code that validates customer cannot bypass deposit requirement.

633. **Seasonal Pricing**: Show the function that applies seasonal multipliers to base price.

634. **Coupon Validation**: Show the code that checks coupon expiry, usage limits, and minimum order.

635. **Inventory Deduction**: Show the RPC or function that deducts stock when order is placed.

636. **BOM Resolution**: Show the code that looks up recipe ingredients for a menu item.

637. **Modifier Pricing**: Show how modifier prices are added to base item price.

638. **Payment Intent Creation**: Show where Stripe Payment Intent is created with correct amount.

639. **Webhook Processing**: Show the webhook handler for `payment_intent.succeeded`.

640. **Refund Processing**: Show the code that initiates Stripe refund and updates database.

### Frontend Code Paths

641. **Price Display**: Show the React component that displays item price with modifiers.

642. **Booking Form**: Show the component that calculates and displays deposit amount.

643. **Coupon Input**: Show the component that allows coupon code entry and validation.

644. **Cart Total**: Show the code that calculates cart subtotal, discounts, tax, and total.

645. **Payment Form**: Show the Stripe Elements integration for card payment.

646. **Order Status**: Show the component that displays real-time order status updates.

647. **Booking Calendar**: Show the calendar component for chalet availability.

648. **Menu Display**: Show the component that renders menu items with images and prices.

649. **Language Switcher**: Show the component that allows language selection.

650. **Theme Selector**: Show the component that applies selected theme to entire site.

---

## Summary & Deliverables Expected

For each section above, GitHub Copilot should provide:

1. **Screenshots or UI Descriptions**: Show actual admin panels, forms, and interfaces
2. **File Paths**: Exact locations of code implementing each feature
3. **Code Snippets**: Relevant functions and logic with line numbers
4. **Database Schemas**: Show relevant table structures and constraints
5. **Customer Verification**: Proof that admin settings actually affect customer experience
6. **Gap Analysis**: Identify features that are configured but don't work, or are hardcoded
7. **Workflow Completion**: Confirm end-to-end processes work as advertised

**Critical Focus**: Verify that business logic shown to customers (prices, deposits, policies) matches what's actually enforced in the backend. No false advertising!

**Ultimate Goal**: Prove the system can be operated by a non-technical resort owner without touching code.

---

**Total Questions**: 650  
**Expected Output**: Comprehensive feature-by-feature walkthrough with proofs  
**Format**: Markdown with code blocks, screenshots references, and verification results  
**Purpose**: Ensure admin panel is functional, CMS features work, and business logic is correctly implemented

