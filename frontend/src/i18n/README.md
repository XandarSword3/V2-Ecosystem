# Internationalization (i18n)

Multi-language support using next-intl.

## Supported Languages

| Language | Code | Direction |
|----------|------|-----------|
| English | `en` | LTR |
| Arabic | `ar` | RTL |
| French | `fr` | LTR |

## Directory Structure

```
i18n/
├── request.ts          # Server-side locale detection
├── routing.ts          # Locale routing configuration
└── README.md           # This file

messages/               # Translation files
├── en.json            # English translations
├── ar.json            # Arabic translations  
└── fr.json            # French translations
```

## Configuration

### Routing (`routing.ts`)

```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ar', 'fr'],
  defaultLocale: 'en',
  localePrefix: 'as-needed'
});
```

### Server Request (`request.ts`)

```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default
}));
```

## Usage

### In Server Components

```tsx
import { useTranslations } from 'next-intl';

export default function Page() {
  const t = useTranslations('common');
  
  return (
    <h1>{t('welcome')}</h1>
  );
}
```

### In Client Components

```tsx
'use client';

import { useTranslations } from 'next-intl';

export function Button() {
  const t = useTranslations('buttons');
  
  return (
    <button>{t('submit')}</button>
  );
}
```

### With Parameters

```tsx
const t = useTranslations('orders');

// messages/en.json: { "orders": { "count": "You have {count} orders" } }
<p>{t('count', { count: 5 })}</p>
// Output: "You have 5 orders"
```

### With Plurals

```tsx
// messages/en.json:
// { "items": { "one": "{count} item", "other": "{count} items" } }

<p>{t('items', { count: 1 })}</p>  // "1 item"
<p>{t('items', { count: 5 })}</p>  // "5 items"
```

## Translation File Structure

```json
{
  "common": {
    "welcome": "Welcome",
    "loading": "Loading...",
    "error": "An error occurred",
    "all": "All",
    "save": "Save",
    "cancel": "Cancel"
  },
  "auth": {
    "login": "Login",
    "register": "Register",
    "logout": "Logout",
    "forgotPassword": "Forgot Password?"
  },
  "restaurant": {
    "menu": "Menu",
    "addToCart": "Add to Cart",
    "orderNow": "Order Now"
  },
  "pool": {
    "sessions": "Available Sessions",
    "bookSession": "Book Session"
  },
  "admin": {
    "dashboard": "Dashboard",
    "users": "Users",
    "settings": "Settings"
  }
}
```

## RTL Support

Arabic layout automatically switches to RTL:

```tsx
// In layout.tsx
import { getLocale } from 'next-intl/server';

export default async function RootLayout({ children }) {
  const locale = await getLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  
  return (
    <html lang={locale} dir={dir}>
      <body>{children}</body>
    </html>
  );
}
```

### RTL-Aware Classes

Use Tailwind's RTL utilities:

```tsx
<div className="ml-4 rtl:mr-4 rtl:ml-0">
  Content with directional margin
</div>

<div className="text-left rtl:text-right">
  Aligned text
</div>
```

## Language Switcher

```tsx
'use client';

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  
  const switchLocale = (newLocale: string) => {
    router.replace(pathname, { locale: newLocale });
  };
  
  return (
    <select value={locale} onChange={(e) => switchLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="ar">العربية</option>
      <option value="fr">Français</option>
    </select>
  );
}
```

## Content Translation

For database content (menu items, chalets), use the translation helper:

```tsx
import { useContentTranslation } from '@/lib/translate';

function MenuItem({ item }) {
  const { translateContent } = useContentTranslation();
  
  // item: { name: "Pizza", name_ar: "بيتزا", name_fr: "Pizza" }
  return <h3>{translateContent(item, 'name')}</h3>;
}
```

## Adding New Translations

1. Add key to all language files (`en.json`, `ar.json`, `fr.json`)
2. Use the key in your component
3. Test in all languages

```json
// messages/en.json
{ "newFeature": { "title": "New Feature" } }

// messages/ar.json
{ "newFeature": { "title": "ميزة جديدة" } }

// messages/fr.json
{ "newFeature": { "title": "Nouvelle Fonctionnalité" } }
```

## Best Practices

1. **Namespace by Feature** - Group translations logically
2. **Avoid Hardcoded Text** - All UI text should be translated
3. **Test All Languages** - Check layout in RTL mode
4. **Use Parameters** - For dynamic content
5. **Fallback Gracefully** - Handle missing translations

---

See [next-intl documentation](https://next-intl-docs.vercel.app/) for advanced features.
