# Frontend Application Details (`src/app/`)

## Technical Implementation & Core Behaviors

The V2 Resort frontend is a massive Next.js App Router application leveraging complex client-side interactions and real-time data. Rather than simple pages, the application acts as a dynamic Platform-as-a-Service interface.

### 1. The Admin Dashboard (`/admin`)
- **Real-Time Presence**: Connects to the backend Socket.IO (`/stats:online_users`) constantly to display live resort guest traffic.
- **Dynamic Module Awareness**: The dashboard doesn't have hardcoded feature tiles. It listens to the `modules` API and dynamically generates "Module Control" buttons, Iconography, and Revenue/KPI tracking graphs *only* for modules currently activated by the system.
- **Micro-Animations**: Extensive use of `framer-motion` for stagger entrance, value trending up/down arrows, and Spring animations.

### 2. The Restaurant & Kiosk System (`/restaurant`, `/kiosk`)
- **Live Filtering**: Capable of instantaneously filtering menu items client-side into Vegan, Vegetarian, and Gluten-Free states without round-trip API calls.
- **Deep Translation Integration**: Integrates `next-intl` and a custom `useContentTranslation` hook to dynamically flip the UI into Right-to-Left (RTL) mode instantly upon language change (crucial for Arabic support).
- **Modifier Engines**: The `RestaurantModals` handles complex item modifiers (e.g., "Add extra cheese", "Remove onions", "Spicy level") passing exact diffs into a Zustand floating cart.
- **Floating Global Cart**: State is maintained strictly via Zustand (`useMenuActions`), persisting selections globally as the user browses through categories.

### 3. CMS & White-labeling (`/settings-context`)
- **Global Injections**: The entire UI consumes a `SettingsStore` pulling branding colors, Resort Name, Logo, and currency preference, styling the Tailwind CSS layers dynamically.

## Verified UI Systems (Based on Source Code Extraction)
- **Module Builder Interface**: Fully handles dynamic DB field injections.
- **Staff / Admin Roles**: React boundaries that visually restrict/render elements based on decoded JWT `req.user.roles`.
- **Payment Elements**: Stripe embedding flows built inside checkout contexts.

*(Note: While the frontend logic is definitively written to handle all these conditions, full runtime stability requires the backend services and `.env` to be correctly linked.)*
