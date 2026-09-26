# AGENTS.md

This file provides guidance to AI coding agents working in this repository.

## Projekt

TrendingSkins — aplikacja webowa śledząca ceny skinów CS2. Reguła domenowa, progi,
wymagania funkcjonalne i bariery ochronne: @context/foundation/prd.md. Wybór stacku
i jego uzasadnienie: @context/foundation/tech-stack.md. Nie wymyślaj reguł produktu —
one są w PRD.

Uwaga: `package.json` nadal nosi nazwę `10x-astro-starter`.

## Komendy

- `npm run dev` / `build` / `preview` — Astro na runtime workerd (Cloudflare)
- `npm run lint` / `lint:fix` — ESLint z regułami opartymi o typy
- `npm run format` — Prettier (wtyczki astro + tailwindcss)
- `npx astro check` — kontrola typów; **nie ma jej w skryptach**, ale CI ją uruchamia
- `npm run smoke` — jedyny test w projekcie: przechodzi przepływ autoryzacji po HTTP
  (`BASE_URL`, domyślnie `http://localhost:4321`). Wymaga działającego serwera
  i osiągalnego Supabase z wyłączonym potwierdzaniem e-maila.

Nie ma runnera testów jednostkowych ani integracyjnych. Nie istnieje polecenie
uruchamiające pojedynczy test — `npm run smoke` jest niepodzielny.

Lokalne Supabase: `npx supabase start` (wymaga Dockera i ~7 GB RAM).
Wdrożenie: `npx wrangler deploy`.

## Architektura

Astro 7 w trybie `output: "server"` (pełny SSR), wyspy React 19, Tailwind 4,
Supabase przez `@supabase/ssr`, adapter Cloudflare.

### Degradacja przy braku konfiguracji — wzorzec przenikający cały kod

`SUPABASE_URL` i `SUPABASE_KEY` są zadeklarowane jako `optional: true` w schemacie
`astro:env` (astro.config.mjs). W konsekwencji `createClient()` z `@/lib/supabase`
**zwraca `null`**, gdy ich brakuje, a aplikacja wstaje z wyłączoną autoryzacją.

Każdy wywołujący musi sprawdzić `null` przed użyciem klienta. Wzorce do naśladowania:
`src/middleware.ts` (ustawia `locals.user = null`) i `src/pages/api/auth/signin.ts`
(przekierowanie z komunikatem błędu). `src/lib/config-status.ts` zasila baner
informujący użytkownika o brakującej konfiguracji.

### Sesja i ochrona tras

`src/middleware.ts` biegnie przy każdym żądaniu, rozwiązuje użytkownika i wystawia
go jako `context.locals.user`. Trasy chronione to tablica `PROTECTED_ROUTES` w tym
pliku — dopisanie ścieżki tam jest jedynym sposobem wymuszenia logowania. Dopasowanie
działa przez `startsWith`, więc prefiks obejmuje całe poddrzewo.

## Konwencje

- Alias ścieżek: `@/*` → `./src/*`.
- Komponenty `.astro` do treści statycznej i układu; React **tylko** tam, gdzie
  potrzebna jest interaktywność. Bez dyrektyw w stylu `"use client"`.
- Klasy Tailwind łącz przez `cn()` z `@/lib/utils`. Nie sklejaj stringów ręcznie.
- shadcn/ui, wariant „new-york", w `src/components/ui/`. Nowe: `npx shadcn@latest add`.
  Alias hooków to `@/hooks` (patrz components.json), nie `src/components/hooks/`.
- Endpointy API: eksport wielkimi literami (`GET`, `POST`). Przy `output: "server"`
  **nie** dodawaj `export const prerender = false` — jest zbędne.
- Serwisy i helpery w `src/lib/`. Wspólne typy w `src/types.ts` (jeszcze nie istnieje).

## Pułapki

- **`zod` nie jest zainstalowany.** Obecne endpointy nie walidują wejścia — czytają
  `formData()` i rzutują przez `as string`. Jeśli wprowadzasz walidację, najpierw
  dodaj zależność; nie zakładaj, że jest.
- **CI celuje w gałąź `master`, nie `main`** (.github/workflows/ci.yml).
- **CI nic nie wdraża.** Ma dwa zadania: `ci` (lint, `astro check`, build) oraz
  `smoke` (lokalne Supabase, build, preview, test dymny). Wdrożenie na Cloudflare
  nie jest zautomatyzowane, mimo zapisu w tech-stack.md.
- Hak pre-commit (husky + lint-staged) uruchamia `eslint --fix` na `*.{ts,tsx,astro}`
  i `prettier --write` na `*.{json,css,md}`.
- `supabase/` zawiera tylko `config.toml` — brak migracji. Projekt korzysta wyłącznie
  z wbudowanej tabeli `auth.users`. Zakładając własne tabele, włącz RLS z politykami
  granularnymi per operacja i per rola.
