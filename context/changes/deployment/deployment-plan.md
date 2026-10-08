# Cloudflare Workers — integracja i pierwsze wdrożenie (TrendingSkins)

## Context

`context/foundation/infrastructure.md` (2026-09-25) zamknął wybór platformy: **Cloudflare Workers**, runner-up Netlify, ryzyka przyjęte jawnie. Repozytorium niesie już adapter `@astrojs/cloudflare` 14.3.1, `wrangler.jsonc` wycelowany w Workers i flagę `nodejs_compat` — zero migracji. Czego nie ma: nic nigdy nie zostało wdrożone, worker nadal nazywa się `10x-astro-starter`, nie ma sekretów, nie ma `.dev.vars`, a plan wdrożenia dopiero powstaje.

Cel: doprowadzić aplikację do działającego adresu produkcyjnego na Workers, z wykrywalnym trybem awarii, odwracalnym wdrożeniem i zmierzonym zużyciem CPU — oraz z automatycznym wdrożeniem po wypchnięciu na `master`, **przy zerowym koszcie pieniężnym**.

### Ustalenia z rozmowy (zakres)

| Decyzja                  | Wybór                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Koszt**                | **Twarde zero.** Aplikacja nie może generować żadnych opłat — ani stałych, ani przekroczeniowych                                                        |
| Zadanie cykliczne (cron) | **Poza zakresem tej zmiany** — sam deploy                                                                                                               |
| Git / CI                 | `git init` + GitHub + **auto-deploy przy push na `master`, realizowany przez Cloudflare Workers Builds** (nie GitHub Actions); ścieżka ręczna zachowana |
| Supabase                 | **Projekt hostowany już istnieje** — URL i anon key gotowe                                                                                              |

---

## Kontrakt budżetowy: zero złotych

To ograniczenie nadrzędne — wygrywa z każdą inną rekomendacją w tym dokumencie, łącznie z tymi, które sam wcześniej zawierał.

### Dobra wiadomość: Cloudflare na darmowym planie nie potrafi wystawić rachunku

Dokumentacja jest jednoznaczna: _„If you exceed any one of these limits, further operations of that type will fail with an error"_. Przekroczenie limitu darmowego planu **blokuje**, nie **nalicza**. Nie ma cichego przejścia w płatność — żeby cokolwiek zaczęło kosztować, trzeba świadomie kliknąć upgrade. To zupełnie inny model niż np. Vercel i jest to ta właściwość, która czyni to ograniczenie wykonalnym.

### Limity darmowe i co je zużywa

| Usługa                              | Limit darmowy                                                      | Po przekroczeniu                   | Nasze realne zużycie                                                                |
| ----------------------------------- | ------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------- |
| Workers — żądania                   | 100 000 / dobę                                                     | **błąd**, nie opłata               | PRD: „kilka osób". Zapas trzycyfrowy                                                |
| Workers — CPU                       | 10 ms / wywołanie                                                  | **błąd** (`exceededCpu`)           | Jedyny realny punkt zapalny — patrz Faza 5                                          |
| Workers — zasoby statyczne          | **darmowe i nielimitowane**                                        | —                                  | Nie liczą się do 100 000/dobę                                                       |
| Workers Builds                      | **3 000 minut budowania / mc**, 1 build równolegle, timeout 20 min | build się nie uruchomi             | Build Astro ≈ 1–2 min. Nawet 100 wdrożeń/mc to ~200 min                             |
| Workers Logs / Observability        | 200 000 zdarzeń / dobę, retencja **3 dni**                         | zdarzenia przestają być zapisywane | Bez problemu; pamiętaj o 3-dniowej retencji przy diagnostyce                        |
| Adres `*.workers.dev`               | darmowy                                                            | —                                  | **Nie kupujemy własnej domeny** — to jedyny w tym planie wydatek, który byłby stały |
| Supabase Free                       | 2 projekty, pauza po ~7 dniach bezczynności                        | projekt pauzuje                    | Pauzowanie to problem dostępności, nie kosztu — patrz 5.6                           |
| GitHub Actions (repo **prywatne**)  | 2 000 minut / mc, domyślny limit wydatków **0 USD**                | **twarde zatrzymanie** zadań       | **Jedyne miejsce, gdzie łatwo o przekroczenie** — patrz niżej                       |
| GitHub Actions (repo **publiczne**) | **nielimitowane**                                                  | —                                  | Alternatywa, jeśli minuty zaczną się kończyć                                        |

### Trzy bariery, które trzeba postawić

- [x] **[H] B.1 Nie dodawaj metody płatności do Cloudflare.** Konto bez karty nie może przejść na plan płatny przypadkiem. Sprawdź: **Manage Account → Billing → Payment Info** — powinno być puste. To jest właściwe zabezpieczenie, a nie dyscyplina.
- [x] **[H] B.2 Potwierdź, że limit wydatków GitHuba to 0 USD** (Settings → Billing → Spending limit). To wartość domyślna dla kont rozliczanych miesięcznie; potwierdź ją, bo po jej podniesieniu nadmiarowe minuty **są** fakturowane.
- [x] **[A] B.3 Pilnuj budżetu minut GitHub Actions.** **Domknięte decyzją z 2026-10-08: repozytorium jest publiczne → minuty Actions nielimitowane** (patrz 4.1). Poniższe rozumowanie zostaje jako uzasadnienie na wypadek powrotu do prywatnego repo. Job `smoke` startuje lokalne Supabase w Dockerze — to najdroższy job w repozytorium, realnie kilka minut na uruchomienie. Przy 2 000 minut miesięcznie i repozytorium prywatnym liczy się każda harmonogramowana pętla. Konkretna konsekwencja dla tego planu: **sonda `verify-production` biegnie raz na dobę, nie co godzinę** (krok 4.11). Godzinowa to 720 uruchomień miesięcznie; dobowa to 30. Jeśli kiedykolwiek zabraknie minut — CI się zatrzyma, nic nie zostanie naliczone, a najprostszym wyjściem jest przełączenie repozytorium na publiczne (wtedy Actions są nielimitowane).

### Czego ten plan świadomie NIE robi

- **Nie przechodzi na Workers Paid ($5/mc).** Poprzednia wersja tego dokumentu traktowała to jako „zaplanowany wydatek". Przy twardym zerze to opcja wykreślona — przekroczenie 10 ms CPU jest odtąd **sygnałem do optymalizacji kodu**, nie do zmiany planu. Patrz przepisana Faza 5.
- **Nie kupuje własnej domeny.** Zostajemy na `trending-skins.lysiog16.workers.dev`.
- **Nie zakłada usług Cloudflare płatnych od pierwszego bajtu.** Gdyby kiedyś wchodziło R2, D1, KV czy Queues — każde ma własny darmowy próg i każde wymaga osobnego sprawdzenia przed dodaniem.

---

## Ustalenia techniczne

### Dwa fakty, które zmieniają kolejność poleceń

Zweryfikowane bezpośrednio w `node_modules`, nie z poradników:

1. **`wrangler deploy` nie czyta `wrangler.jsonc` z katalogu głównego.** Adapter deleguje budowanie workera do `@cloudflare/vite-plugin` 1.54.8, który na końcu `astro build` zapisuje `.wrangler/deploy/config.json` wskazujący na wygenerowany `dist/<serverdir>/wrangler.json`. Wrangler 4.131.1 honoruje to przekierowanie. Konsekwencje:
   - **Każda zmiana w `wrangler.jsonc` (nazwa, `main`, flagi) wymaga przebudowania, zanim dotrze do Cloudflare.** `npm run build` nie jest optymalizacją przed `wrangler deploy` — jest krokiem, który kompiluje konfigurację.
   - Dopóki nie ma builda, `wrangler secret put` i `wrangler tail` spadają z powrotem na główny `wrangler.jsonc`, czyli na **starą nazwę**. Stąd bierze się przypadkowe utworzenie drugiego workera. Dlatego w poleceniach operujących na sekretach zawsze podajemy `--name`.
   - `.wrangler/` jest w `.gitignore`. Świeży klon nie może wdrożyć bez zbudowania — CI musi budować i wdrażać **w tym samym drzewie roboczym**. Workers Builds spełnia to z definicji (polecenie budowania i polecenie wdrożenia biegną po kolei w jednym kontenerze), ale to wyklucza jakikolwiek wariant „checkout i od razu `wrangler deploy`".
2. **Sekrety `astro:env` rozwiązują się w runtime.** `@astrojs/cloudflare/handler` na poziomie modułu robi `import { env as globalEnv } from "cloudflare:workers"` a następnie `setGetEnv(createGetEnv(globalEnv))`. To odpowiada na otwarte pytanie z `infrastructure.md` — `wrangler secret put` powinno wystarczyć bez przebudowy. **Ale to wniosek z kodu, nie obserwacja** — krok 3.6 zamienia go w fakt i kosztuje dwie minuty.

### Odstępstwo od `infrastructure.md`, świadome

`infrastructure.md` mówi: _„wdrożenie na produkcję i rotacja sekretów wymagają człowieka"_. Auto-deploy przy push na `master` usuwa tę bramkę dla wdrożeń. Realizuję zgodnie z wyborem, ale z trzema zabezpieczeniami: `master` chroniony (merge tylko przez PR), obowiązkowy zielony job `ci` z GitHub Actions jako warunek merge'a, oraz zachowana ścieżka ręczna `versions upload` → `versions deploy` do wdrożeń wysokiego ryzyka. Rotacja sekretów pozostaje czynnością ludzką.

**Uwaga o podziale ról:** Workers Builds **nie zna** wyników GitHub Actions i nie czeka na nie — wdroży każdy push na gałąź produkcyjną niezależnie od tego, czy lint i `astro check` przeszły. Jedyne miejsce, gdzie da się to wymusić, to ochrona gałęzi po stronie GitHuba (krok 4.7). Bez niej „auto-deploy" znaczy dosłownie: każdy push idzie na produkcję, zielony czy nie.

---

## Legenda

- **[H]** — czynność człowieka (tworzenie poświadczeń, sekrety, operacje niszczące, rozliczenia)
- **[A]** — agent może wykonać bez nadzoru

---

## Faza 0 — Przygotowanie i bariery ochronne

_Wejście:_ nic nie wdrożone. _Wyjście:_ repozytorium pod kontrolą wersji, wersje przypięte, czysty build, znany kształt wygenerowanej konfiguracji.

- [x] **[A] 0.1** Potwierdź, że żaden worker jeszcze nie istnieje:
  ```powershell
  npx wrangler whoami
  npx wrangler deployments list --name 10x-astro-starter
  npx wrangler deployments list --name trending-skins
  ```
  Oba `deployments list` powinny zgłosić „worker not found". **Jeśli `10x-astro-starter` istnieje** → najpierw gałąź 1.4.
- [x] **[A] 0.2** `git init -b master` (CI celuje w `master`), `git add -A`, pierwszy commit. Katalog **nie jest** repozytorium gita — `.github/workflows/ci.yml` to dziś martwy tekst, a haki husky nigdy się nie uruchomiły.
- [x] **[A] 0.3** Uzupełnij `.gitignore` przed pierwszym commitem: `.dev.vars.*` (wzorzec pokrywa dziś tylko dokładne `.dev.vars`) oraz `worker-configuration.d.ts`.
- [x] **[A] 0.4** **Przypnij kruche zależności dokładnie**, zgodnie z rejestrem ryzyk: `@supabase/ssr` `^0.12.7` → `0.12.7`, `@supabase/supabase-js` `^2.99.1` → `2.116.0` (wersja faktycznie zainstalowana — daszek pozwala dziś na cichy skok przy następnym `npm ci`). Potem `npm install`, żeby przepisać lockfile, i commit. To najważniejsza linijka tej fazy: sekcja zwłok w `infrastructure.md` opisuje dokładnie ten scenariusz.
- [x] **[A] 0.5** `npm run build` bez sekretów — musi przejść (`optional: true`).
- [x] **[A] 0.6** Przeczytaj wygenerowaną konfigurację i zapamiętaj ścieżkę:

  ```powershell
  Get-Content .wrangler\deploy\config.json
  Get-Content dist\server\wrangler.json | ConvertFrom-Json | Select-Object name,main,compatibility_date,compatibility_flags | Format-List
  ```

  **Uwaga (zweryfikowane 2026-10-02):** `configPath` w `.wrangler\deploy\config.json` jest **względny wobec katalogu tego pliku** (`..\..\dist\server\wrangler.json`). Podanie go wprost do `Get-Content` rozwija się na `C:\dist\server\wrangler.json` i pada `PathNotFound`. Czytaj docelowy plik bezpośrednio albo rozwiąż ścieżkę przez `Resolve-Path` względem `.wrangler\deploy\`.

  Na tym etapie `name` to wciąż `10x-astro-starter`. **Nie wdrażaj.**

- [x] **[A] 0.7** `npx wrangler types` → generuje `worker-configuration.d.ts` z interfejsem `Env`.
- [x] **[A] 0.8** Dopisz typowanie runtime'u Cloudflare do `src/env.d.ts` (dziś deklaruje tylko `App.Locals.user`, więc `locals.runtime` jest nietypowane):
  ```ts
  /// <reference types="../worker-configuration.d.ts" />
  type CfRuntime = import("@astrojs/cloudflare").Runtime<Env>;
  declare namespace App {
    interface Locals extends CfRuntime {
      user: import("@supabase/supabase-js").User | null;
    }
  }
  ```
- [x] **[A] 0.9** `npx astro check` i `npm run lint` — czysto.
- [x] **[A] 0.10** Ten plan leży już w `context/changes/deployment/deployment-plan.md` — potwierdź, że jest w repozytorium i objęty pierwszym commitem.

**Gotowe, gdy:** build + `astro check` + lint zielone; `git log` ma commit; `.wrangler/deploy/config.json` przeczytany; na Cloudflare nadal nic nie ma.

---

## Faza 1 — Tożsamość workera (przed jakimkolwiek wdrożeniem)

_Wejście:_ Faza 0. _Wyjście:_ zbudowana konfiguracja mówi `trending-skins`, a pod starą nazwą nigdy nic nie wdrożono.

Kolejność jest celowa: „zmiana nazwy tworzy drugiego workera" jest problemem do sprzątania **tylko jeśli wdrożysz wcześniej**. Zmiana nazwy przed pierwszym wdrożeniem czyni to nie-zdarzeniem. Sekrety idą po nazwie, bo są przypisane do workera.

- [x] **[A] 1.1** `wrangler.jsonc`: `"name": "trending-skins"`.
- [x] **[A] 1.2** `package.json`: `"name": "trending-skins"`. Opcjonalnie `supabase/config.toml` → `project_id = "trending-skins"` (wpływa tylko na nazewnictwo lokalnych kontenerów; `npx supabase start` utworzy nowy lokalny stos — stary można zatrzymać przez `npx supabase stop --project-id 10x-astro-starter`).
- [x] **[A] 1.3** Przebuduj i **sprawdź wygenerowaną konfigurację**:
  ```powershell
  npm run build
  Get-Content dist\server\wrangler.json | ConvertFrom-Json | Select-Object name | Format-List
  ```
  Musi pokazać `trending-skins`. Jeśli nie — edycja nie dotarła do builda.
- [~] **1.4 Gałąź awaryjna (NIEAKTYWNA — stary worker nigdy nie istniał) — stary worker już istnieje.** Workers nie ma operacji zmiany nazwy. Zmiana `name` sprawia, że następne wdrożenie **tworzy nowego workera**; stary zachowuje swój adres `10x-astro-starter.lysiog16.workers.dev`, dalej serwuje stary bundle i trzyma własną kopię sekretów.
  - [ ] **[A]** `npx wrangler deployments list --name 10x-astro-starter`
  - [ ] **[A]** `npx wrangler tail --name 10x-astro-starter --format json` przez ~60 s — potwierdź, że nie odbiera nic istotnego
  - [ ] **[H]** `npx wrangler delete --name 10x-astro-starter` — operacja niszcząca, tylko człowiek. Usuwa też jego sekrety.
  - [ ] **[A]** Ponowny `deployments list` na starej nazwie musi zgłosić błąd

**Gotowe, gdy:** wygenerowany `wrangler.json` zawiera `"name":"trending-skins"`; `deployments list --name trending-skins` zgłasza „not found"; stara nazwa nie istnieje albo została usunięta.

---

## Faza 2 — Parzystość lokalna i głośny tryb awarii

_Wejście:_ Faza 1. _Wyjście:_ aplikacja działa pod `wrangler dev` (prawdziwy workerd, zbudowany bundle) przeciw lokalnemu Supabase, i istnieje maszynowo sprawdzalny sygnał „Supabase nieskonfigurowany".

Ta faza idzie **przed** pierwszym wdrożeniem celowo. `optional: true` znaczy, że całkowicie nieskonfigurowany worker zwraca na `/` **HTTP 200** — bez tego kroku weryfikacja Fazy 3 jest bezwartościowa.

- [x] **[A] 2.1** Utwórz `.dev.vars` (PowerShell: `Copy-Item .env.example .dev.vars`, nie `cp`). Wypełnij z lokalnego Supabase:

  ```powershell
  npx supabase start
  npx supabase status -o env | Select-String '^(API_URL|ANON_KEY)='
  ```

  Wymaga Dockera i ~7 GB RAM. (Alternatywa: użyj poświadczeń hostowanego projektu, ale wtedy smoke test z 2.6 tworzy prawdziwych użytkowników — patrz 3.7.)

  **Wykonano inaczej, świadomie (2026-10-02).** Docker Desktop nie jest zainstalowany na tej maszynie (WSL2 — Ubuntu 24.04 — jest, Supabase CLI 2.117.0 też), a wolnej pamięci było 6,9 GB wobec ~7 GB wymaganych przez lokalny stos. Zamiast lokalnego Supabase użyto **osobnego, darmowego projektu stagingowego** `lqwpdqwptujpoxcogiwb` — ścieżki, którą krok 3.7 wskazuje jako właściwą dla pokrycia przepływu autoryzacji przeciw hostowanemu Supabase. Konsekwencje do zapamiętania:
  - Użytkownicy `smoke-<timestamp>@example.com` lądują w `auth.users` **stagingu**, nie produkcji. Warto je okresowo czyścić.
  - W stagingu wyłączono potwierdzanie e-maila (`mailer_autoconfirm: true`). **Na produkcji ma zostać włączone** — patrz 3.7.
  - Projekt stagingowy zajmuje drugi z dwóch darmowych slotów Supabase i pauzuje po ~7 dniach bezczynności (patrz 5.6).
  - Klucz ma nowy format `sb_publishable_*`, nie starszy anon-JWT. Działa z `@supabase/ssr` 0.12.7 / `supabase-js` 2.116.0 — zweryfikowane smoke'iem 8/8.
  - Docker wróci jako realna potrzeba dopiero przy pierwszej migracji schematu; dziś `supabase/` ma tylko `config.toml`.

- [x] **[A] 2.2** Dodaj `src/pages/api/health.ts` — mechanizm głośnej awarii:
  ```ts
  import type { APIRoute } from "astro";
  import { SUPABASE_URL, SUPABASE_KEY } from "astro:env/server";

  export const GET: APIRoute = async () => {
    const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);
    let reachable: boolean | null = null;
    if (configured) {
      try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: SUPABASE_KEY } });
        reachable = r.ok;
      } catch {
        reachable = false;
      }
    }
    const ok = configured && reachable !== false;
    return new Response(JSON.stringify({ ok, supabase: { configured, reachable } }), {
      status: ok ? 200 : 503,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  };
  ```
  Dlaczego to, a nie sam baner: `src/lib/config-status.ts` wylicza `missingConfigs` **na poziomie modułu**, więc czerwony baner jest zapiekany per izolat i jest dobrym sygnałem **dla człowieka** — ale to HTML ze statusem 200. `/api/health` daje nie-200, które da się sprawdzić jednolinijkowcem w CI i w monitoringu, i rozróżnia „nieskonfigurowany" od „skonfigurowany, ale Supabase leży".
- [x] **[A] 2.3** Uruchom prawdziwy workerd na zbudowanym bundlu:
  ```powershell
  npm run build
  npx wrangler dev --port 8787
  ```
  `wrangler dev` korzysta z **przekierowanej** zbudowanej konfiguracji, więc to najbliższy lokalny odpowiednik produkcji — bliższy niż `npm run dev` (port 4321, serwer Vite).
- [x] **[A] 2.4** Weryfikacja ręczna (**w PowerShell 5.1 `curl` to alias `Invoke-WebRequest` — pisz `curl.exe`**):
  ```powershell
  curl.exe -s -o NUL -w "%{http_code}`n" http://localhost:8787/
  curl.exe -s http://localhost:8787/api/health
  curl.exe -s -o NUL -w "%{http_code} %{redirect_url}`n" http://localhost:8787/dashboard
  ```
  Oczekiwane: `200`, `{"ok":true,...}`, `302 .../auth/signin`.
- [x] **[A] 2.5** Smoke test przeciw `wrangler dev` + lokalny Supabase:
  ```powershell
  $env:BASE_URL="http://localhost:8787"; npm run smoke
  ```
  Wymaga wyłączonego potwierdzania e-maila (`supabase/config.toml` → `[auth.email] enable_confirmations = false`). 8/8 kroków PASS.
- [x] **[A] 2.6 Test negatywny — ten, który nadaje sens Fazie 3.** Usuń `.dev.vars`, przebuduj, uruchom ponownie. `/api/health` musi zwrócić **503** z `configured:false`, a `/` wyrenderować czerwony baner. Przywróć `.dev.vars`.
- [x] **2.7 Gałąź awaryjna — `dynamic require of "stream" is not supported`** (kształt supabase#37592, zgłoszenie zamknięte, rozwiązaniem było `nodejs_compat`). Sprawdź, czy `compatibility_flags` w **wygenerowanym** `wrangler.json` nadal zawiera `nodejs_compat`. Jeśli tak, a błąd trwa: `npm ls @supabase/ssr` (czy nic nie podniosło innej wersji). **Nie próbuj naprawiać przez podbicie wersji** — przypnij mocniej i odtwórz w izolacji.
- [ ] **2.8 Gałąź awaryjna — `wrangler dev` nie widzi sekretów.** Plugin kopiuje `.dev.vars` do katalogu wyjściowego workera **w czasie budowania**. `.dev.vars` zmienione po ostatnim buildzie nie zostanie podchwycone — przebuduj. (Uwaga uboczna: build kopiuje Twoje lokalne poświadczenia do `dist/`. `dist/` jest ignorowane przez gita, ale nigdy nie publikuj go jako artefaktu.)
- [ ] **2.9 Gałąź awaryjna — `npm run build` pada na `EPERM, Permission denied: dist\client`** (zaobserwowane 2026-10-02). Przyczyna nie ma nic wspólnego z uprawnieniami: działający `wrangler dev` trzyma uchwyt na `dist\client`, a Astro czyści ten katalog na starcie builda. Objaw dodatkowy: `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)`. **Zatrzymanie serwera przed każdym `npm run build` jest warunkiem, nie higieną.** Namierzenie winowajcy:
  ```powershell
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*wrangler*' } | Select-Object ProcessId,CommandLine
  ```
  To samo dotyczy Workers Builds tylko teoretycznie — każdy build startuje tam w świeżym kontenerze.

**Gotowe, gdy:** `/api/health` = 200 `configured:true`; smoke 8/8; test negatywny 2.6 wykonany i daje 503.

**Wynik (2026-10-02, staging `lqwpdqwptujpoxcogiwb`, `wrangler dev` na :8787):** `/` = 200 bez banera · `/api/health` = **200** `{"ok":true,"supabase":{"configured":true,"reachable":true}}` · `/dashboard` = 302 → `/auth/signin` · **smoke 8/8 PASS** · test negatywny w pełnym cyklu (sekrety → usunięcie → przebudowa → **503** `configured:false` + czerwony baner → przywrócenie → 200) · wygenerowany `wrangler.json`: `name: trending-skins`, `compatibility_flags: ["nodejs_compat"]`.

---

## Faza 3 — Pierwsze wdrożenie produkcyjne (wersja podglądowa → promocja)

_Wejście:_ Faza 2 wraz z testem negatywnym. _Wyjście:_ `https://trending-skins.lysiog16.workers.dev` serwuje aplikację ze skonfigurowanym Supabase, osiągnięte przez wersję podglądową zweryfikowaną zanim ruch się przełączył.

- [x] **[H] 3.1 Poświadczenia.** **Wykonano 2026-10-08:** token `trending-skins-deploy` (`Workers Scripts:Edit`, `Workers Observability:Read`, **dodatkowo `Workers Tail:Read`** — bez niego `wrangler tail` z Fazy 5 nie zadziała), plus `CLOUDFLARE_ACCOUNT_ID` w zmiennych użytkownika (`setx`). `wrangler whoami` potwierdza logowanie tokenem; brak `User Details:Read` daje tylko ostrzeżenie o e-mailu — celowo. Subdomena konta: **`lysiog16.workers.dev`**. Jesteś już zalogowany (`wrangler whoami` pokazuje konto `<e-mail właściciela>'s Account`, ID `4f2592b44efa736773d92fcf1eaa4978`), ale **to sesja OAuth z bardzo szerokimi uprawnieniami** (workers, d1, kv, queues, containers, email, secrets_store — zapis). Zgodnie z barierą dostępu produkcyjnego z `infrastructure.md` wygeneruj **token API o wąskim zakresie**: `Workers Scripts:Edit` + `Workers Observability:Read`, wyłącznie to konto, bez DNS, bez rozliczeń. Trzymaj go w zmiennej środowiskowej `CLOUDFLARE_API_TOKEN`, nigdy w pliku w repozytorium. Ten sam token pójdzie do sekretów GitHuba w Fazie 4.
- [x] **[A] 3.2 Pierwsze wdrożenie celowo BEZ sekretów.** `wrangler secret put` na nieistniejącym workerze zgłosi „script not found", więc kolejność i tak jest wymuszona — a przy okazji sprawdzasz wykrywacz trybu zdegradowanego na produkcji, zanim mu zaufasz.

  ```powershell
  npm run build
  npx wrangler versions upload --preview-alias pre
  ```

  Zapisz Version ID i adres podglądu (`https://pre-trending-skins.lysiog16.workers.dev`).

  **Zaobserwowane 2026-10-08 — ten krok w tej postaci NIE DZIAŁA dla nowego workera:** `versions upload` kończy się błędem _„You cannot upload a new version of a Worker that does not yet exist. Please run the `deploy` command first."_ (nic nie zostało wysłane). Pierwsze utworzenie workera wymaga `wrangler deploy`, które od razu kieruje 100% ruchu na nową wersję. Wersja podglądowa przed pierwszym ruchem produkcyjnym jest więc niemożliwa; dopiero od drugiej wersji `versions upload` działa. Build z tego kroku sprawdzony: poświadczenia z `.dev.vars` trafiają wyłącznie do `dist/server/.dev.vars` (nie do bundla), zasoby statyczne to `dist/client`, a `.assetsignore` wyklucza `.dev.vars`.

  **Drugie potknięcie (2026-10-08):** `wrangler deploy` padł na `/storage/kv/namespaces` — token nie ma uprawnień do KV, i dobrze. Źródło: `@astrojs/cloudflare` 14.3.1 **sam dokleja** do wygenerowanego `wrangler.json` wiązanie `SESSION` (KV, domyślny sterownik Astro Sessions), a wrangler 4 próbuje je **automatycznie utworzyć** przy deployu. Do tego wiązanie `IMAGES` (Cloudflare Images, domyślny `imageService: "cloudflare-binding"`). Aplikacja nie używa ani sesji Astro, ani `astro:assets`, więc w `astro.config.mjs`: `session: false` + `cloudflare({ imageService: "passthrough" })`. Po przebudowie `kv_namespaces: []`, brak `images`; `astro check` 0 błędów, lint czysty. Przy okazji domyka to kontrakt budżetowy — ani KV, ani Images nie wchodzą do projektu bez osobnej decyzji.

- [x] **[A] 3.3** Sprawdź podgląd: `/api/health` musi zwrócić **503** z `configured:false`. To potwierdza, że detektor działa na produkcji. **Wynik (2026-10-08, V1 `9524a0fb-f21b-462e-a27a-6dbaa357c8d3`, wdrożona przez człowieka `wrangler deploy` — na produkcji, nie na podglądzie, patrz 3.2):** `/` = 200 z czerwonym banerem „Supabase nie jest skonfigurowany" · `/api/health` = **503** `{"ok":false,"supabase":{"configured":false,"reachable":null}}` · `/dashboard` = 302 → `/auth/signin`.
- [x] **[H] 3.4 Ustaw sekrety — tylko człowiek, we własnym terminalu.** Projekt **produkcyjny** Supabase (nie staging `lqwpdqwptujpoxcogiwb`); URL i publishable/anon key.

  ```powershell
  npx wrangler versions secret put SUPABASE_URL --name trending-skins
  npx wrangler versions secret put SUPABASE_KEY --name trending-skins
  npx wrangler versions list --name trending-skins
  ```

  **Poprawka (zweryfikowane w kodzie wranglera 4.131.1, 2026-10-08):** pierwotna wersja tego kroku używała `wrangler secret put` — to **się wywraca**. Po 3.2 najnowsza wersja nie jest wdrożona, a `secret put` celowo odmawia wtedy działania (`VERSION_NOT_DEPLOYED`: _„use `wrangler versions secret put` instead"_), bo zwykłe `secret put` tworzy wersję **i ją wdraża**. `versions secret put` tworzy nową wersję (ten sam bundle + sekret) **bez** wdrożenia. Każde wywołanie to osobna wersja — po dwóch mamy V3 z obydwoma sekretami.

  `--name` nie jest kosmetyką — broni przed przekierowaniem konfiguracji z §2 kontekstu.

- [x] **[A] 3.5 Zweryfikuj podgląd NOWEJ wersji, BEZ przebudowy:**

  ```powershell
  curl.exe -s -o NUL -w "%{http_code}`n" https://<8-znaków-ID>-trending-skins.lysiog16.workers.dev/
  curl.exe -s https://<8-znaków-ID>-trending-skins.lysiog16.workers.dev/api/health
  curl.exe -s -o NUL -w "%{http_code} %{redirect_url}`n" https://<8-znaków-ID>-trending-skins.lysiog16.workers.dev/dashboard
  ```

  **Poprawka:** sekrety są częścią **wersji**, nie workera. Alias `pre` zostaje przypięty do V1 (bez sekretów) i dalej dawałby 503. Sprawdza się adres podglądu wersji z sekretami — prefiks to pierwsze 8 znaków jej Version ID.

  **Bramka: `/api/health` musi zwrócić 200 z `configured:true, reachable:true`.**

  **Wynik (2026-10-08):** V2 `9d1e6688` (tylko `SUPABASE_URL`) → `/api/health` 503 `configured:false`, baner widoczny. V3 `5555cb82-15b2-4e90-a8ac-7f9a56f91aff` (oba sekrety) → `/` 200 bez banera · `/api/health` **200** `{"ok":true,"supabase":{"configured":true,"reachable":true}}` · `/dashboard` 302 → `/auth/signin`. Produkcja (V1) w tym czasie bez zmian: 503 — `versions secret put` faktycznie nie wdraża.

- [x] **[A] 3.6 Rozstrzygnij empirycznie „sekrety w buildzie czy w runtime" — raz, i zapisz wynik.** Przejście 3.3 (503 na V1) → 3.5 (200 na V3) przy **tym samym bundlu, bez przebudowy** jest już dowodem rozwiązywania w runtime. Domknij to testem rotacji:
  1. **[H]** `versions secret put SUPABASE_KEY` z celowo błędną wartością → V4.
  2. **[A]** Podgląd V4: `/api/health` musi dać `reachable:false`.
  3. **[H]** `versions secret put SUPABASE_KEY` z poprawną wartością → V5; **[A]** podgląd V5 = 200.

  Krok 3 **nie jest opcjonalny**: kolejne wdrożenia dziedziczą sekrety z poprzednich wersji — gdyby najnowsza wersja niosła zły klucz, Workers Builds mógłby go przenieść na produkcję. Promujemy V5, nie V3 — wtedy najnowsza wersja = wdrożona, i zwykłe `secret put` znów działa przy przyszłych rotacjach.

  Jeśli krok 2 **nie** przeskoczy, wiersz rejestru ryzyk „rotacja sekretu wymaga przebudowania" jest potwierdzony i każda rotacja staje się `build + versions upload + versions deploy`. Zapisz obserwowany wynik w `deployment-plan.md` — nie przenoś założenia dalej.

  **Wynik (2026-10-08) — ROZSTRZYGNIĘTE: sekrety `astro:env` rozwiązują się w runtime.** Ten sam bundle bez przebudowy: V1 `9524a0fb` 503 `configured:false` → V3 `5555cb82` 200. Rotacja: V4 `f3eb8e16` (celowo zły `SUPABASE_KEY`) → `/api/health` **503** `{"configured":true,"reachable":false}`; V5 `4dfecc84-fa82-42b8-81a8-6462dcb3633c` (klucz przywrócony) → **200** `reachable:true`, `/` 200 bez banera, `/dashboard` 302, `/auth/signin` 200. Wiersz rejestru „rotacja sekretu wymaga przebudowania" — **obalony**: rotacja = `versions secret put` + `versions deploy`, bez builda. Projekt produkcyjny Supabase: `wuboridtwewsqzctutss` (publishable key zweryfikowany bezpośrednio wobec `/auth/v1/health` = 200).

- [x] **[H] 3.7 NIE uruchamiaj `npm run smoke` przeciw produkcji.** Skrypt woła `POST /api/auth/signup` z `smoke-<timestamp>@example.com` i tworzy **prawdziwy wiersz w `auth.users`**, a przechodzi tylko przy wyłączonym potwierdzaniu e-maila — czego na produkcji nie chcesz. Zamiast tego **sonda tylko do odczytu** jako produkcyjny test akceptacyjny: trzy wywołania `curl.exe` z 3.5 (`/` = 200, `/api/health` = 200, `/dashboard` = 302 → `/auth/signin`). Zero zapisów, zero autoryzacji. Pełny smoke zostaje tam, gdzie jest: lokalny Supabase + `wrangler dev` (2.5) i job `smoke` w CI. Gdybyś kiedyś potrzebował pokrycia przepływu autoryzacji przeciw hostowanemu Supabase — osobny projekt stagingowy, nigdy produkcyjny. **Przestrzegane:** przeciw produkcji biegły wyłącznie sondy GET (curl), żadnego signupu.
- [x] **[H] 3.8 Promuj — przesunięcie ruchu produkcyjnego.** **Wykonano 2026-10-08 12:39 UTC (człowiek):** V5 `4dfecc84-fa82-42b8-81a8-6462dcb3633c` na 100%.
  ```powershell
  npx wrangler versions list --name trending-skins
  npx wrangler versions deploy <ID-V5>@100% --name trending-skins
  ```
- [x] **[A] 3.9 Zweryfikuj produkcję** tymi samymi trzema sondami przeciw `https://trending-skins.lysiog16.workers.dev`, plus `npx wrangler deployments list` pokazujący oczekiwaną wersję na 100%. **Wynik:** `/` 200 bez banera · `/api/health` **200** `{"ok":true,"supabase":{"configured":true,"reachable":true}}` · `/dashboard` 302 → `/auth/signin` · `deployments list`: najnowsze wdrożenie = V5 @ 100% (poprzednie: V1 @ 100%).
- [x] **[A] 3.10** Ustaw `site: "https://trending-skins.lysiog16.workers.dev"` w `astro.config.mjs`. `sitemap()` jest dziś włączony **bez** `site`, więc tylko ostrzega i nie emituje nic użytecznego. Przebuduj. **Wykonano:** build emituje `sitemap-index.xml` + `sitemap-0.xml`; `astro check` 0 błędów, lint czysty. **Jeszcze niewdrożone** — zmiana trafi na produkcję z najbliższym wdrożeniem (pierwszy build Workers Builds w Fazie 4 albo ręczne `cf:preview` → `versions deploy`).
- [ ] **3.11 Gałąź awaryjna — wycofanie.**
  ```powershell
  npx wrangler deployments list --name trending-skins
  npx wrangler rollback <VERSION_ID> --name trending-skins
  ```
  Liczone w sekundach. Zastrzeżenie z `infrastructure.md`: **wycofanie kodu nie cofa zmian w Supabase.** W tej zmianie nie ruszamy schematu, więc na razie to bezpieczne — ale od pierwszej migracji każde wycofanie musi pytać „czy stary bundle toleruje nowy schemat?".
- [ ] **3.12 Gałąź awaryjna — `No such module` / nierozwiązany `virtual:astro-cloudflare:config` przy wdrożeniu.** Wdrożyłeś bez budowania albo `main` wskazuje coś, czego build Astro nie przetworzył. `npm run build`, ponów.

**Gotowe, gdy:** produkcyjny `/api/health` = 200 `{configured:true,reachable:true}`; `/` = 200 bez czerwonego banera; `/dashboard` = 302; `deployments list` pokazuje jedną wersję na 100%; odpowiedź z 3.6 zapisana w pliku planu.

**Faza 3 ZAMKNIĘTA (2026-10-08).** Produkcja: `https://trending-skins.lysiog16.workers.dev`, V5 na 100%, Supabase `wuboridtwewsqzctutss`. Trzy odstępstwa od pierwotnego planu, wszystkie opisane wyżej: (1) pierwsza wersja musiała pójść przez `wrangler deploy` prosto na produkcję, bo `versions upload` nie tworzy workera; (2) `versions secret put` zamiast `secret put` i podgląd per wersja zamiast aliasu `pre`; (3) wyłączone wiązania `SESSION`/`IMAGES` w adapterze.

---

## Faza 4 — Git, GitHub i auto-deploy przez Cloudflare Workers Builds

_Wejście:_ Faza 3 — istnieje znane-dobre wdrożenie produkcyjne, do którego można wrócić, **i worker nazywa się już `trending-skins`**. _Wyjście:_ push na `master` buduje i wdraża po stronie Cloudflare; gałęzie poboczne dostają adresy podglądowe; ścieżka ręczna nadal działa.

Dlaczego dopiero teraz, a nie zamiast Fazy 3: Workers Builds wymaga, żeby **nazwa workera w panelu odpowiadała `name` w konfiguracji wrangler**, a worker musi istnieć, żeby dało się go podłączyć do repozytorium. Pierwsze wdrożenie ręczne ustala tożsamość i dowodzi, że sekrety działają — dopiero potem automat ma co przejmować.

### Stan Fazy 4 (2026-10-08)

| Krok                                    | Stan                                                                                             |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 4.1 repozytorium                        | ⏳ **czeka na człowieka** — decyzja podjęta (publiczne), historia oczyszczona, polecenia poniżej |
| 4.2–4.4 husky, skrypty, Node            | ✅ commit `ac3ab77`                                                                              |
| 4.5–4.8 Workers Builds + ochrona gałęzi | ⬜ po 4.1                                                                                        |
| 4.9 bez build variables                 | ⬜ do potwierdzenia przy 4.6                                                                     |
| 4.10 sekrety GitHuba                    | ⏭️ **zbędne** — patrz rewizja przy kroku                                                         |
| 4.11 `verify-production.yml`            | ✅ commit `7071f42`                                                                              |
| 4.12 test end-to-end                    | ⬜                                                                                               |

**Granica agent / człowiek w praktyce.** Tryb auto Claude Code blokuje agentowi zarówno `wrangler deploy` (Faza 3), jak i `gh repo create … --push` (ustawienie zdalnego repo + wypchnięcie). Niezależnie od oznaczeń `[A]` w tym planie — **pierwsze wdrożenie, utworzenie repozytorium i push wykonuje człowiek**. Agent przygotowuje wszystko lokalnie i weryfikuje po fakcie.

### 4a. Repozytorium

- [ ] **[H] 4.1 Repozytorium — PUBLICZNE (zmiana względem planu, decyzja 2026-10-08).** Pierwotnie `--private`. Zmienione, bo **GitHub Free nie egzekwuje ochrony gałęzi w repozytoriach prywatnych** (wymaga Pro) — a 4.8 to jedyna bramka jakości przed auto-deployem. Publiczne repo daje ją za darmo i przy okazji **nielimitowane minuty Actions** (domyka B.3). Rozważone i odrzucone: prywatne z ręczną promocją (`versions upload` w Workers Builds) oraz prywatne bez bramki.

  **Przygotowanie do upublicznienia (wykonane przez agenta, lokalnie, przed jakimkolwiek pushem):**
  - Skan historii: brak kluczy, tokenów, `.dev.vars`, `.env` — czysto.
  - Znalezione dwa adresy e-mail: autor wszystkich commitów (adres służbowy) oraz e-mail konta Cloudflare w treści planu (krok 3.1/uwaga o tokenie). **Historia przepisana** (`git filter-branch`, 10 commitów): autor i committer → `17855526+lysio@users.noreply.github.com`, e-mail w planie → `<e-mail właściciela>`. Zweryfikowane: zero wystąpień w historii `master`; jedyna różnica treści względem oryginału to ta jedna linia.
  - `git config user.email` (lokalnie, tylko to repo) ustawione na adres noreply — przyszłe commity go używają.
  - **Kopia sprzed przepisania: lokalna gałąź `backup/przed-ukryciem-email` — zawiera oba adresy, NIGDY jej nie wypychaj.** Można ją usunąć (`git branch -D backup/przed-ukryciem-email`), gdy push się powiedzie.
  - Jawne po upublicznieniu (świadomie, nie są sekretami): ID konta Cloudflare, ID projektów Supabase (prod i staging), subdomena `lysiog16.workers.dev`, treść planu.

  **Polecenia (człowiek):**

  ```powershell
  gh repo create trending-skins --public --source . --remote origin
  git push -u origin master
  ```

  **Bez `--push` i bez `git push --all`** — wypchnęłyby gałąź kopii. Push uruchamia `ci.yml` po raz pierwszy w historii projektu; job `smoke` nigdy wcześniej nie biegł.

- [x] **[A] 4.2 Napraw husky.** `package.json` nie ma skryptu `prepare`, więc haki nie instalują się nawet teraz, gdy `.git` istnieje. Dodaj `"prepare": "husky"` i `npm install` — inaczej lint-staged nigdy nie zadziała. **Wykonano 2026-10-08:** `core.hooksPath = .husky/_`. Uwaga: lokalny npm 12.0.2 (Node 24.17) **domyślnie blokuje skrypty instalacyjne zależności** (`npm warn install-scripts esbuild… workerd…`) — `prepare` własnego pakietu biegnie, ale postinstall `esbuild`/`workerd` nie. Dziś bez skutków (binarki już na dysku), na świeżym klonie z npm 12 może być potrzebne `npm install-scripts approve esbuild workerd`. CI i Workers Builds (Node 22 → npm 10) tego nie dotyczy.
- [x] **[A] 4.3 Dodaj skrypty npm** (dziś nie ma żadnego skryptu wdrożeniowego):
  ```json
  "check": "astro check",
  "cf:types": "wrangler types",
  "cf:dev": "wrangler dev --port 8787",
  "cf:preview": "npm run build && wrangler versions upload --preview-alias pre",
  "cf:tail": "wrangler tail --name trending-skins --format json",
  "cf:deploy": "npm run build && wrangler deploy"
  ```
  **Wykonano 2026-10-08** razem z `"prepare": "husky"` (4.2).
- [x] **[A] 4.4 Uzgodnij wersję Node'a z obrazem budowania.** `.nvmrc` niesie dziś `22.14.0`, a obraz Workers Builds ma preinstalowane **tylko** `22.23.2` i `24.18.0` (domyślna od 2026-07-30 to Node 24). Workers Builds honoruje `.nvmrc`, `.node-version` i zmienną `NODE_VERSION`, ale proszenie o wersję spoza obrazu w najlepszym razie wydłuża build, w najgorszym go wywraca. Ustaw `.nvmrc` na `22.23.2` (zachowuje linię 22, którą testuje CI) i wyrównaj `node-version: 22.23.2` w `.github/workflows/ci.yml`, żeby CI i Workers Builds budowały tym samym. **Wykonano 2026-10-08:** `.nvmrc` = `22.23.2`, oba joby w `ci.yml` = `22.23.2`; build, `astro check` (0 błędów) i lint zielone. Pierwszy commit z aktywnym hakiem pre-commit — lint-staged uruchomił prettier, działa.

### 4b. Podłączenie Workers Builds

- [ ] **[H] 4.5 Podłącz repozytorium — panel, jednorazowo.** **Workers & Pages → `trending-skins` → Settings → Builds → Connect**, autoryzuj aplikację Cloudflare GitHub, wskaż repozytorium `trending-skins`. Zakres uprawnień ogranicz do **tego jednego repozytorium**, nie całego konta.
- [ ] **[H] 4.6 Ustaw konfigurację budowania:**

  | Pole                    | Wartość               | Uwaga                                                                          |
  | ----------------------- | --------------------- | ------------------------------------------------------------------------------ |
  | Git branch (production) | **`master`**          | Domyślną jest `main` — **musisz to zmienić**, inaczej nic nigdy się nie wdroży |
  | Build command           | `npm run build`       |                                                                                |
  | Deploy command          | `npx wrangler deploy` | wartość domyślna; zostaw                                                       |
  | Root directory          | `/`                   |                                                                                |
  | Build variables         | _(puste)_             | patrz 4.8                                                                      |

  Nie ma potrzeby podawać tokenu API — Workers Builds działa na uprawnieniach konta, nie przez `CLOUDFLARE_API_TOKEN`. Token o wąskim zakresie z 3.1 zostaje do ręcznych operacji z Twojej maszyny.

- [ ] **[A] 4.7** Zweryfikuj w panelu, że `name` workera (`trending-skins`) zgadza się z `name` w `wrangler.jsonc`. **Niezgodność = build przechodzi, wdrożenie pada.**
- [ ] **[H] 4.8 Ochrona gałęzi `master`** (GitHub → Settings → Branches): wymagaj PR przed merge, wymagaj zielonych statusów `ci` i `smoke`. **To jedyna bramka jakości, jaka istnieje w tym układzie** — Workers Builds nie zna wyników GitHub Actions i wdroży każdy push na `master` niezależnie od nich. **Wykonalne na GitHub Free tylko dlatego, że repozytorium jest publiczne** (patrz 4.1). Statusy `ci` i `smoke` pojawią się do wyboru dopiero po ich pierwszym uruchomieniu — czyli po pierwszym pushu.

### 4c. Sekrety — dwa osobne magazyny

- [ ] **[A] 4.9 Nie dodawaj `SUPABASE_URL` / `SUPABASE_KEY` jako build variables.** Dokumentacja jest jednoznaczna: _„Build variables will not be accessible at runtime"_. A ustaliliśmy w kroku 3.6, że `astro:env` rozwiązuje sekrety **w runtime** z `cloudflare:workers` — więc wartości z etapu budowania i tak nie trafiłyby do działającego workera. Runtime bierze je z sekretów workera ustawionych w 3.4 i **Workers Builds ich nie nadpisuje ani nie kasuje**. Build przechodzi bez nich, bo są `optional: true`.
- [ ] **[H] 4.10 Sekrety GitHuba** (Settings → Secrets → Actions): `SUPABASE_URL` i `SUPABASE_KEY` — potrzebne wyłącznie jobowi `ci`, który już ich oczekuje przy buildzie. `CLOUDFLARE_API_TOKEN` i `CLOUDFLARE_ACCOUNT_ID` **nie są tu potrzebne** — GitHub Actions nic nie wdraża.

  **Rewizja (2026-10-08) — krok zbędny, zalecam pominąć.** Krok 3.6 rozstrzygnął, że sekrety `astro:env` (`access: "secret"`) są czytane w runtime i **nie** są wkompilowywane w bundle; są też `optional: true`. Build w jobie `ci` przechodzi więc bez nich identycznie (w 3.2 przeszukanie zbudowanego bundla potwierdziło, że wartości z `.dev.vars` nie trafiają do kodu — leżą tylko w `dist/server/.dev.vars`, którego wrangler nie wysyła). Wpisanie ich do GitHuba tylko dokłada trzecie miejsce, w którym żyją poświadczenia produkcyjne, bez żadnego zysku. Odwołania `${{ secrets.SUPABASE_* }}` w `ci.yml` przy braku sekretu rozwijają się do pustego stringa — nieszkodliwe.

### 4d. Weryfikacja po wdrożeniu

- [x] **[A] 4.11 Dodaj `.github/workflows/verify-production.yml`** — Workers Builds raportuje „deployed", nie „działa poprawnie". Bez tego ciche wejście w tryb zdegradowany przechodzi niezauważone; to jest rekompensata za usuniętą ludzką bramkę: **Wykonano 2026-10-08** (plus `timeout-minutes: 5`); logika sondy sprawdzona lokalnie przeciw produkcji — PASS.

  ```yaml
  name: Verify production
  on:
    workflow_dispatch:
    schedule:
      - cron: "20 6 * * *" # raz na dobę — patrz kontrakt budżetowy B.3
  jobs:
    probe:
      runs-on: ubuntu-latest
      steps:
        - name: Probe production
          run: |
            set -e
            BASE=https://trending-skins.lysiog16.workers.dev
            test "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")" = "200"
            curl -sf "$BASE/api/health" | tee /dev/stderr | grep -q '"ok":true'
            test "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/dashboard")" = "302"
  ```

  **Dlaczego raz na dobę, a nie co godzinę:** repozytorium jest prywatne, więc GitHub Actions ma 2 000 minut miesięcznie. Godzinowa sonda to 720 uruchomień, dobowa — 30. Przy jobie `smoke`, który startuje Supabase w Dockerze i zjada kilka minut na push, różnica jest istotna. Po wyczerpaniu minut zadania **twardo się zatrzymują** (limit wydatków 0 USD), więc to nie ryzyko rachunku, tylko ryzyko utraty CI.

  Uwaga o `schedule` w GitHub Actions: ma własny rozrzut 5–15 minut i **wyłącza się po 60 dniach bezczynności repozytorium**. Jako monitoring wystarcza na MVP; nie jest to substytut zadania cyklicznego platformy. Realny monitoring dostępności przyjdzie wraz z cronem Cloudflare (darmowy, 5 wyzwalaczy na konto) — do tego czasu `workflow_dispatch` po każdej dłuższej przerwie jest tańszy niż jakikolwiek harmonogram.

- [ ] **[A] 4.12 Sprawdź całość od końca do końca.** Gałąź → trywialny commit → PR. Obserwuj po kolei:
  1. GitHub Actions: `ci` i `smoke` zielone;
  2. Workers Builds: build gałęzi pobocznej → **adres podglądowy wklejony jako komentarz do PR**;
  3. otwórz ten adres, sprawdź `/api/health` = 200;
  4. merge do `master` → build produkcyjny → nowa wersja w Version History, awansowana na Active Deployment;
  5. uruchom `verify-production` ręcznie (`workflow_dispatch`) — musi przejść.
- [ ] **4.13 Gałąź awaryjna — build przechodzi, wdrożenie pada na niezgodności nazw.** Objaw: log budowania kończy się błędem na `wrangler deploy` przy kroku rozwiązywania workera. Przyczyna: `name` w `wrangler.jsonc` ≠ nazwa workera w panelu. Nie zmieniaj nazwy w panelu (utworzysz drugiego workera — patrz 1.4); popraw `wrangler.jsonc`.
- [ ] **4.14 Gałąź awaryjna — build przechodzi, `/api/health` zwraca 503 `configured:false`.** Sekrety workera zniknęły albo nigdy nie dotarły. **Sekrety GitHuba, build variables Workers Builds i sekrety workera to trzy różne magazyny** — tylko ostatni liczy się w runtime. `npx wrangler secret list --name trending-skins`, potem 3.4. Natychmiastowe cofnięcie: `npx wrangler rollback --name trending-skins`.
- [ ] **4.15 Gałąź awaryjna — nic się nie wdraża po merge'u.** Kolejność sprawdzania: (a) gałąź produkcyjna w Workers Builds ustawiona na `master`, nie `main` (najczęstsza przyczyna); (b) aplikacja GitHub ma dostęp do tego repozytorium; (c) log budowania w **Settings → Builds → History** — szukaj błędu Node'a z 4.4.
- [ ] **4.16 Gałąź awaryjna — wdrożenie wysokiego ryzyka.** Ścieżka ręczna nie znika i ma pierwszeństwo, gdy zmiana dotyka autoryzacji, punktu wejścia albo konfiguracji wrangler: `npm run cf:preview` → zweryfikuj alias `pre` → `npx wrangler versions deploy <ID>@100%`. Jeśli chcesz **na stałe** rozdzielić „buduj" od „wdrażaj", zmień Deploy command na `npx wrangler versions upload` — wtedy Workers Builds produkuje wersję na każdy commit, a promocja zostaje ręczna. To przywraca ludzką bramkę z `infrastructure.md`; rozważ, jeśli auto-deploy kiedyś Cię sparzy.

**Gotowe, gdy:** merge do `master` kończy się nową Active Deployment wyprodukowaną przez Workers Builds; PR z gałęzi pobocznej dostaje działający adres podglądowy w komentarzu; `verify-production` przechodzi; `master` chroniony; ręczna ścieżka podglądowa sprawdzona co najmniej raz.

---

## Faza 5 — Obserwowalność i utrzymanie się w darmowym CPU

_Wejście:_ 24 h ruchu po wdrożeniu. _Wyjście:_ zmierzone p99 CPU z marginesem do 10 ms, zapisane wraz z datą.

Ta faza zmieniła sens wraz z ograniczeniem kosztowym. Wcześniej pytanie brzmiało „czy płacić $5?". Teraz brzmi: **„czy mieścimy się w 10 ms, a jeśli nie — co wyciąć?"**. Przekroczenie nie jest wydatkiem, tylko **błędem 500 dla użytkownika** (`exceededCpu` zabija żądanie), więc budżet CPU awansował z pozycji kosztowej na wymaganie funkcjonalne.

- [ ] **[A] 5.1 Podgląd na żywo:**
  ```powershell
  npx wrangler tail --name trending-skins --format json
  npx wrangler tail --name trending-skins --status error
  ```
  Rozstrzygające pole to `outcome`. Szukaj **`exceededCpu`** (twardy limit CPU — żądanie zabite), `exception`, `canceled`.
- [ ] **[A] 5.2 Percentyle.** `wrangler tail` daje zdarzenia, nie rozkłady. Po p50/p99 CPU idź do panelu: Workers & Pages → trending-skins → **Observability** (już włączone przez `"observability": { "enabled": true }`) → Metrics → CPU Time.
- [ ] **[A] 5.3 Progi alarmowe — zapisz teraz, zastosuj po 24 h.** Plan płatny jest wykreślony, więc progi uruchamiają **pracę nad kodem**, nie zakup:

  | Obserwacja                | Co znaczy              | Reakcja                                 |
  | ------------------------- | ---------------------- | --------------------------------------- |
  | jakikolwiek `exceededCpu` | użytkownik dostał błąd | **Pilne** — 5.5 natychmiast             |
  | p99 CPU `fetch` > 7 ms    | 70% budżetu zjedzone   | Optymalizuj teraz, zanim dojdzie ingest |
  | p99 CPU `fetch` 4–7 ms    | ciasno, ale działa     | Zaplanuj 5.5 przed pierwszym cronem     |
  | p99 CPU `fetch` < 4 ms    | zdrowo                 | Przelicz ponownie po dodaniu ingestu    |

- [ ] **[A] 5.4 Zapas, który już masz.** Żądania do zasobów statycznych są **darmowe, nielimitowane i nie liczą się do 100 000/dobę**. Wszystko, co da się przenieść z SSR do statyki (albo objąć `prerender`), schodzi z budżetu CPU całkowicie. Przy stronie logowania i rejestracji to realna opcja.
- [ ] **[A] 5.5 Wąskie gardło, którego należy się spodziewać — teraz z wyższym priorytetem.** `src/middleware.ts` woła `supabase.auth.getUser()` przy **każdym** żądaniu, łącznie z `/` i `/auth/*` — czyli dokładnie na ekranie, o którym mówi NFR „poniżej 1 s dla 95% wejść". Czekanie na sieć jest w Workers darmowe, ale weryfikacja JWT i parsowanie JSON już nie. Trzy cięcia, od najtańszego:
  1. **Pomiń wywołanie Supabase, gdy w żądaniu nie ma ciasteczka autoryzacyjnego.** Anonimowy użytkownik na ekranie wejściowym powinien kosztować zero pracy autoryzacyjnej. Jedno sprawdzenie nagłówka `Cookie` przed `createClient()`.
  2. **Rozwiązuj użytkownika tylko na trasach, które go potrzebują** — `PROTECTED_ROUTES` plus widoki pokazujące stan konta — zamiast globalnie.
  3. **Rozważ `prerender` dla stron statycznych** (`/auth/confirm-email` i podobne), co przenosi je do darmowej puli zasobów statycznych z 5.4.

  To **zmiana zachowania widoczna produktowo**, więc formalnie należy do planu kamieni milowych — ale przy twardym zerze i limicie 10 ms przestała być optymalizacją „miło mieć". Najpierw zmierz (5.2), potem tnij.

- [ ] **[A] 5.6 Pauzowanie darmowego Supabase.** Darmowe projekty pauzują po ~7 dniach bez aktywności; wybudzenie trwa od dziesiątek sekund do minut. Skutki: ekran wejściowy łamie NFR „<1 s", `/api/health` zwraca 503 z `reachable:false`. Bez zadania cyklicznego (odłożone) **nie ma nic, co utrzymywałoby projekt przy życiu** — a przy „kilku użytkownikach" ruch tego nie zapewni. Na teraz: sprawdzaj `/api/health` po każdej dłuższej przerwie i licz się z tym, że pierwsze żądanie po wznowieniu padnie, a drugie przejdzie. To nie jest błąd workera. Docelowe rozwiązanie przyjdzie samo wraz z godzinowym cronem.
- [ ] **[A] 5.7 Zapisz liczby** w `deployment-plan.md`: żądania/dobę vs 100 000, p50/p99 CPU dla `fetch`, zużyte minuty Workers Builds i GitHub Actions w tym cyklu rozliczeniowym, data odczytu.
- [ ] **[A] 5.8 Sprawdź, czy nic nie zaczęło kosztować.** Raz, po pierwszym pełnym miesiącu: Cloudflare **Billing → Usage** (plan nadal Free, brak metody płatności) oraz GitHub **Settings → Billing** (zużyte minuty vs 2 000, limit wydatków nadal 0 USD). Dwie minuty, a domyka kontrakt z góry dokumentu.

**Gotowe, gdy:** 24 h danych przeczytane; zero `exceededCpu`; p99 CPU zapisane z marginesem do 10 ms; oba panele rozliczeniowe potwierdzają zero.

---

## Świadomie odłożone (nie w tej zmianie)

| Rzecz                                            | Dlaczego odłożone                        | Co to kosztuje                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Punkt wejścia `scheduled` + `triggers.crons`** | Twoja decyzja: sam deploy                | `infrastructure.md` ocenia to ryzyko na **H/M** i przepisuje „zrób to w pierwszym tygodniu, nie w ostatnim". Mechanizm jest nieoczywisty: `main` musi zostać **ścieżką źródłową** w `wrangler.jsonc`, bo `@astrojs/cloudflare/handler` importuje wirtualny moduł `virtual:astro-cloudflare:config`, który rozwiązuje tylko pipeline Vite Astro. Kto spróbuje oczywistego `wrangler deploy src/worker.ts`, uzna, że podejście jest zepsute. **Wpisz to do `context/foundation/lessons.md`** (`/10x-lesson`) zanim wyleci z pamięci. Kosztowo cron jest bezpieczny: 5 wyzwalaczy na konto w darmowym planie, ale **ten sam limit 10 ms CPU** — a scoring całego rynku to praca czysto procesorowa. Bez planu płatnego jedyną drogą jest liczenie wsadowe z zapisem wyniku do bazy i ewentualny podział pracy na kilka wywołań.                                                                                                                                                                     |
| **Ingest ze Skinport**                           | Praca produktowa                         | Nierozstrzygnięte: `/v1/items` **wymaga** `Accept-Encoding: br`, a `fetch` w Workers historycznie nadpisuje ten nagłówek na `gzip`. Flaga `brotli_content_encoding` jest domyślnie włączona od `compatibility_date` 2024-04-29 (projekt ma 2026-05-08), więc powinno działać — ale to wymaga sprawdzenia **z wnętrza wdrożonego workera**, zanim powstanie kod ingestu. Jeśli nie zadziała: `DecompressionStream` w workerd obsługuje `gzip`/`deflate`, **nie `br`**, a czysto-JS-owy dekoder brotli nie zmieści się w 10 ms CPU — wtedy fetch przenosi się do GitHub Actions, a worker tylko czyta. **Uwaga kosztowa:** ta ścieżka awaryjna zjada minuty Actions (godzinowy ingest = 720 uruchomień/mc), co przy repozytorium prywatnym zderzy się z limitem 2 000 minut. Jeśli do niej dojdzie, repozytorium powinno stać się publiczne (Actions bez limitu) albo ingest musi biec rzadziej. Kontrakt limitów Skinport: cache 5 min, nie odpytywać częściej niż raz na 5 min, 8 żądań / 5 min. |
| **Reguła 60 minut świeżości (NFR)**              | Wymaga crona lub zewnętrznego wyzwalacza | Bez zadania cyklicznego ten NFR ma **zero implementacji**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **`security.checkOrigin`**                       | Nie jest hydrauliką wdrożeniową          | Wszystkie trzy endpointy autoryzacji to POST-y formularzowe mutujące sesję, a kontrola CSRF w Astro jest wyłączona. Staje się wykorzystywalne w chwili, gdy istnieje publiczny adres — pozycja na dzień 1 następnego planu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Migracje Supabase**                            | `supabase/` ma tylko `config.toml`       | Projekt korzysta wyłącznie z `auth.users`. Przy pierwszej własnej tabeli: RLS włączone, polityki granularne per operacja i per rola.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

---

## Czynności wyłącznie ludzkie (bariera dostępu produkcyjnego)

| Czynność                                                            | Faza      | Dlaczego                                     |
| ------------------------------------------------------------------- | --------- | -------------------------------------------- |
| Wygenerowanie tokenu API o wąskim zakresie                          | 3.1       | Tworzenie poświadczeń                        |
| `wrangler secret put` (każdy sekret, w tym rotacja)                 | 3.4       | Rejestr: „rotacja sekretów wymaga człowieka" |
| `wrangler versions deploy` (promocja ręczna)                        | 3.8, 4.16 | Przesunięcie ruchu produkcyjnego             |
| `wrangler delete --name 10x-astro-starter`                          | 1.4       | Operacja niszcząca                           |
| Podłączenie Workers Builds do repozytorium + konfiguracja budowania | 4.5, 4.6  | Nadanie Cloudflare dostępu do repozytorium   |
| Ochrona gałęzi `master` i sekrety GitHuba                           | 4.8, 4.10 | Konfiguracja dostępu; jedyna bramka jakości  |
| Potwierdzenie braku metody płatności (CF) i limitu 0 USD (GitHub)   | B.1, B.2  | Bariery kosztowe                             |

**Czynność zakazana, nie tylko ludzka:** przejście na Workers Paid, dodanie metody płatności do Cloudflare, podniesienie limitu wydatków GitHuba, zakup domeny. Ani agent, ani automat nie mają tego robić — a przy ograniczeniu „zero kosztów" także człowiek nie robi tego mimochodem w ramach tego planu. Gdyby okazało się to konieczne, jest to zmiana zakresu do osobnej decyzji, nie krok wdrożeniowy.

Agent może bez nadzoru: `npm run build`, `wrangler versions upload`, `wrangler tail`, `wrangler dev`, wszystkie polecenia `list` tylko do odczytu i całą weryfikację lokalną.

**Uwaga o Twoim obecnym tokenie:** `wrangler whoami` pokazuje sesję OAuth z uprawnieniami do zapisu na workers, KV, D1, queues, containers, secrets_store, email i połączeniach — to znacznie więcej, niż ten projekt potrzebuje, i jest wprost sprzeczne z zasadą „tokeny są wąsko zakresowane, nie kluczami-wytrychami" z `infrastructure.md`. Token z kroku 3.1 to zaadresuje dla operacji z Twojej maszyny. (Poboczne: wrangler zgłasza brak zakresu `websearch.run` — nieistotne tutaj, naprawiane przez `wrangler login`.)

---

## Macierz weryfikacji

| Faza | Polecenie                                              | Przechodzi, gdy                                                         |
| ---- | ------------------------------------------------------ | ----------------------------------------------------------------------- |
| 0    | `npm run build; npx astro check; npm run lint`         | wszystko kod wyjścia 0                                                  |
| 0    | odczyt `.wrangler\deploy\config.json`                  | istnieje, wskazuje na realny plik                                       |
| 1    | `.name` w zbudowanym `wrangler.json`                   | `trending-skins`                                                        |
| 2    | `curl.exe http://localhost:8787/api/health`            | 200 `configured:true`                                                   |
| 2    | to samo, bez `.dev.vars`, po przebudowie               | **503** `configured:false`                                              |
| 2    | `$env:BASE_URL="http://localhost:8787"; npm run smoke` | 8/8 PASS                                                                |
| 3    | podgląd `/api/health` przed sekretami                  | 503 `configured:false`                                                  |
| 3    | podgląd `/api/health` po sekretach, bez przebudowy     | 200 `configured:true`                                                   |
| 3    | test rotacji sekretu (3.6)                             | health przeskakuje bez przebudowy                                       |
| 3    | produkcja `/`, `/api/health`, `/dashboard`             | 200 / 200 / 302→`/auth/signin`                                          |
| 4    | PR z gałęzi pobocznej                                  | komentarz z adresem podglądowym; podgląd `/api/health` = 200            |
| 4    | merge do `master`                                      | Workers Builds → nowa Active Deployment; `verify-production` przechodzi |
| 5    | Observability, 24 h                                    | brak `exceededCpu`; p99 CPU `fetch` zapisane, najlepiej < 4 ms          |
| B    | CF Billing → Payment Info                              | puste (brak metody płatności)                                           |
| B    | GitHub Settings → Billing                              | limit wydatków 0 USD; minuty < 2 000                                    |

---

## Pliki dotknięte

| Plik                                            | Zmiana                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler.jsonc`                                | `name` → `trending-skins`                                                                                                       |
| `package.json`                                  | `name`, przypięte `@supabase/*`, skrypt `prepare`, skrypty `cf:*`                                                               |
| `astro.config.mjs`                              | `site` (adres produkcyjny), `session: false`, `cloudflare({ imageService: "passthrough" })` — wyłączenie wiązań KV/Images (3.2) |
| `src/env.d.ts`                                  | typowanie runtime'u Cloudflare na `App.Locals`                                                                                  |
| `src/pages/api/health.ts`                       | **nowy** — detektor trybu zdegradowanego                                                                                        |
| `.nvmrc`                                        | `22.14.0` → `22.23.2` (wersja obecna w obrazie Workers Builds)                                                                  |
| `.github/workflows/ci.yml`                      | wyrównać `node-version` do `22.23.2`; **bez** joba wdrożeniowego                                                                |
| `.github/workflows/verify-production.yml`       | **nowy** — sonda po wdrożeniu (Workers Builds nie weryfikuje)                                                                   |
| `.gitignore`                                    | `.dev.vars.*`, `worker-configuration.d.ts`                                                                                      |
| `.dev.vars`                                     | **nowy**, nieśledzony                                                                                                           |
| `context/changes/deployment/deployment-plan.md` | **nowy** — ten plan jako ślad audytowy                                                                                          |
