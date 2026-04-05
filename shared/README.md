# Shared Types

Shared TypeScript type definitions used by both the backend and frontend.

## Structure

- `package.json` — Package metadata (name: `@v2-resort/shared`)
- `types/` — 87 type definition files covering all domain entities

## Purpose

This package provides a single source of truth for TypeScript interfaces and types. Both `backend/` and `frontend/` reference these types to ensure API contracts are consistent.

The types cover all domain entities: users, bookings, chalets, restaurant orders, loyalty, payments, inventory, and more.
