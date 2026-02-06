# ExpensePartner — App flow

High-level user journey derived from routing (`app/page.tsx`, `app/reset-password/page.tsx`), `MainRouter`, auth/room guards, and loading/error states in context.

```mermaid
flowchart TB
  Start([Landing Page<br/>/])
  Start --> AuthLoading{Auth<br/>Loading?}

  AuthLoading -->|Yes| Loading1[Loading...]
  Loading1 --> AuthLoading

  AuthLoading -->|No| LoggedIn{User<br/>Logged In?}

  LoggedIn -->|No| Auth["Auth Screen"]
  LoggedIn -->|Yes| GroupsLoading{Groups<br/>Loading?}

  GroupsLoading -->|Yes| Loading2[Loading rooms...]
  Loading2 --> GroupsLoading

  GroupsLoading -->|Error| ErrorRetry[Show error + Retry button]
  ErrorRetry --> GroupsLoading

  GroupsLoading -->|No| HasRoom{Has Valid<br/>Room?}

  HasRoom -->|No, invalid ID| CleanupLS[Remove invalid ID from localStorage]
  CleanupLS --> Auth

  HasRoom -->|No, no rooms| Auth
  HasRoom -->|Yes| ExpensesLoading{Expenses<br/>Loading?}

  ExpensesLoading -->|Yes| Loading3[Loading expenses...]
  Loading3 --> ExpensesLoading

  ExpensesLoading -->|Error| ExpError[Show error in dashboard]
  ExpError --> Dashboard

  ExpensesLoading -->|No| Dashboard["Dashboard"]

  subgraph Auth["Auth Screen"]
    direction TB
    A1[Login / Sign Up]
    A1 --> A3[Set security question]
    A3 --> A4[Create / Join / Select room]
    A4 --> RefreshGroups[refreshGroups sets groupsLoading=true]
    RefreshGroups --> GroupsLoading
  end

  subgraph Dashboard["Dashboard"]
    direction TB
    D1[Main view]
    D1 --> D3[Settings]
    D3 --> Logout[Logout: setUser+setRoom null]
    D3 --> Leave[Leave: setRoom null]
    Logout --> Auth
    Leave --> GroupsLoading
  end

  subgraph ResetPassword["Reset Password /reset-password"]
    direction TB
    R1([Reset password page])
    R1 --> TokenCheck{Token Valid?}
    TokenCheck -->|No| TokenError[Show error + redirect in 3s]
    TokenError --> Start
    TokenCheck -->|Timeout 10s| TimeoutError[Timeout error + redirect]
    TimeoutError --> Start
    TokenCheck -->|Yes| SetPW[Set password form]
    SetPW --> Success[Redirect to /]
    Success --> Start
  end

  style Start fill:#e8f5e9
  style Dashboard fill:#e3f2fd
  style Auth fill:#fff3e0
  style ResetPassword fill:#fce4ec
  style ErrorRetry fill:#ffcdd2
  style ExpError fill:#ffcdd2
  style TokenError fill:#ffcdd2
```

## Routing summary

| Route | File | Guard / behavior |
|-------|------|-------------------|
| `/` | `app/page.tsx` | `AppProvider` → `MainRouter`: show Loading when `authLoading` or when `user && groupsLoading && !room`; else if no user or no room → `AuthScreen`; else `DashboardScreen`. |
| `/reset-password` | `app/reset-password/page.tsx` | Standalone. If session error or no session after 10s → show error and redirect to `/` in 3s. On valid session → set password form; after success redirect to `/`. |

## Auth and room guards

- **MainRouter** (in `app/page.tsx`): Shows loading when `authLoading` or when `user && groupsLoading && !room`. Renders `AuthScreen` when `!user` or `!room`; otherwise renders `DashboardScreen`. Room is required to reach the dashboard.
- **Auth state**: Restored on load via `getSession()` and kept in sync with `onAuthStateChange()` in `context/app-context.tsx`. `TOKEN_REFRESH_FAILED` and `SIGNED_OUT` clear user/room and show toast when applicable.
- **Room**: Persisted in `localStorage` (`expense_partner_last_group_id`). Restored after groups load; if stored ID is not in the user’s groups list, the key is removed (invalid ID cleanup).
- **Groups**: Initial load sets `groupsLoading`; failures set `groupsError` (shown in AuthScreen with Retry). `refreshGroups()` also clears/sets `groupsError`.
- **Expenses**: Load is cancelled when `room` changes (race-safe). Failures set `expensesError` (shown in Dashboard with Retry). `refreshExpenses()` retries for the current room.
