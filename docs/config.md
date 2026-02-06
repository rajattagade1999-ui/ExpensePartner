# ⚙️ PROJECT CONFIGURATION DOCUMENT

> This document defines the **technical stack, coding standards, and development rules** for the Roomettes app.  
> **This file is LAW for all development.**

---

## 1️⃣ TECH STACK

### Frontend Framework
**Primary:** Next.js 14+ (App Router)  
**Why:** Fast development, mobile-friendly rendering, built-in routing, and easy deployment on Vercel.

### UI / Styling
- **Component Library:** shadcn/ui (generated via v0.dev)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React

**Why:** Clean UI, minimal custom CSS, easy iteration, and good mobile responsiveness.

---

### Backend
- **API Layer:** Next.js API routes (`/app/api`)
- **Server Logic:** Next.js Server Actions (where applicable)

**Why:** Keeps frontend and backend in one codebase, ideal for fast MVP development.

---

### Database
- **Service:** Supabase (PostgreSQL)
- **Client:** Supabase JS SDK

**Why:**
- Relational data fits expense + group model well
- Built-in auth and row-level security
- Easy real-time sync for shared expenses

---

### Authentication
- **Service:** Supabase Auth

**Why:**
- Simple email-based auth
- Tight integration with Supabase database
- Good enough for student MVP

---

### File Storage
- **Service:** Supabase Storage

**Why:**
- Same platform as database and auth
- No extra infrastructure needed

---

### Payments
**Not required (out of scope for v1)**

---

### Email
**Not required for MVP**

---

### Hosting
- **Platform:** Vercel

**Why:**
- Best support for Next.js
- Fast global CDN
- Zero-config deployments

---

### Package Manager
- **Tool:** pnpm

**Why:** Faster installs and better dependency management than npm.

---

## 2️⃣ PROJECT STRUCTURE

```
roomettes-app/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes
│   │   ├── login/
│   │   └── signup/
│   ├── (dashboard)/              # Protected app screens
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api/                      # API routes
│   │   ├── expenses/
│   │   └── groups/
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── ui/                       # v0-generated components (DO NOT TOUCH)
│   └── features/                 # Logic wrappers
│       ├── expenses/
│       └── balances/
│
├── lib/
│   ├── actions/                  # Server actions
│   ├── hooks/                    # Custom hooks
│   ├── services/                 # Supabase + helpers
│   ├── utils/                    # Validation & helpers
│   └── types/                    # TypeScript types
│
├── docs/
│   ├── PRD.md
│   └── CONFIG.md
│
├── .env.local                    # Secrets (never commit)
├── .env.example                  # Example env file
├── .cursorrules                  # Cursor AI rules
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 3️⃣ FILE OWNERSHIP RULES

### ❌ v0 Owns (NEVER MODIFY)
```
/components/ui/**
```

### ✅ Developer / Cursor Owns
```
/lib/**
/app/api/**
/components/features/**
```

**Rule:** Business logic always lives outside v0 UI files.

---

## 4️⃣ CODING STANDARDS

### Language
- TypeScript only
- No `any` type allowed

### Naming
- Components: `PascalCase`
- Hooks: `useSomething`
- Utilities: `kebab-case`
- Actions: `*.actions.ts`

---

## 5️⃣ ENVIRONMENT VARIABLES

### Required
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# App
NEXT_PUBLIC_APP_NAME=Roomettes
```

**Rules:**
- `.env.local` is never committed
- `.env.example` must exist

---

## 6️⃣ TESTING REQUIREMENTS

- [ ] Add expense works correctly
- [ ] Balance calculation is accurate
- [ ] Only group members see group data
- [ ] Invalid splits are rejected

Manual testing is required before every deploy.

---

## 7️⃣ DEPLOYMENT CHECKLIST

Before deploying:
- [ ] Environment variables set in Vercel
- [ ] Supabase RLS policies enabled
- [ ] No TypeScript errors
- [ ] Mobile UI tested on small screens

---

## 8️⃣ AI DEVELOPMENT RULES

When using Cursor / AI:
1. Read `PRD.md` first
2. Do not add features outside PRD
3. Do not touch v0 UI files
4. Write clear comments
5. Keep logic simple (student MVP)

---

## ✅ APPROVAL

**This configuration is final and binding.**

**Approved by:** Rajat  
**Date:** Today  
**Version:** 1.0

