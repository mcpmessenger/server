# Front-end Dev Note – New MCP Providers (Bolt, Loveable, Cursor, 21st DEV)

Date: 2025-06-17

## TL;DR

Four new provider stubs have been added to the backend and now need UX polish / OAuth or API-key onboarding flows on the front-end settings portal.

| Provider ID | Name        | Sign-in method (MVP) | Notes |
|-------------|-------------|----------------------|-------|
| `cursor`    | Cursor      | API key              | Placeholder only – real Cursor MCP endpoint TBD. |
| `21st_dev`  | 21st DEV    | API key              | Generates UI components. |
| `loveable`  | Loveable    | API key (Supabase)   | Supabase project helper. |
| `bolt`      | Bolt        | API key              | Automation / web-search tools. |

## What's already done

1. **Backend** – provider stubs created under `backend/providers/*` and wired into `/api/providers`, `/api/command`, resource listing, and `/api/validate-key` (stub validation returns *true* for non-empty key).
2. **Front-end** – default provider list in `src/hooks/useProviders.ts` now contains the four providers; UI icons/colors supplied.
3. The **Settings modal** & **Provider cards** understand the new `Heart` icon (Loveable) and display them automatically.

## Outstanding work

1. Replace stub `executeCommand` and `listResources` logic with real API calls once the respective provider teams deliver Swagger / MCP specs.
2. Update `/api/validate-key` logic with real validation endpoints.
3. Add onboarding copy / docs links in the settings portal for each provider (currently generic).
4. Smoke-test persistence of API keys in localStorage for the new provider IDs.
5. Optional: distinct icons/colors if design wants different visuals; see `iconMap` in `SettingsModalNew.tsx` and `ProviderCard.tsx`.

–– End of note –– 