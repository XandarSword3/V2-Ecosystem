-- ============================================
-- V2 Resort - Add Footer Settings
-- ============================================

INSERT INTO site_settings (key, value) VALUES
  ('footer', '{
    "logo": {
      "text": "V2 Resort",
      "showIcon": true
    },
    "description": "Premium destination for exceptional dining, comfortable chalets, and refreshing pool experiences in the heart of Lebanon.",
    "columns": [
      {
        "title": "Quick Links",
        "links": [
          { "label": "Restaurant", "href": "/restaurant" },
          { "label": "Snack Bar", "href": "/snack-bar" },
          { "label": "Chalets", "href": "/chalets" },
          { "label": "Pool", "href": "/pool" }
        ]
      },
      {
        "title": "Legal",
        "links": [
          { "label": "Privacy Policy", "href": "/privacy" },
          { "label": "Terms of Service", "href": "/terms" },
          { "label": "Cancellation Policy", "href": "/cancellation" }
        ]
      }
    ],
    "socials": [
      { "platform": "facebook", "url": "https://facebook.com" },
      { "platform": "instagram", "url": "https://instagram.com" },
      { "platform": "twitter", "url": "https://twitter.com" }
    ],
    "contact": {
      "showAddress": true,
      "showPhone": true,
      "showEmail": true
    },
    "copyright": "© {year} V2 Resort. All rights reserved."
  }'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
