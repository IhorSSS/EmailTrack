# i18n Forensic Clean-up Plan

I have performed a forensic audit of the codebase and identified several "hidden" hardcoded strings that were missed by previous passes. These primarily exist in logic-bound code, helper functions, and the `StatsDisplay` content script.

## User Review Required
> [!IMPORTANT]
> **Backend Error Handling Strategy**: Currently, `AuthService` throws hardcoded English error messages (e.g., "Failed to fetch user profile") which are displayed directly to the user.
> **Proposal**: I will modify `useAuth.ts` to intercept these known error errors and map them to translation keys (e.g., `t('error_network')`, `t('error_sync_failed')`). Unknown errors will show a generic "Something went wrong" message or the raw error in dev mode.

## Proposed Changes

### 1. `src/services/AuthService.ts` & `src/hooks/useAuth.ts`
- **Issue**: `AuthService` throws raw English strings. `useAuth` sets them directly to state.
- **Fix**: 
    - Keep `AuthService` strict (throws English for logs).
    - Update `useAuth.ts` `login` and `checkAuth` catch blocks to map known error messages to `t()` keys.
    - Add keys: `error_network`, `error_sync`, `error_conflict`, `error_token`, `error_profile`.

### 2. `src/content/components/StatsDisplay.tsx` (Critical)
The content script has significant logic-bound text.
- **Strings to Fix**:
    - `"Read History"` header -> `t('detail_open_history')`
    - `"Grouped Opens (x...)"` -> `t('stats_grouped_opens', { count })`
    - `"No opens recorded"` -> `t('detail_no_opens')`
    - `"Unknown Location"` -> `t('location_unknown')`
    - `"Unknown Device"`, `"Gmail"`, `"Proxy/Server"` -> `t('device_gmail')`, etc.
    - `"⚠️ Reload"` -> `t('status_reload')`
- **Date Formatting**:
    - Replace `date-fns/format` (English only) with `Intl.DateTimeFormat` or `formatter.ts` logic using the user's locale.

### 3. `src/utils/formatter.ts`
- **Issue**: `formatRecipient` returns hardcoded "Unknown Recipient" or "Unknown".
- **Fix**: Update `formatRecipient` to accept `t` (optional) and return localized strings.
- **Follow-up**: Update `DetailView.tsx` to pass `t` to `formatRecipient`.

### 4. Locale Files (`messages.json`)
- Add all newly identified keys.

## Verification Plan
1. **Interactive Test**: Trigger an error (e.g. invalid token) and verify the error message is translated.
2. **Stats Display**: Open an email, verify the popup shows translated "Read History" and localized dates.
3. **Build & Test**: Ensure no type regressions from modifying `formatRecipient`.
