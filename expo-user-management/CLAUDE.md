# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (always use ci to match lockfile)
npm ci --legacy-peer-deps

# Start the dev server (clears cache — always use this)
npx expo start --clear

# Tunnel mode for university/restricted networks (eduroam blocks LAN)
npx expo start --tunnel

# Platform-specific
npx expo start --ios
npx expo start --android
```

There is no lint or test setup in this project yet.

## Environment Setup

Copy `.env.example` to `.env` and fill in Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Variables must be prefixed `EXPO_PUBLIC_` to be accessible in client code. Restart Expo after any `.env` change.

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor to bootstrap tables, RLS policies, and seed categories before first launch.

## Architecture

### Entry point
`index.ts` → `App.tsx` → `QueryClientProvider` → `AuthProvider` → `RootNavigator`

### Auth flow
`contexts/AuthContext.tsx` holds the Supabase session via `onAuthStateChange`. `navigation/index.tsx` renders `AuthNavigator` (Login / Register / ForgotPassword) when no session, or `TabNavigator` when authenticated. Session persists across app restarts via AsyncStorage.

### Navigation tree
```
RootNavigator
├── AuthNavigator (stack)
│   ├── LoginScreen
│   ├── RegisterScreen
│   └── ForgotPasswordScreen
└── TabNavigator (bottom tabs)
    ├── DashboardScreen
    ├── TransactionNavigator (stack)
    │   ├── TransactionListScreen
    │   └── AddTransactionScreen  ← also used for editing (route.params.transaction)
    ├── BudgetNavigator (stack)
    │   ├── BudgetListScreen
    │   └── AddBudgetScreen       ← also used for editing
    ├── AnalyticsScreen
    └── SettingsScreen
```

### Services layer (`services/`)
Pure async functions — no React state. Each calls Supabase directly and throws on error.

| File | Responsibility |
|------|---------------|
| `auth.ts` | signIn, signUp, signOut, resetPassword |
| `transactions.ts` | CRUD + search/filter, soft-delete via `deleted_at` |
| `budgets.ts` | CRUD, aggregates monthly spending per category |
| `categories.ts` | Read system categories (seeded in DB) |
| `analytics.ts` | Spending by day, spending by category, monthly insights |

### Database (`supabase/migrations/001_initial_schema.sql`)
Core tables: `profiles`, `accounts`, `transactions`, `budgets`, `categories`, `savings_goals`. All user-owned tables have RLS policies keyed on `auth.uid() = user_id`. Categories are publicly readable (system-seeded). A Postgres trigger auto-creates a profile row on signup.

### Key patterns
- **Soft delete**: `transactions.deleted_at` — all queries filter `.is('deleted_at', null)`
- **Category join**: transactions/budgets always select `*, category:categories(*)`
- **Screen refresh**: screens use `useFocusEffect` + `useCallback` to reload on tab focus
- **Edit vs create**: `AddTransactionScreen` and `AddBudgetScreen` check `route.params.transaction/budget` — if present, calls `updateX`, otherwise `addX`
- **Long-press to delete**: list screens use `onLongPress` for delete with an Alert confirmation

## Tech stack
- Expo SDK 54 / React Native 0.81.5
- Supabase JS v2 (Auth + PostgREST)
- React Navigation 6 (native-stack + bottom-tabs)
- TanStack React Query v5 (QueryClient wired in App.tsx, available for future hooks)
- react-native-gifted-charts (Analytics line chart)
- dayjs (date formatting)
