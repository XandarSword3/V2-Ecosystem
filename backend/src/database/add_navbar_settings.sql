-- ============================================
-- V2 Resort - Add Navbar Settings
-- ============================================

INSERT INTO site_settings (key, value) VALUES
  ('navbar', '{
    "links": [
      { "type": "internal", "label": "Home", "href": "/", "icon": "Home" },
      { "type": "module", "label": "Restaurant", "href": "/restaurant", "moduleSlug": "restaurant", "icon": "UtensilsCrossed" },
      { "type": "module", "label": "Chalets", "href": "/chalets", "moduleSlug": "chalets", "icon": "Home" },
      { "type": "module", "label": "Pool", "href": "/pool", "moduleSlug": "pool", "icon": "Waves" },
      { "type": "module", "label": "Snack Bar", "href": "/snack-bar", "moduleSlug": "snack-bar", "icon": "Cookie" }
    ],
    "config": {
      "showLanguageSwitcher": true,
      "showThemeToggle": true,
      "showCurrencySwitcher": true,
      "showUserPreferences": true,
      "showCart": true,
      "sticky": true
    }
  }'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
