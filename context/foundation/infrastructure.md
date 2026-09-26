---
project: TrendingSkins
researched_at: 2026-09-25
recommended_platform: Cloudflare Workers
runner_up: Netlify
context_type: mvp
tech_stack:
  language: TypeScript / JavaScript
  framework: Astro 7 (SSR, output "server")
  runtime: Cloudflare workerd (@astrojs/cloudflare 14.3.x)
---

## Recommendation

**Deploy on Cloudflare Workers.**

Jest to jedyna z sześciu badanych platform, która zalicza wszystkie pięć kryteriów
oceny, kosztuje zero przy przewidywanym ruchu i **nie wymaga żadnej migracji** —
starter już niesie adapter `@astrojs/cloudflare`, plik `wrangler.jsonc` wycelowany
w Workers i flagę `nodejs_compat`. Przy czterech tygodniach pracy po godzinach brak
migracji jest wart więcej niż jakakolwiek różnica w cenniku. Decydujące odpowiedzi
z wywiadu: minimalny koszt jako priorytet, brak trwałych połączeń po stronie serwera
oraz akceptacja zewnętrznej bazy (Supabase zostaje poza platformą wdrożeniową).

Wybór został podjęty ze świadomością trzech ryzyk wyłożonych w testach pod prąd —
patrz rejestr ryzyk na końcu dokumentu. Użytkownik przyjął je jawnie.

## Platform Comparison

| Platforma | CLI | Zarządzane | Dokumentacja | API wdrożeń | MCP | Koszt realny |
|---|---|---|---|---|---|---|
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass | $0 |
| **Netlify** | Partial | Pass | Pass | Pass | Pass | $0 (twardy limit) |
| **Railway** | Partial | Pass | Pass | Pass | Pass | $5/mc |
| Fly.io | Partial | Partial | Pass | Pass | Pass | $2–3,32/mc |
| Render | Partial | Pass | Pass | Pass | Pass | $8/mc |
| Vercel | Pass | Pass | Pass | Pass | Partial | $20/mc |

Uwagi do ocen:

- **CLI „Partial" u czterech platform oznacza to samo**: brak polecenia wycofania
  wdrożenia. Netlify, Railway, Render i Fly każą cofać się przez panel albo przez
  ponowne wdrożenie wcześniejszego obrazu. Dla projektu prowadzonego przez agenta
  to realne ograniczenie — agent nie kliknie w panelu.
- **Fly.io „Partial" przy zarządzaniu**: `fly launch` generuje Dockerfile, którego
  właścicielem zostajesz na zawsze. To więcej powierzchni operacyjnej, niż potrzebuje
  MVP osoby bez doświadczenia z wdrożeniami.
- **Vercel „Partial" przy MCP**: serwer w wersji zapowiadanej (beta), nie stabilnej.
- **Koszt Vercela to nie ruch, tylko harmonogram.** Darmowy plan dopuszcza zadania
  cykliczne najwyżej raz na dobę; harmonogram godzinowy odrzuca przy wdrożeniu.
- **Koszt Rendera to nie ruch, tylko wymaganie z PRD.** Darmowy plan usypia usługę
  po 15 minutach, a wybudzenie trwa około minuty — wobec wymogu „ekran wejściowy
  poniżej sekundy dla 95% wejść" darmowy plan jest wykluczony, nie niewygodny.

### Shortlisted Platforms

#### 1. Cloudflare Workers (rekomendowana)

Komplet pięciu ocen pozytywnych. `wrangler` pokrywa pełną pętlę operacyjną łącznie
z prawdziwym poleceniem wycofania (`wrangler rollback`), czego nie ma większość
konkurencji. Dokumentacja dostępna jako `llms.txt` i markdown pod każdym adresem.
Darmowy plan to 100 tysięcy żądań dziennie — przy przewidywanym ruchu rzędu
kilkudziesięciu tysięcy miesięcznie zapas jest trzycyfrowy. Zadania cykliczne
w darmowym planie (5 wyzwalaczy na konto). Zero migracji: adapter, konfiguracja
i runtime już są w repozytorium.

#### 2. Netlify

Najlepsza dokumentacja dla agentów w całej stawce — indeks `llms.txt` plus każda
strona dostępna jako markdown po dopisaniu `.md`. Serwer MCP w wersji stabilnej
od czerwca 2025. Zadania cykliczne godzinowe działają w planie darmowym, z limitem
30 sekund na wykonanie, co dla zadania trwającego sekundy jest bez znaczenia.
Runtime Node usuwa całą klasę ryzyk zgodności, które ciążą na Workers.

Luka wobec rekomendacji: wymiana adaptera na `@astrojs/netlify` oraz model kredytowy
z **twardym limitem** — po wyczerpaniu 300 kredytów miesięcznie strona przestaje
odpowiadać, zamiast naliczyć opłatę. Przy 15 kredytach za wdrożenie produkcyjne daje
to około 20 wdrożeń miesięcznie. Dodatkowo region funkcji jest przypisany na stałe
do `cmh` (US East) poza planem Pro.

#### 3. Railway

Przewidywalne pięć dolarów miesięcznie, bez limitów czasu procesora, runtime Node,
serwer MCP w wersji stabilnej, oficjalny przewodnik dla Astro. Najmniej niespodzianek
z całej trójki.

Luka wobec rekomendacji: płacisz od pierwszego dnia, wymieniasz adapter, a zadanie
cykliczne jest **osobną usługą z własnym kontenerem**, nie funkcją w istniejącej
aplikacji. Plan darmowy z jednym dolarem kredytu mieści jedną drobną usługę, ale nie
dwie. Osobna pułapka: konto bez zweryfikowanego GitHuba dostaje ograniczenia ruchu
wychodzącego, co zablokowałoby właśnie odpytywanie zewnętrznego API.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Limit 10 ms czasu procesora zderzy się z regułą domenową.** Darmowe zadanie
   cykliczne dostaje 10 ms CPU na wywołanie. Czekanie na sieć się nie liczy, ale
   parsowanie paczki ze Skinport i policzenie momentum dla tysięcy przedmiotów to
   czysty CPU — dokładnie ta praca, którą produkt wykonuje.
2. **Ten sam limit dotyczy żądań SSR.** Astro z autoryzacją Supabase zużywa typowo
   10–20 ms. Pięć dolarów miesięcznie może okazać się warunkiem działania, a nie
   ulepszeniem — a wtedy przewaga kosztowa nad Railway znika.
3. **`@supabase/ssr` ma otwarte zgłoszenia niezgodności z workerd**
   (`dynamic require of "stream"`, supabase#37592). To biblioteka, na której stoi
   cała autoryzacja. Aktualizacja zależności może skończyć się debugowaniem
   współdziałania CommonJS z workerd zamiast budowaniem produktu.
4. **Zadanie cykliczne wymaga własnego punktu wejścia.** Adapter generuje wejście
   eksportujące tylko `fetch`. Trzeba napisać moduł importujący
   `@astrojs/cloudflare/handler` i eksportujący `{ fetch, scheduled }`. Istnieje
   otwarte zgłoszenie w Astro (withastro/astro#13838) — to kod integracyjny
   w miejscu, którego adapter oficjalnie nie obsługuje.
5. **Brak runtime'u Node.** Każda przyszła zależność musi być zgodna z workerd.
   Dziś niewidoczne; odczuwalne przy pierwszej bibliotece sięgającej po API Node'a.

### Pre-Mortem — How This Could Fail

Sześć miesięcy później projekt stoi. Zaczęło się dobrze: wdrożenie zadziałało za
pierwszym razem, `wrangler deploy` był jedną komendą, koszt wynosił zero. Pierwszy
zgrzyt pojawił się w trzecim tygodniu, gdy zadanie cykliczne zaczęło przekraczać
10 ms — paczka ze Skinport urosła, a scoring liczył się dla całego rynku, nie tylko
dla listy obserwowanych. Przejście na plan za pięć dolarów rozwiązało to w minutę
i wydawało się końcem tematu.

Prawdziwy problem przyszedł przy aktualizacji `@supabase/ssr`. Autoryzacja przestała
działać na produkcji, choć lokalnie wszystko stało. Trzy wieczory poszły na czytanie
o współdziałaniu CommonJS z workerd — nie o skinach, nie o regule domenowej,
o `nodejs_compat`. Termin czwartego listopada minął z aplikacją, która działała
wyłącznie lokalnie.

Sedno pomyłki: wybrano platformę o najmniejszym koszcie i najkrótszej drodze do
pierwszego wdrożenia, nie doceniając, że runtime bez Node'a przenosi ryzyko
z rachunku na czas — a czas był tu zasobem rzadszym niż pieniądze.

### Unknown Unknowns

- **Zmienne środowiskowe mogą być rozstrzygane w czasie budowania, nie działania.**
  Od Astro 6 budowanie jest per-środowisko. Wymaga sprawdzenia, czy rotacja sekretu
  Supabase wystarcza, czy potrzebne jest przebudowanie. Jeśli oczekujesz konfiguracji
  w stylu dwunastu czynników, to zaskoczy.
- **Limit 10 ms liczy czas procesora, nie czas zegarowy.** Wolne zapytanie do
  Supabase jest darmowe, ale `JSON.parse` dużej paczki już nie. To odwrotność
  intuicji wyniesionej z pracy z serwerami.
- **Astro Sessions automatycznie tworzą Workers KV**, spójne dopiero po około
  minucie. Nie nadaje się do stanu autoryzacji, a domyślność to ukrywa.
- **Lokalne `npm run dev` to już prawdziwy workerd.** Błędy widziane lokalnie są
  prawdziwe, ale też nie ma trybu „u mnie działa" — wszystko zakładające Node'a
  wywali się również lokalnie.
- **Adapter usunął obsługę Cloudflare Pages w wersji 14.** Platforma zmienia się
  szybko; poradniki starsze niż kilka miesięcy opisują nieistniejący już przepływ
  (`wrangler pages deploy`, opcja `platformProxy`).

## Operational Story

- **Preview deploys**: `wrangler versions upload` tworzy wersję z własnym adresem
  podglądowym bez kierowania na nią ruchu produkcyjnego; `wrangler versions deploy`
  promuje ją. Obserwowalność jest włączona w `wrangler.jsonc`.
- **Secrets**: `npx wrangler secret put SUPABASE_URL` i `SUPABASE_KEY` — trafiają do
  magazynu sekretów Workers, nie do repozytorium. Lokalnie mieszkają w `.dev.vars`
  (ignorowane przez git). **Do zweryfikowania przed pierwszym wdrożeniem**: czy przy
  `astro:env` sama rotacja sekretu wystarcza, czy wymaga przebudowania.
- **Rollback**: `npx wrangler rollback [VERSION_ID]`, lista wersji przez
  `wrangler deployments list`. Czas cofnięcia liczony w sekundach. Zastrzeżenie:
  wycofanie kodu nie cofa zmian w Supabase — schemat bazy żyje własnym cyklem.
- **Approval**: wdrożenie na produkcję i rotacja sekretów wymagają człowieka.
  Agent może bez nadzoru budować, uruchamiać wersje podglądowe, czytać logi
  i wykonywać próbne przebiegi zadania cyklicznego.
- **Logs**: `npx wrangler tail` dla podglądu na żywo. Próbny przebieg zadania
  cyklicznego lokalnie: `curl "http://localhost:8787/cdn-cgi/local/scheduled"`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Zadanie cykliczne przekracza 10 ms CPU w planie darmowym | Adwokat diabła | H | M | Licz scoring wsadowo i zapisuj wynik do bazy zamiast przeliczać przy każdym żądaniu; przy przekroczeniu przejdź na plan za $5 (30 s CPU) — to zaplanowany wydatek, nie awaria |
| Żądania SSR przekraczają 10 ms CPU | Adwokat diabła | M | M | Zmierz zużycie po pierwszym wdrożeniu przez włączoną obserwowalność; budżetuj $5/mc jako prawdopodobny koszt docelowy |
| `@supabase/ssr` przestaje działać na workerd po aktualizacji | Adwokat diabła / Sekcja zwłok | M | H | Przypnij dokładną wersję `@supabase/ssr` w `package.json`; nie aktualizuj jej w trakcie czterech tygodni; przed każdą aktualizacją uruchom `npm run smoke` |
| Punkt wejścia z `scheduled` wymaga niewspieranego kodu integracyjnego | Adwokat diabła | H | M | Zrób to w pierwszym tygodniu, nie w ostatnim; alternatywa awaryjna to zewnętrzny wyzwalacz (GitHub Actions) uderzający w endpoint chroniony sekretem |
| Przyszła zależność okazuje się niezgodna z workerd | Adwokat diabła | M | M | Przed dodaniem biblioteki sprawdź zgodność z workerd; preferuj pakiety bez zależności od API Node'a |
| Rotacja sekretu wymaga przebudowania, nie tylko `wrangler secret put` | Nieznane niewiadome | M | L | Zweryfikuj zachowanie przy pierwszym wdrożeniu, zanim sekret stanie się pilny |
| Poradniki w sieci opisują nieistniejący przepływ Pages | Nieznane niewiadome / ustalenie badawcze | H | L | Trzymaj się dokumentacji adaptera Astro i `developers.cloudflare.com`; ignoruj wszystko, co mówi o `wrangler pages deploy` lub `platformProxy` |
| Workers KV pod Astro Sessions jest spójne dopiero po ~60 s | Nieznane niewiadome | L | M | Nie używaj sesji Astro do stanu autoryzacji — zostaw to przy ciasteczkach Supabase |

## Getting Started

Kroki sprawdzone wobec wersji faktycznie zainstalowanych w tym repozytorium
(`astro ^7.3.2`, `@astrojs/cloudflare ^14.3.1`, wrangler 4.x), nie wobec ogólnych
poradników.

1. **Zmień nazwę Workera.** W `wrangler.jsonc` pole `name` to wciąż
   `"10x-astro-starter"` — zmień na `"trending-skins"`. Ta nazwa stanie się częścią
   adresu produkcyjnego. Przy okazji popraw `name` w `package.json`.
2. **Zaloguj się i skonfiguruj sekrety.**
   `npx wrangler login`, następnie `npx wrangler secret put SUPABASE_URL`
   i `npx wrangler secret put SUPABASE_KEY`. Lokalnie: `cp .env.example .dev.vars`
   i uzupełnij.
3. **Pierwsze wdrożenie.** `npm run build && npx wrangler deploy`. Nie używaj
   `wrangler pages deploy` — adapter w wersji 14 nie obsługuje Pages.
4. **Dodaj zadanie cykliczne.** Utwórz własny punkt wejścia (np. `src/worker.ts`)
   importujący `@astrojs/cloudflare/handler`, eksportujący `{ fetch, scheduled }`,
   przestaw `main` w `wrangler.jsonc` na ten plik i dopisz sekcję `triggers.crons`.
   Sprawdź lokalnie przez `curl "http://localhost:8787/cdn-cgi/local/scheduled"`.
5. **Zweryfikuj zużycie czasu procesora** w panelu obserwowalności po pierwszej dobie
   działania. To jest liczba, która rozstrzygnie, czy zostajesz na planie darmowym.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup
- Production-scale architecture (multi-region, HA, DR)
