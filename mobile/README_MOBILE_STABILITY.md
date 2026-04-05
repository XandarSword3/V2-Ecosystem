# MOBILE STABILITY README

## Scope
This README documents the directory: ..\\v2-resort\\mobile.

## Verification
- Last refreshed: 2026-03-19
- Verification source: direct filesystem scan and local code inspection.
- Runtime and browser-level validation is consolidated in the main project README.

## Directory Inventory
### Subdirectories (12)
- .expo
- android
- app
- assets
- dist-android
- dist-check
- dist-test
- docs
- scripts
- src
- __mocks__
- __tests__

### Files (21)
- .env.example
- .eslintrc.js
- .gitignore
- app.json
- babel.config.js
- coverage-output.txt
- global.css
- google-services.json
- GoogleService-Info.plist
- index.js
- java.util.concurrent.ThreadPoolExecutor$Worker
- jest.config.js
- jest.setup.js
- metro.config.js
- nativewind-env.d.ts
- package-lock.json
- package.json
- PARITY_AUDIT.md
- README.md
- tailwind.config.js
- tsconfig.json

## Local Commands
- npm run start: expo start
- npm run android: expo run:android
- npm run ios: expo run:ios
- npm run web: expo start --web
- npm run prebuild: expo prebuild
- npm run prebuild:clean: expo prebuild --clean
- npm run run:android: expo run:android
- npm run run:ios: expo run:ios
- npm run lint: eslint . --ext .ts,.tsx
- npm run lint:strict: eslint . --ext .ts,.tsx --max-warnings 0
- npm run lint:fix: eslint . --ext .ts,.tsx --fix
- npm run typecheck: tsc --noEmit
- npm run test: jest
- npm run test:watch: jest --watch
- npm run test:coverage: jest --coverage
- npm run test:ci: jest --ci --coverage --watchAll=false --forceExit
- npm run test:update-snapshots: jest --updateSnapshot
- npm run validate: npm run lint:strict && npm run typecheck && npm run test:ci

## Maintenance Notes
- Keep this README aligned with the real files and scripts in this directory.
- Add deeper implementation notes when new modules, routes, or services are introduced.
