# Action Catalog
## Exhaustive Map of All Actor Actions

**Version:** 1.0  
**Created:** February 2, 2026  
**Purpose:** Document EVERY action each actor type can perform

---

## 📋 Action Documentation Format

Each action is documented with:
- **Name:** Action identifier
- **API Endpoint:** Backend route called
- **Preconditions:** What must be true before action
- **Effects:** What changes after action
- **Cascades:** What other actions/events are triggered
- **Frequency:** How often actors perform this action

---

# 🧳 GUEST ACTIONS (150+ Actions)

## 1. Pre-Arrival Phase

### 1.1 Search & Discovery
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G001 | Search available rooms | `GET /api/v1/rooms/availability` | Valid dates | Returns available rooms | Analytics event logged |
| G002 | View room details | `GET /api/v1/rooms/:id` | Room exists | Returns room info | View tracked for personalization |
| G003 | Compare room types | `GET /api/v1/rooms/types` | None | Returns all room types | None |
| G004 | Check rates | `GET /api/v1/rates` | Valid dates | Returns pricing | Rate parity check triggered |
| G005 | View promotions | `GET /api/v1/promotions/active` | None | Returns active promos | None |
| G006 | Apply promo code | `POST /api/v1/promotions/validate` | Valid code | Returns discount | Usage tracked |
| G007 | View package deals | `GET /api/v1/packages` | None | Returns packages | None |
| G008 | Check loyalty benefits | `GET /api/v1/loyalty/benefits` | Authenticated | Returns tier benefits | None |
| G009 | View amenities | `GET /api/v1/amenities` | None | Returns amenities list | None |
| G010 | Check restaurant menus | `GET /api/v1/restaurants/:id/menu` | Restaurant exists | Returns menu | None |

### 1.2 Booking Creation
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G011 | Create reservation | `POST /api/v1/bookings` | Room available, valid dates | Booking created, room blocked | Inventory updated, confirmation email |
| G012 | Add room to booking | `POST /api/v1/bookings/:id/rooms` | Booking exists, room available | Room added | Inventory updated |
| G013 | Remove room from booking | `DELETE /api/v1/bookings/:id/rooms/:roomId` | Room in booking | Room removed | Inventory released |
| G014 | Select room preferences | `PUT /api/v1/bookings/:id/preferences` | Booking exists | Preferences saved | Housekeeping notified |
| G015 | Add guests to booking | `POST /api/v1/bookings/:id/guests` | Booking exists | Guests added | Registration prepared |
| G016 | Request special amenities | `POST /api/v1/bookings/:id/amenities` | Booking exists | Amenities scheduled | Housekeeping task created |
| G017 | Add dietary requirements | `PUT /api/v1/bookings/:id/dietary` | Booking exists | Requirements saved | Kitchen notified |
| G018 | Request accessibility | `PUT /api/v1/bookings/:id/accessibility` | Booking exists | Needs recorded | Room assignment priority |
| G019 | Add booking notes | `PUT /api/v1/bookings/:id/notes` | Booking exists | Notes saved | Staff alerted |
| G020 | Request late checkout | `POST /api/v1/bookings/:id/late-checkout` | Booking exists | Request created | Approval workflow started |

### 1.3 Payment & Confirmation
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G021 | Add payment method | `POST /api/v1/payments/methods` | Authenticated | Card tokenized | None |
| G022 | Pay deposit | `POST /api/v1/bookings/:id/deposit` | Booking created | Deposit charged | Payment recorded, confirmation sent |
| G023 | Pay full amount | `POST /api/v1/bookings/:id/pay` | Booking created | Full payment | Booking confirmed |
| G024 | Apply gift card | `POST /api/v1/bookings/:id/giftcard` | Valid gift card | Balance applied | Gift card balance reduced |
| G025 | Use loyalty points | `POST /api/v1/bookings/:id/points` | Sufficient points | Points redeemed | Points deducted |
| G026 | Request invoice | `GET /api/v1/bookings/:id/invoice` | Booking exists | Invoice generated | None |
| G027 | View booking confirmation | `GET /api/v1/bookings/:id/confirmation` | Booking confirmed | Confirmation displayed | None |
| G028 | Download confirmation PDF | `GET /api/v1/bookings/:id/confirmation/pdf` | Booking confirmed | PDF generated | None |
| G029 | Share booking details | `POST /api/v1/bookings/:id/share` | Booking exists | Share link created | None |
| G030 | Add to calendar | `GET /api/v1/bookings/:id/ical` | Booking exists | iCal file generated | None |

### 1.4 Pre-Arrival Services
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G031 | Complete pre-registration | `POST /api/v1/mobile-checkin/register` | Booking exists | Registration saved | Check-in expedited |
| G032 | Upload ID document | `POST /api/v1/mobile-checkin/documents` | Pre-reg started | Document stored | Verification queued |
| G033 | Sign digital forms | `POST /api/v1/mobile-checkin/signature` | Pre-reg started | Signature captured | Forms completed |
| G034 | Select room (early) | `POST /api/v1/mobile-checkin/room-select` | Rooms available | Room assigned | Room blocked |
| G035 | Request early check-in | `POST /api/v1/bookings/:id/early-checkin` | Booking exists | Request created | Housekeeping prioritized |
| G036 | Pre-order room service | `POST /api/v1/room-service/pre-order` | Booking exists | Order scheduled | Kitchen notified |
| G037 | Book spa appointment | `POST /api/v1/spa/appointments` | Booking exists | Appointment created | Therapist scheduled |
| G038 | Reserve restaurant table | `POST /api/v1/restaurants/:id/reservations` | Restaurant available | Table reserved | Capacity updated |
| G039 | Book activity | `POST /api/v1/activities/bookings` | Activity available | Activity booked | Capacity updated |
| G040 | Arrange transport | `POST /api/v1/transport/bookings` | Service available | Transport arranged | Driver assigned |

### 1.5 Booking Modifications
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G041 | Modify dates | `PUT /api/v1/bookings/:id/dates` | New dates available | Dates changed | Inventory recalculated, rate adjusted |
| G042 | Upgrade room | `POST /api/v1/bookings/:id/upgrade` | Upgrade available | Room upgraded | Rate difference charged |
| G043 | Downgrade room | `POST /api/v1/bookings/:id/downgrade` | Lower room available | Room downgraded | Refund processed |
| G044 | Extend stay | `POST /api/v1/bookings/:id/extend` | Room available | Stay extended | Additional charges added |
| G045 | Shorten stay | `POST /api/v1/bookings/:id/shorten` | Within policy | Stay shortened | Partial refund if applicable |
| G046 | Cancel booking | `DELETE /api/v1/bookings/:id` | Within cancel policy | Booking cancelled | Refund processed, room released |
| G047 | Request refund | `POST /api/v1/bookings/:id/refund` | Eligible for refund | Refund initiated | Finance workflow |
| G048 | Transfer booking | `POST /api/v1/bookings/:id/transfer` | Booking exists | New guest assigned | Registration updated |
| G049 | Split booking | `POST /api/v1/bookings/:id/split` | Multiple rooms | Bookings separated | Separate folios created |
| G050 | Merge bookings | `POST /api/v1/bookings/merge` | Same guest | Bookings combined | Single folio |

## 2. Check-In Phase

### 2.1 Arrival & Check-In
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G051 | Check in (desk) | `POST /api/v1/checkin` | Booking exists, room ready | Guest checked in | Room status changed, key issued |
| G052 | Mobile check-in | `POST /api/v1/mobile-checkin/complete` | Pre-reg complete, room ready | Guest checked in | Digital key issued |
| G053 | Self-service kiosk check-in | `POST /api/v1/kiosk/checkin` | Booking exists, room ready | Guest checked in | Key dispensed |
| G054 | Request different room | `POST /api/v1/checkin/room-change` | Alternative available | Room swapped | Previous room released |
| G055 | Verify identity | `POST /api/v1/checkin/verify` | Check-in started | Identity confirmed | Compliance logged |
| G056 | Sign registration card | `POST /api/v1/checkin/signature` | Check-in started | Registration signed | Legally binding |
| G057 | Collect room key | `GET /api/v1/keys/:roomId` | Checked in | Key issued | Key log updated |
| G058 | Activate digital key | `POST /api/v1/mobile-keys/activate` | Mobile check-in | Key activated | Door access granted |
| G059 | Add companion to room | `POST /api/v1/rooms/:id/companions` | Checked in | Companion added | Extra key issued |
| G060 | Request welcome amenity | `POST /api/v1/rooms/:id/welcome-amenity` | Checked in | Amenity scheduled | Room service notified |

### 2.2 Room Access
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G061 | Access room with key | `POST /api/v1/mobile-keys/:id/access` | Valid key | Door unlocked | Access logged |
| G062 | Request key replacement | `POST /api/v1/keys/replace` | Lost/broken key | New key issued | Old key deactivated |
| G063 | Share digital key | `POST /api/v1/mobile-keys/:id/share` | Primary guest | Key shared | Access granted to companion |
| G064 | Revoke shared key | `DELETE /api/v1/mobile-keys/:id/share` | Key shared | Access revoked | Key deactivated |
| G065 | Report key issue | `POST /api/v1/support/key-issue` | Key not working | Maintenance ticket | Staff dispatched |

## 3. In-House Phase

### 3.1 Room Services
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G066 | Order room service | `POST /api/v1/room-service/orders` | In-house | Order created | Kitchen receives, delivery scheduled |
| G067 | View room service menu | `GET /api/v1/room-service/menu` | In-house | Menu displayed | None |
| G068 | Modify room service order | `PUT /api/v1/room-service/orders/:id` | Order pending | Order updated | Kitchen notified |
| G069 | Cancel room service order | `DELETE /api/v1/room-service/orders/:id` | Order pending | Order cancelled | Kitchen notified |
| G070 | Rate room service | `POST /api/v1/room-service/orders/:id/rating` | Order delivered | Rating saved | Analytics updated |
| G071 | Request housekeeping | `POST /api/v1/housekeeping/requests` | In-house | Request created | Housekeeping notified |
| G072 | Decline housekeeping | `POST /api/v1/housekeeping/decline` | In-house | DND set | Housekeeping skips room |
| G073 | Request extra amenities | `POST /api/v1/rooms/:id/amenities` | In-house | Request created | Housekeeping delivers |
| G074 | Report room issue | `POST /api/v1/maintenance/issues` | In-house | Ticket created | Maintenance dispatched |
| G075 | Control room temperature | `PUT /api/v1/rooms/:id/climate` | In-house, smart room | Temp adjusted | IoT command sent |

### 3.2 Restaurant & Dining
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G076 | View restaurant availability | `GET /api/v1/restaurants/:id/availability` | None | Tables shown | None |
| G077 | Make restaurant reservation | `POST /api/v1/restaurants/:id/reservations` | Availability exists | Table reserved | Capacity updated |
| G078 | Modify reservation | `PUT /api/v1/restaurants/reservations/:id` | Reservation exists | Details changed | Staff notified |
| G079 | Cancel reservation | `DELETE /api/v1/restaurants/reservations/:id` | Reservation exists | Table released | Capacity restored |
| G080 | Check in to restaurant | `POST /api/v1/restaurants/:id/checkin` | Reservation or walk-in | Table assigned | Wait time updated |
| G081 | Join waitlist | `POST /api/v1/restaurants/:id/waitlist` | Restaurant full | Added to queue | Queue position assigned |
| G082 | Leave waitlist | `DELETE /api/v1/restaurants/:id/waitlist/:id` | On waitlist | Removed | Queue updated |
| G083 | View menu | `GET /api/v1/restaurants/:id/menu` | At restaurant | Menu displayed | None |
| G084 | Place order | `POST /api/v1/restaurants/:id/orders` | Seated | Order created | Kitchen receives |
| G085 | Add to order | `PUT /api/v1/restaurants/orders/:id/items` | Order open | Items added | Kitchen notified |
| G086 | Modify order item | `PUT /api/v1/restaurants/orders/:id/items/:itemId` | Item not started | Item changed | Kitchen notified |
| G087 | Remove order item | `DELETE /api/v1/restaurants/orders/:id/items/:itemId` | Item not started | Item removed | Kitchen notified |
| G088 | Request bill | `GET /api/v1/restaurants/orders/:id/bill` | Order complete | Bill generated | Payment ready |
| G089 | Split bill | `POST /api/v1/restaurants/orders/:id/split` | Order complete | Bills separated | Multiple payments |
| G090 | Pay restaurant bill | `POST /api/v1/restaurants/orders/:id/pay` | Bill generated | Payment processed | Folio updated |
| G091 | Charge to room | `POST /api/v1/restaurants/orders/:id/charge-room` | In-house | Charged to folio | Room charges updated |
| G092 | Tip server | `POST /api/v1/restaurants/orders/:id/tip` | Bill paid | Tip recorded | Server credits |
| G093 | Rate dining experience | `POST /api/v1/restaurants/orders/:id/rating` | Meal complete | Rating saved | Analytics, feedback loop |
| G094 | Report food issue | `POST /api/v1/restaurants/orders/:id/issue` | Order exists | Issue logged | Manager notified |
| G095 | Request manager | `POST /api/v1/restaurants/:id/request-manager` | Issue exists | Manager paged | Escalation started |

### 3.3 Bar & Lounge
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G096 | Order at bar | `POST /api/v1/bar/orders` | At bar | Order created | Bar prepared |
| G097 | Open bar tab | `POST /api/v1/bar/tabs` | At bar | Tab opened | Running total tracked |
| G098 | Add to bar tab | `PUT /api/v1/bar/tabs/:id/items` | Tab open | Items added | Total updated |
| G099 | Close bar tab | `POST /api/v1/bar/tabs/:id/close` | Tab open | Tab settled | Payment processed |
| G100 | View bar menu | `GET /api/v1/bar/menu` | None | Menu displayed | None |

### 3.4 Pool & Recreation
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G101 | Check pool availability | `GET /api/v1/pool/availability` | None | Capacity shown | None |
| G102 | Reserve sun lounger | `POST /api/v1/pool/loungers` | Lounger available | Reserved | Capacity updated |
| G103 | Release lounger | `DELETE /api/v1/pool/loungers/:id` | Reserved by guest | Released | Capacity restored |
| G104 | Order poolside | `POST /api/v1/pool/orders` | At pool | Order created | Bar notified |
| G105 | Book cabana | `POST /api/v1/pool/cabanas` | Cabana available | Reserved | Capacity updated |
| G106 | Report pool issue | `POST /api/v1/pool/issues` | At pool | Issue logged | Lifeguard notified |
| G107 | Check gym availability | `GET /api/v1/gym/availability` | None | Capacity shown | None |
| G108 | Book gym session | `POST /api/v1/gym/sessions` | Slot available | Session booked | Capacity updated |
| G109 | Book fitness class | `POST /api/v1/gym/classes/:id/book` | Class available | Spot reserved | Capacity updated |
| G110 | Cancel fitness booking | `DELETE /api/v1/gym/classes/:id/book` | Booking exists | Spot released | Capacity restored |

### 3.5 Spa & Wellness
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G111 | View spa menu | `GET /api/v1/spa/treatments` | None | Treatments shown | None |
| G112 | Check spa availability | `GET /api/v1/spa/availability` | None | Slots shown | None |
| G113 | Book spa treatment | `POST /api/v1/spa/appointments` | Slot available | Appointment created | Therapist assigned |
| G114 | Modify spa booking | `PUT /api/v1/spa/appointments/:id` | Appointment exists | Details changed | Therapist notified |
| G115 | Cancel spa booking | `DELETE /api/v1/spa/appointments/:id` | Appointment exists | Cancelled | Slot released |
| G116 | Check in for spa | `POST /api/v1/spa/appointments/:id/checkin` | Appointment time | Checked in | Treatment starts |
| G117 | Rate spa experience | `POST /api/v1/spa/appointments/:id/rating` | Treatment complete | Rating saved | Analytics updated |
| G118 | Purchase spa product | `POST /api/v1/spa/products/purchase` | Product available | Purchase made | Inventory updated |
| G119 | Book spa package | `POST /api/v1/spa/packages/:id/book` | Package available | Package booked | Multiple appointments |
| G120 | Gift spa treatment | `POST /api/v1/spa/gift` | Valid treatment | Gift card created | Recipient notified |

### 3.6 Communication & Support
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G121 | Send message to staff | `POST /api/v1/messaging/send` | In-house | Message sent | Staff notified |
| G122 | Use chat support | `POST /api/v1/chat/messages` | None | Message sent | Agent/bot responds |
| G123 | Request wake-up call | `POST /api/v1/rooms/:id/wakeup` | In-house | Call scheduled | System alarm set |
| G124 | Request concierge | `POST /api/v1/concierge/requests` | In-house | Request created | Concierge notified |
| G125 | Ask for recommendations | `GET /api/v1/concierge/recommendations` | In-house | Suggestions provided | Preferences learned |
| G126 | Report lost item | `POST /api/v1/lost-found/report` | None | Report created | Staff searches |
| G127 | Submit complaint | `POST /api/v1/support/complaints` | None | Complaint logged | Escalation workflow |
| G128 | Provide feedback | `POST /api/v1/feedback` | None | Feedback saved | Analytics, alerts |
| G129 | Request information | `POST /api/v1/concierge/info` | None | Info provided | None |
| G130 | Emergency contact | `POST /api/v1/emergency` | Emergency | Alert triggered | All staff notified |

### 3.7 Payments & Folio
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G131 | View folio | `GET /api/v1/folios/:id` | In-house | Charges shown | None |
| G132 | Dispute charge | `POST /api/v1/folios/:id/dispute` | Charge exists | Dispute created | Manager review |
| G133 | Add payment to folio | `POST /api/v1/folios/:id/payment` | Folio exists | Payment applied | Balance reduced |
| G134 | Request folio split | `POST /api/v1/folios/:id/split` | Folio exists | Folios separated | Accounting updated |
| G135 | Transfer charge | `POST /api/v1/folios/:id/transfer` | Charge exists | Charge moved | Both folios updated |
| G136 | Request itemized bill | `GET /api/v1/folios/:id/itemized` | Folio exists | Details shown | None |
| G137 | Set payment limit | `PUT /api/v1/folios/:id/limit` | In-house | Limit set | Warnings enabled |
| G138 | Update payment method | `PUT /api/v1/guests/:id/payment-method` | Authenticated | Card updated | Future charges use new card |
| G139 | Request receipt | `GET /api/v1/payments/:id/receipt` | Payment exists | Receipt generated | None |
| G140 | View payment history | `GET /api/v1/guests/:id/payments` | Authenticated | History shown | None |

## 4. Check-Out Phase

### 4.1 Departure
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G141 | Review final folio | `GET /api/v1/folios/:id/final` | Check-out day | Final charges shown | None |
| G142 | Check out (desk) | `POST /api/v1/checkout` | All charges settled | Guest checked out | Room released, housekeeping notified |
| G143 | Mobile checkout | `POST /api/v1/mobile-checkout` | Pre-authorized card | Guest checked out | Digital key deactivated |
| G144 | Express checkout | `POST /api/v1/express-checkout` | Pre-authorized | Auto checkout | Bill emailed |
| G145 | Request late checkout | `POST /api/v1/checkout/late` | Room available | Extension granted | Charge added |
| G146 | Return physical key | `POST /api/v1/keys/:id/return` | Has key | Key collected | Inventory updated |
| G147 | Request luggage storage | `POST /api/v1/luggage/store` | Checking out | Luggage stored | Ticket issued |
| G148 | Collect stored luggage | `POST /api/v1/luggage/collect` | Has ticket | Luggage returned | Storage cleared |
| G149 | Arrange departure transport | `POST /api/v1/transport/departure` | Checking out | Transport booked | Driver assigned |
| G150 | Request final invoice | `GET /api/v1/folios/:id/invoice` | Checked out | Invoice emailed | Accounting record |

### 4.2 Post-Stay
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| G151 | Submit review | `POST /api/v1/reviews` | Stayed | Review saved | Response workflow |
| G152 | Rate stay | `POST /api/v1/ratings` | Stayed | Rating saved | NPS calculated |
| G153 | View loyalty points | `GET /api/v1/loyalty/points` | Member | Points shown | None |
| G154 | Redeem points | `POST /api/v1/loyalty/redeem` | Sufficient points | Reward issued | Points deducted |
| G155 | Claim loyalty tier | `POST /api/v1/loyalty/tier-claim` | Eligible | Tier upgraded | Benefits unlocked |
| G156 | Book return stay | `POST /api/v1/bookings` | Previous guest | New booking | Loyalty recognized |
| G157 | Refer a friend | `POST /api/v1/referrals` | Previous guest | Referral created | Both earn bonus |
| G158 | Subscribe to newsletter | `POST /api/v1/marketing/subscribe` | Has email | Subscribed | Welcome email |
| G159 | Update preferences | `PUT /api/v1/guests/:id/preferences` | Authenticated | Preferences saved | Future stays personalized |
| G160 | Request GDPR export | `POST /api/v1/gdpr/export` | Authenticated | Export queued | Data compiled |
| G161 | Request GDPR deletion | `POST /api/v1/gdpr/delete` | Authenticated | Deletion queued | Data anonymized |
| G162 | Manage consents | `PUT /api/v1/gdpr/consents` | Authenticated | Consents updated | Marketing adjusted |

---

# 👔 STAFF ACTIONS (50+ Actions)

## Front Desk Agent
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| S001 | View arrivals list | `GET /api/v1/arrivals` | Shift started | List displayed | None |
| S002 | View departures list | `GET /api/v1/departures` | Shift started | List displayed | None |
| S003 | Process check-in | `POST /api/v1/checkin/process` | Guest present | Checked in | Key issued |
| S004 | Process check-out | `POST /api/v1/checkout/process` | Guest present | Checked out | Room released |
| S005 | Assign room | `POST /api/v1/rooms/assign` | Room available | Room assigned | Housekeeping notified |
| S006 | Change room | `POST /api/v1/rooms/change` | Alternative available | Room swapped | Both rooms updated |
| S007 | Issue key | `POST /api/v1/keys/issue` | Guest checked in | Key created | Access granted |
| S008 | Block key | `POST /api/v1/keys/block` | Key exists | Key blocked | Access revoked |
| S009 | Take reservation | `POST /api/v1/bookings/walk-in` | Room available | Booking created | Inventory updated |
| S010 | Modify reservation | `PUT /api/v1/bookings/:id` | Booking exists | Details changed | Notifications sent |
| S011 | Cancel reservation | `DELETE /api/v1/bookings/:id` | Within policy | Cancelled | Refund if applicable |
| S012 | Post charge | `POST /api/v1/folios/:id/charges` | Folio exists | Charge added | Balance updated |
| S013 | Post adjustment | `POST /api/v1/folios/:id/adjustments` | Folio exists | Amount adjusted | Approval logged |
| S014 | Process payment | `POST /api/v1/payments/process` | Payment due | Payment taken | Folio updated |
| S015 | Handle complaint | `POST /api/v1/support/handle` | Complaint exists | Resolution logged | Guest notified |

## Kitchen Staff
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| S016 | View order queue | `GET /api/v1/kitchen/queue` | Shift started | Orders displayed | None |
| S017 | Accept order | `POST /api/v1/kitchen/orders/:id/accept` | Order pending | Status: Preparing | Guest notified via WS |
| S018 | Start preparation | `POST /api/v1/kitchen/orders/:id/start` | Order accepted | Status: Cooking | Timer started |
| S019 | Mark item ready | `POST /api/v1/kitchen/orders/:id/items/:itemId/ready` | Item cooking | Status: Ready | Server notified |
| S020 | Mark order complete | `POST /api/v1/kitchen/orders/:id/complete` | All items ready | Status: Ready | Server notified |
| S021 | Flag inventory low | `POST /api/v1/inventory/flag` | Stock low | Alert created | Manager notified |
| S022 | Update inventory count | `PUT /api/v1/inventory/:id/count` | Item exists | Count updated | Thresholds checked |
| S023 | Mark item unavailable | `POST /api/v1/menu/items/:id/unavailable` | Item depleted | Menu updated | All stations notified |
| S024 | Request supplies | `POST /api/v1/inventory/request` | Item needed | Request created | Purchasing notified |
| S025 | Log food waste | `POST /api/v1/kitchen/waste` | Waste occurred | Logged | Reports updated |

## Housekeeping Staff
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| S026 | View room assignments | `GET /api/v1/housekeeping/assignments` | Shift started | Tasks displayed | None |
| S027 | Start room cleaning | `POST /api/v1/housekeeping/rooms/:id/start` | Assigned | Status: Cleaning | Room blocked |
| S028 | Complete room cleaning | `POST /api/v1/housekeeping/rooms/:id/complete` | Cleaning done | Status: Clean | Room available |
| S029 | Report room issue | `POST /api/v1/housekeeping/rooms/:id/issue` | Issue found | Ticket created | Maintenance notified |
| S030 | Request supplies | `POST /api/v1/housekeeping/supplies` | Supplies needed | Request created | Inventory checked |
| S031 | Mark DND room | `POST /api/v1/housekeeping/rooms/:id/dnd` | Guest requested | DND set | Skipped in queue |
| S032 | Turndown service | `POST /api/v1/housekeeping/rooms/:id/turndown` | Evening | Service done | Guest notified |
| S033 | Deep clean complete | `POST /api/v1/housekeeping/rooms/:id/deep-clean` | Deep clean done | Status updated | QA check scheduled |
| S034 | Log lost item | `POST /api/v1/lost-found/log` | Item found | Entry created | Guest notified |
| S035 | Update minibar | `POST /api/v1/housekeeping/rooms/:id/minibar` | Room cleaned | Charges posted | Inventory updated |

## Waiter/Server
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| S036 | View table assignments | `GET /api/v1/restaurants/:id/my-tables` | Shift started | Tables shown | None |
| S037 | Seat guests | `POST /api/v1/restaurants/:id/seat` | Table available | Table occupied | Capacity updated |
| S038 | Take order | `POST /api/v1/restaurants/orders` | Guests seated | Order created | Kitchen receives |
| S039 | Modify order | `PUT /api/v1/restaurants/orders/:id` | Order open | Order changed | Kitchen notified |
| S040 | Deliver order | `POST /api/v1/restaurants/orders/:id/deliver` | Order ready | Status: Delivered | Timer stopped |
| S041 | Process payment | `POST /api/v1/restaurants/orders/:id/pay` | Bill requested | Payment taken | Table available |
| S042 | Clear table | `POST /api/v1/restaurants/:id/tables/:tableId/clear` | Guests left | Table reset | Available for seating |
| S043 | Add to waitlist | `POST /api/v1/restaurants/:id/waitlist` | Walk-in, full | Added to queue | Time estimate given |
| S044 | Call from waitlist | `POST /api/v1/restaurants/:id/waitlist/call` | Table ready | Guest paged | Queue updated |
| S045 | Flag dietary alert | `POST /api/v1/restaurants/orders/:id/dietary-alert` | Allergy concern | Kitchen alerted | Special attention |

## Spa Staff
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| S046 | View appointments | `GET /api/v1/spa/my-appointments` | Shift started | Schedule shown | None |
| S047 | Start treatment | `POST /api/v1/spa/appointments/:id/start` | Guest present | Status: In Progress | Room blocked |
| S048 | Complete treatment | `POST /api/v1/spa/appointments/:id/complete` | Treatment done | Status: Complete | Guest billed |
| S049 | Add product sale | `POST /api/v1/spa/appointments/:id/products` | Treatment done | Products added | Inventory updated |
| S050 | Request room turnover | `POST /api/v1/spa/rooms/:id/turnover` | Treatment done | Cleaning needed | Timer started |

---

# 📊 MANAGER ACTIONS (50+ Actions)

## Front Office Manager
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| M001 | View occupancy | `GET /api/v1/reports/occupancy` | Access granted | Report shown | None |
| M002 | Approve rate override | `POST /api/v1/rates/override/approve` | Override pending | Rate changed | Revenue tracked |
| M003 | Authorize refund | `POST /api/v1/refunds/authorize` | Refund requested | Refund processed | Finance notified |
| M004 | Handle escalation | `POST /api/v1/escalations/:id/handle` | Escalation open | Resolution logged | Guest notified |
| M005 | Comp room/service | `POST /api/v1/folios/:id/comp` | Authorization | Charges removed | Reason logged |
| M006 | Upgrade guest | `POST /api/v1/rooms/upgrade` | Higher room available | Upgrade applied | Loyalty tracked |
| M007 | Block rooms | `POST /api/v1/rooms/block` | Rooms available | Rooms blocked | Inventory reduced |
| M008 | Release blocked rooms | `DELETE /api/v1/rooms/block/:id` | Block exists | Rooms released | Inventory restored |
| M009 | View no-shows | `GET /api/v1/reports/no-shows` | End of day | Report shown | None |
| M010 | Process no-show | `POST /api/v1/bookings/:id/no-show` | Guest didn't arrive | Charge applied | Room released |

## F&B Manager
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| M011 | View kitchen metrics | `GET /api/v1/kitchen/metrics` | Access granted | Metrics shown | None |
| M012 | Adjust menu prices | `PUT /api/v1/menu/prices` | Manager access | Prices updated | POS synced |
| M013 | Add menu item | `POST /api/v1/menu/items` | Manager access | Item added | All stations updated |
| M014 | Remove menu item | `DELETE /api/v1/menu/items/:id` | Manager access | Item removed | All stations updated |
| M015 | Set daily special | `POST /api/v1/menu/specials` | Manager access | Special active | All staff notified |
| M016 | Approve comp | `POST /api/v1/restaurants/comps/approve` | Comp requested | Comp applied | Reason logged |
| M017 | Review waste report | `GET /api/v1/kitchen/waste/report` | Access granted | Report shown | None |
| M018 | Adjust inventory par | `PUT /api/v1/inventory/:id/par` | Manager access | Par level changed | Auto-order updated |
| M019 | Schedule staff | `PUT /api/v1/staff/schedule` | Manager access | Schedule updated | Staff notified |
| M020 | Handle guest complaint | `POST /api/v1/restaurants/complaints/:id/resolve` | Complaint exists | Resolution logged | Analytics updated |

## Revenue Manager
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| M021 | View demand forecast | `GET /api/v1/revenue/forecast` | Access granted | Forecast shown | None |
| M022 | Adjust rates | `PUT /api/v1/rates` | Manager access | Rates changed | Channel manager synced |
| M023 | Create promotion | `POST /api/v1/promotions` | Manager access | Promo created | Marketing notified |
| M024 | Review rate parity | `GET /api/v1/rate-parity/report` | Access granted | Report shown | None |
| M025 | Resolve parity alert | `POST /api/v1/rate-parity/alerts/:id/resolve` | Alert exists | Resolution logged | OTA contacted |
| M026 | Set minimum stay | `PUT /api/v1/rates/restrictions` | Manager access | Restriction set | Booking rules updated |
| M027 | Open/close inventory | `PUT /api/v1/inventory/channels` | Manager access | Channels updated | Real-time sync |
| M028 | Approve group rate | `POST /api/v1/groups/:id/rate/approve` | Rate proposed | Rate confirmed | Contract updated |
| M029 | Review pickup report | `GET /api/v1/reports/pickup` | Access granted | Report shown | None |
| M030 | Run what-if scenario | `POST /api/v1/revenue/scenario` | Access granted | Simulation run | Results shown |

## Housekeeping Manager
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| M031 | Assign rooms | `POST /api/v1/housekeeping/assign` | Rooms to clean | Tasks assigned | Staff notified |
| M032 | Reassign room | `PUT /api/v1/housekeeping/reassign` | Task exists | Task moved | Staff notified |
| M033 | View productivity | `GET /api/v1/housekeeping/productivity` | Access granted | Metrics shown | None |
| M034 | Quality check room | `POST /api/v1/housekeeping/rooms/:id/qa` | Room cleaned | QA completed | Issues logged |
| M035 | Schedule deep clean | `POST /api/v1/housekeeping/deep-clean/schedule` | Room available | Deep clean queued | Inventory blocked |
| M036 | Manage supplies inventory | `PUT /api/v1/housekeeping/supplies/inventory` | Access granted | Levels updated | Orders triggered |
| M037 | Review maintenance requests | `GET /api/v1/maintenance/pending` | Access granted | Requests shown | None |
| M038 | Escalate maintenance | `POST /api/v1/maintenance/:id/escalate` | Issue urgent | Priority raised | Engineering notified |
| M039 | Close out shift | `POST /api/v1/housekeeping/shift/close` | Shift ending | Report generated | Handover ready |
| M040 | Approve OOO room | `POST /api/v1/rooms/:id/ooo/approve` | Issue critical | Room blocked | Inventory reduced |

---

# 🔧 ADMIN ACTIONS (80+ Actions)

## System Configuration
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| A001 | View system status | `GET /api/v1/admin/status` | Admin access | Status shown | None |
| A002 | Configure hotel settings | `PUT /api/v1/admin/settings` | Admin access | Settings updated | System reloaded |
| A003 | Manage room types | `PUT /api/v1/admin/room-types` | Admin access | Types updated | Inventory synced |
| A004 | Configure rate plans | `PUT /api/v1/admin/rate-plans` | Admin access | Plans updated | Channel synced |
| A005 | Set up channels | `POST /api/v1/admin/channels` | Admin access | Channel configured | Sync started |
| A006 | Configure payments | `PUT /api/v1/admin/payments` | Admin access | Gateway configured | Test transaction |
| A007 | Set up taxes | `PUT /api/v1/admin/taxes` | Admin access | Tax rules updated | All calculations affected |
| A008 | Configure loyalty program | `PUT /api/v1/admin/loyalty` | Admin access | Program updated | Member benefits changed |
| A009 | Set cancellation policies | `PUT /api/v1/admin/policies/cancellation` | Admin access | Policies updated | Booking rules changed |
| A010 | Configure GDPR settings | `PUT /api/v1/admin/gdpr` | Admin access | Compliance updated | Retention rules changed |

## User Management
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| A011 | Create staff user | `POST /api/v1/admin/users` | Admin access | User created | Welcome email |
| A012 | Deactivate user | `PUT /api/v1/admin/users/:id/deactivate` | User exists | User disabled | Access revoked |
| A013 | Reset password | `POST /api/v1/admin/users/:id/reset-password` | User exists | Reset email sent | Token generated |
| A014 | Assign roles | `PUT /api/v1/admin/users/:id/roles` | User exists | Roles changed | Permissions updated |
| A015 | View audit log | `GET /api/v1/admin/audit` | Admin access | Log displayed | None |
| A016 | Configure permissions | `PUT /api/v1/admin/permissions` | Admin access | Permissions changed | All users affected |
| A017 | Manage departments | `PUT /api/v1/admin/departments` | Admin access | Depts updated | User assignments |
| A018 | Set shift schedules | `PUT /api/v1/admin/schedules` | Admin access | Schedules set | Staff notified |
| A019 | Configure notifications | `PUT /api/v1/admin/notifications` | Admin access | Rules updated | Routing changed |
| A020 | Set approval workflows | `PUT /api/v1/admin/workflows` | Admin access | Workflows updated | Process changed |

## Reporting & Analytics
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| A021 | Run custom report | `POST /api/v1/admin/reports/custom` | Admin access | Report generated | Data exported |
| A022 | Schedule report | `POST /api/v1/admin/reports/schedule` | Admin access | Schedule created | Auto-run setup |
| A023 | Export data | `POST /api/v1/admin/exports` | Admin access | Export queued | File generated |
| A024 | View analytics dashboard | `GET /api/v1/admin/analytics` | Admin access | Dashboard shown | None |
| A025 | Configure KPIs | `PUT /api/v1/admin/kpis` | Admin access | KPIs updated | Dashboard changed |
| A026 | Set up alerts | `POST /api/v1/admin/alerts` | Admin access | Alert created | Monitoring active |
| A027 | Review system logs | `GET /api/v1/admin/logs` | Admin access | Logs shown | None |
| A028 | Generate financial report | `POST /api/v1/admin/reports/financial` | Admin access | Report created | Accounting use |
| A029 | Reconcile payments | `POST /api/v1/admin/reconcile` | Admin access | Reconciliation run | Discrepancies flagged |
| A030 | Archive old data | `POST /api/v1/admin/archive` | Admin access | Data archived | Storage freed |

## Marketing & Communications
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| A031 | Create email campaign | `POST /api/v1/marketing/campaigns` | Admin access | Campaign created | Audience selected |
| A032 | Create guest segment | `POST /api/v1/marketing/segments` | Admin access | Segment created | Members calculated |
| A033 | Design email template | `POST /api/v1/marketing/templates` | Admin access | Template saved | Available for use |
| A034 | Schedule campaign | `POST /api/v1/marketing/campaigns/:id/schedule` | Campaign ready | Send scheduled | Queue created |
| A035 | View campaign results | `GET /api/v1/marketing/campaigns/:id/results` | Campaign sent | Results shown | None |
| A036 | Configure chatbot | `PUT /api/v1/admin/chatbot` | Admin access | Bot updated | Responses changed |
| A037 | Set up SMS gateway | `PUT /api/v1/admin/sms` | Admin access | Gateway configured | Messaging enabled |
| A038 | Create journey | `POST /api/v1/marketing/journeys` | Admin access | Journey created | Automation active |
| A039 | Manage subscriptions | `GET /api/v1/marketing/subscriptions` | Admin access | List shown | None |
| A040 | Handle unsubscribes | `POST /api/v1/marketing/unsubscribe` | Request received | Unsubscribed | Compliance logged |

## Integrations
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| A041 | Configure PMS sync | `PUT /api/v1/admin/integrations/pms` | Admin access | Sync configured | Data flowing |
| A042 | Set up channel manager | `PUT /api/v1/admin/integrations/channel-manager` | Admin access | CM connected | Rates synced |
| A043 | Configure payment gateway | `PUT /api/v1/admin/integrations/payment` | Admin access | Gateway ready | Payments enabled |
| A044 | Set up key encoder | `PUT /api/v1/admin/integrations/keys` | Admin access | Encoder connected | Keys enabled |
| A045 | Configure IoT devices | `PUT /api/v1/admin/integrations/iot` | Admin access | Devices connected | Automation active |
| A046 | Test integration | `POST /api/v1/admin/integrations/:id/test` | Integration exists | Test run | Results shown |
| A047 | View sync status | `GET /api/v1/admin/integrations/status` | Admin access | Status shown | None |
| A048 | Force sync | `POST /api/v1/admin/integrations/:id/sync` | Integration exists | Sync triggered | Data updated |
| A049 | View error log | `GET /api/v1/admin/integrations/:id/errors` | Admin access | Errors shown | None |
| A050 | Configure webhooks | `PUT /api/v1/admin/webhooks` | Admin access | Webhooks set | Events routed |

## Content Management
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| A051 | Update room descriptions | `PUT /api/v1/admin/content/rooms` | Admin access | Content updated | Website/app updated |
| A052 | Manage photos | `PUT /api/v1/admin/content/photos` | Admin access | Photos updated | All channels synced |
| A053 | Update amenities list | `PUT /api/v1/admin/content/amenities` | Admin access | List updated | Search affected |
| A054 | Manage translations | `PUT /api/v1/admin/content/translations` | Admin access | Translations updated | i18n synced |
| A055 | Update policies | `PUT /api/v1/admin/content/policies` | Admin access | Policies updated | Guest-facing changed |
| A056 | Configure FAQ | `PUT /api/v1/admin/content/faq` | Admin access | FAQ updated | Chatbot trained |
| A057 | Manage reviews responses | `PUT /api/v1/admin/reviews/:id/response` | Review exists | Response posted | Public reply |
| A058 | Update menus | `PUT /api/v1/admin/content/menus` | Admin access | Menus updated | POS synced |
| A059 | Configure spa services | `PUT /api/v1/admin/content/spa` | Admin access | Services updated | Booking available |
| A060 | Update event spaces | `PUT /api/v1/admin/content/events` | Admin access | Spaces updated | Group sales |

## GDPR & Compliance
| # | Action | Endpoint | Preconditions | Effects | Cascades |
|---|--------|----------|---------------|---------|----------|
| A061 | Process export request | `POST /api/v1/gdpr/export/:id/process` | Request exists | Export generated | Guest notified |
| A062 | Process deletion request | `POST /api/v1/gdpr/delete/:id/process` | Request exists | Data deleted | Compliance logged |
| A063 | View consent report | `GET /api/v1/gdpr/consents/report` | Admin access | Report shown | None |
| A064 | Update retention policies | `PUT /api/v1/gdpr/retention` | Admin access | Policies updated | Archival changed |
| A065 | Run retention job | `POST /api/v1/gdpr/retention/run` | Admin access | Job executed | Data archived/deleted |
| A066 | View processing activities | `GET /api/v1/gdpr/activities` | Admin access | Activities shown | None |
| A067 | Export compliance report | `POST /api/v1/gdpr/compliance/export` | Admin access | Report generated | Audit ready |
| A068 | Configure data mapping | `PUT /api/v1/gdpr/mapping` | Admin access | Mapping updated | Reports affected |
| A069 | Handle breach | `POST /api/v1/gdpr/breach` | Breach detected | Incident created | Notifications sent |
| A070 | Audit trail report | `GET /api/v1/gdpr/audit` | Admin access | Trail shown | None |

---

## 📊 Action Summary

| Actor Type | Action Count | Coverage Status |
|------------|--------------|-----------------|
| Guest | 162 | ✅ Comprehensive |
| Staff | 50 | ✅ Comprehensive |
| Manager | 40 | ✅ Comprehensive |
| Admin | 70 | ✅ Comprehensive |
| **TOTAL** | **322** | **Complete** |

---

*Document created: February 2, 2026*  
*Last updated: February 2, 2026*
