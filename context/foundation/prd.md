---
project: "TrendingSkins"
version: 1
status: draft
created: 2026-09-21
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 4
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# TrendingSkins

## Vision & Problem Statement

Gracz CS2 posiadający inwentarz skinów ręcznie przegląda wykresy na Steam Market
i innych portalach oferujących zakup i sprzedaż skinów, żeby ocenić, co warto
kupić inwestycyjnie, a co ze swoich obecnych skinów sprzedać, żeby nie stracić.
Ból ma trzy składniki naraz: paraliż decyzyjny (nie wiadomo, który przedmiot
zasługuje na uwagę), dane rozproszone po wielu portalach (nikt ich nie zestawia
w jednym widoku) oraz brakująca zdolność pomiaru (nikt nie mierzy tego, co ta
osoba chce wiedzieć). Kosztuje to zmarnowany czas i ryzyko sprzedaży w złym
momencie.

Wedle wiedzy autora na trendy cen skinów w CS2 wpływają przede wszystkim:
zmiany podaży kontrolowane przez wydawcę gry, popyt graczy, aktualizacje gry,
popularność esportu oraz płynność danego przedmiotu.

# TODO: insight — see Open Questions

## User & Persona

Główna persona: **gracz CS2 z inwentarzem skinów, który nie handluje aktywnie.**
Ma skiny zdobyte w grze, sprzedaje sporadycznie, nie siedzi na rynku codziennie.
Chce wiedzieć, kiedy nie przegapić dobrego momentu — nie chce zostać traderem.

Moment: persona nie sięga po produkt z własnej inicjatywy — **to produkt ją
informuje**. Dwie sytuacje wyzwalające kontakt:

1. dany przedmiot jest wart uwagi zakupowej w celach inwestycyjnych,
2. przedmiot, który persona posiada, znacząco traci na wartości i powinien
   zostać sprzedany.

Z punktu drugiego wynika, że produkt musi wiedzieć, co persona posiada.

## Success Criteria

### Primary

- Nowy użytkownik zakłada konto i bez żadnej konfiguracji widzi listę najbardziej
  trendujących skinów w domyślnym oknie (3 dni albo tydzień).
- Po ustawieniu filtru budżetowego użytkownik otrzymuje w aplikacji sygnał
  o przedmiocie, który mieści się w jego budżecie i jest wart uwagi zakupowej.
- Użytkownik wprowadza posiadany przedmiot ręcznie i otrzymuje sygnał, gdy ten
  przedmiot znacząco traci na wartości.

### Secondary

- Użytkownik zmienia domyślny filtr budżetowy na własny — dowód, że traktuje
  narzędzie jako swoje, a nie jako ogólny ranking.

### Guardrails

- Ten sam przedmiot nie zgłasza się w kółko o tej samej sytuacji; powtarzalny
  sygnał zamienia produkt w szum i użytkownik przestaje go czytać.
- Lista działa również wtedy, gdy zewnętrzne źródło danych nie odpowiada —
  pokazuje starsze dane wraz z informacją o ich wieku, zamiast pustego albo
  zepsutego ekranu.
- Sygnał nie udaje porady inwestycyjnej — widoczne zastrzeżenie, że jest to
  obserwacja wynikająca z danych, a nie rekomendacja finansowa.

## User Stories

### US-01: Nowy użytkownik widzi wartość bez konfiguracji

- **Given** osoba bez konta, która pierwszy raz otwiera aplikację
- **When** wejdzie na ekran główny
- **Then** widzi listę najbardziej trendujących skinów w domyślnym oknie analizy

#### Acceptance Criteria

- Lista jest widoczna bez zakładania konta i bez wprowadzania jakichkolwiek danych
- Na liście znajdują się wyłącznie przedmioty spełniające próg płynności
- Gdy zewnętrzne źródło danych nie odpowiada, lista pokazuje ostatnie znane dane wraz z informacją o ich wieku, zamiast pustego albo zepsutego ekranu
- Ekran zawiera widoczne zastrzeżenie, że prezentowane obserwacje nie są rekomendacją finansową

### US-02: Użytkownik dostaje sygnał zakupowy w swoim budżecie

- **Given** zalogowany użytkownik, który ustawił filtr cenowy
- **When** cena przedmiotu mieszczącego się w tym filtrze zacznie zachowywać się nietypowo na tle własnej historii
- **Then** użytkownik widzi sygnał w aplikacji i może otworzyć szczegóły przedmiotu

#### Acceptance Criteria

- Sygnał obejmuje przedmioty w filtrze cenowym oraz przedmioty tuż powyżej niego, te drugie wyraźnie oznaczone jako przekraczające budżet
- Ten sam przedmiot nie zgłasza się ponownie o tej samej sytuacji
- Szczegóły przedmiotu zawierają uzasadnienie, dlaczego sygnał się pojawił
- Szczegóły przedmiotu zawierają cenę ze źródła sygnału oraz link do tego źródła
- Interfejs nie przedstawia tej ceny jako najlepszej oferty ani najtańszego miejsca zakupu

### US-03: Użytkownik dowiaduje się, że jego przedmiot traci na wartości

- **Given** zalogowany użytkownik, który wprowadził do inwentarza posiadany przedmiot
- **When** ten przedmiot znacząco traci na wartości
- **Then** użytkownik widzi sygnał sprzedażowy dotyczący tego konkretnego przedmiotu

#### Acceptance Criteria

- Sygnał dotyczy wyłącznie przedmiotów znajdujących się w inwentarzu tego użytkownika
- Usunięcie przedmiotu z inwentarza kończy generowanie sygnałów o nim
- Ten sam przedmiot nie zgłasza się ponownie o tej samej sytuacji

## Functional Requirements

### Konto

- FR-001: Użytkownik może założyć konto na adres e-mail. Priority: must-have
  > Socrates: Rozważony kontrargument: rejestracja przed pokazaniem wartości odbija
  > użytkownika, który nie handluje aktywnie. Rozstrzygnięcie: FR zostaje, ale
  > rejestracja przestaje być bramą wejściową — lista trendujących jest widoczna
  > bez konta (patrz FR-003). Konto jest potrzebne dopiero do filtru budżetowego,
  > inwentarza i sygnałów.
- FR-002: Użytkownik może zalogować się na swoje konto. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje jak jest. Skoro istnieją konta, musi
  > istnieć sposób powrotu do własnych danych.

### Lista trendujących

- FR-003: Każdy odwiedzający, również bez konta, może zobaczyć listę najbardziej trendujących skinów bez żadnej wcześniejszej konfiguracji. Priority: must-have
  > Socrates: Rozważony kontrargument: trendujący bez progu to ranking szumu —
  > przedmioty tanie i rzadko handlowane skaczą o dziesiątki procent i pierwsza
  > lista pokaże dziwactwa zamiast okazji. Rozstrzygnięcie: FR zostaje, ale
  > lista otrzymuje próg płynności wchodzący do reguły domenowej — przedmiot musi
  > mieć odpowiednio dużo transakcji w oknie, żeby w ogóle się na niej znaleźć.
- FR-004: Użytkownik może przełączyć okno analizy pomiędzy oknami dostępnymi w źródle danych. Priority: nice-to-have
  > Socrates: Rozważony kontrargument: dwa okna to dwie różne odpowiedzi i żaden
  > powód, żeby wybrać — przełącznik przerzuca na użytkownika decyzję należącą do
  > autora produktu. Rozstrzygnięcie: zdemotowane do nice-to-have. W pierwszej
  > wersji obowiązuje jedno stałe okno wybrane przez autora.

### Filtry i sygnały

- FR-005: Użytkownik może ustawić filtr cenowy określający, ile jest w stanie zainwestować; filtr działa miękko — przedmioty tuż powyżej budżetu również się pojawiają, wyraźnie oznaczone jako przekraczające budżet. Priority: must-have
  > Socrates: Rozważony kontrargument: twardy filtr ceny wycina najlepsze sygnały —
  > najciekawsza obserwacja może dotyczyć przedmiotu tuż poza budżetem.
  > Rozstrzygnięcie: filtr zmieniony z twardego odcięcia na miękki z oznaczeniem
  > przekroczenia budżetu.
- FR-006: Użytkownik otrzymuje w aplikacji sygnał, gdy cena przedmiotu zachowuje się nietypowo na tle własnej historii tego przedmiotu, z uwzględnieniem jego filtru cenowego. Priority: must-have
  > Socrates: Rozważony kontrargument: wart uwagi zakupowej to obietnica, której
  > dane nie udźwigną — historia cen mówi, co się stało, nie co się stanie.
  > Rozstrzygnięcie: wymaganie przeformułowane z języka rekomendacji na język
  > obserwacji. Produkt raportuje nietypowe zachowanie ceny; ocena, czy to okazja,
  > należy do człowieka.
- FR-007: Użytkownik może otworzyć zakładkę sygnałów i zobaczyć szczegóły wskazanego przedmiotu wraz z uzasadnieniem, dlaczego sygnał się pojawił. Priority: must-have
  > Socrates: Rozważony kontrargument: szczegóły bez uzasadnienia to kolejny
  > wykres — użytkownik wraca do punktu wyjścia i sam interpretuje dane.
  > Rozstrzygnięcie: wymaganie rozszerzone o obowiązkowe uzasadnienie sygnału.
- FR-008: Użytkownik widzi przy wskazanym przedmiocie cenę z tego samego źródła, na którym liczony jest sygnał, wraz z linkiem do tego źródła. Priority: must-have
  > Socrates: Rozważony kontrargument: jedno źródło nie uprawnia do słowa
  > korzystnie — pokazujesz po prostu jego cenę. Rozstrzygnięcie: FR zostaje,
  > ale interfejs nie nazywa tej ceny najlepszą ofertą ani najtańszym miejscem
  > zakupu. Jest to cena odniesienia ze źródła sygnału. Porównanie portali wraca
  > poza pierwszą wersją.

### Inwentarz

- FR-009: Użytkownik może ręcznie wprowadzić przedmiot, który posiada, opcjonalnie podając cenę zakupu. Priority: must-have
  > Socrates: Rozważony kontrargument: bez ceny zakupu sygnał sprzedażowy jest
  > ślepy — traci na wartości względem czego, wczorajszej ceny czy tego, co
  > użytkownik zapłacił? Rozstrzygnięcie: cena zakupu dodana jako pole opcjonalne.
  > Bez niej działają sygnały odnoszące się do zachowania rynku; z nią dodatkowo
  > sygnały odnoszące się do wyniku użytkownika. Wejście pozostaje bez tarcia.
- FR-010: Użytkownik otrzymuje sygnał, gdy posiadany przez niego przedmiot traci na wartości powyżej progu wyrażonego względnie, jako udział wartości tego przedmiotu. Priority: must-have
  > Socrates: Rozważony kontrargument: znacząco oznacza co innego przy każdej
  > cenie — spadek o 10 przy przedmiocie za 50 i za 5000 to dwie różne sytuacje,
  > a jeden próg kwotowy będzie zawsze zły dla połowy inwentarza.
  > Rozstrzygnięcie: próg wyrażony względnie, nie kwotowo.
- FR-011: Użytkownik może edytować własne dane wprowadzonego przedmiotu (cena zakupu, liczba sztuk); zmiana tożsamości samego przedmiotu odbywa się przez usunięcie i dodanie nowego. Priority: must-have
  > Socrates: Rozważony kontrargument: edycja psuje ciągłość sygnałów — po zmianie
  > przedmiotu na inny historia ostrzeżeń przestaje pasować do zawartości
  > inwentarza. Rozstrzygnięcie: edycja ograniczona do danych własnych
  > użytkownika; tożsamość przedmiotu jest niezmienna, dzięki czemu historia
  > sygnałów zawsze dotyczy tego samego przedmiotu.
- FR-012: Użytkownik może usunąć przedmiot ze swojego inwentarza. Priority: must-have
  > Socrates: Brak kontrargumentu; zostaje jak jest. Po sprzedaży przedmiot musi
  > zniknąć, inaczej generuje sygnały o czymś, czego użytkownik już nie ma.

## Non-Functional Requirements

- Ekran wejściowy z listą trendujących, widoczny bez konta, pokazuje wynik
  w czasie odbieranym jako natychmiastowy — poniżej 1 s dla 95% wejść.
- Żadna prezentowana cena nie jest starsza niż 60 minut, a każda niesie ze sobą
  widoczną informację o momencie, z którego pochodzi.
- Przy niedostępności zewnętrznego źródła danych użytkownik nadal widzi ostatnie
  znane ceny wraz z ich wiekiem, zamiast pustego albo zepsutego ekranu.
- Użytkownik nie otrzymuje więcej sygnałów, niż jest w stanie przeczytać —
  niezależnie od wielkości inwentarza i szerokości filtru budżetowego.
  # TODO: wartość graniczna liczby sygnałów — see Open Questions
- Produkt pozostaje użyteczny na aktualnych wersjach głównych przeglądarek,
  zarówno desktopowych, jak i mobilnych.

## Business Logic

Aplikacja porównuje bieżącą cenę każdego dostatecznie płynnego przedmiotu z jego
własną historią cen i zgłasza ten przedmiot, gdy odchylenie przekracza próg
wyrażony jako udział jego wartości — podając powód zgłoszenia oraz warunkową
projekcję dalszego kierunku przy utrzymaniu dotychczasowego tempa.

Wartości progów przyjęte jako punkt startowy: okno bieżące to 7 dni, norma
przedmiotu liczona z 30 dni, próg odchylenia to 15% względem normy, a próg
płynności to co najmniej kilkadziesiąt transakcji w oknie 30 dni. Okno
trzydniowe nie jest dostępne — dane o historii sprzedaży występują wyłącznie
jako agregaty w oknach 24 h, 7 d, 30 d i 90 d.

Reguła konsumuje: bieżącą cenę przedmiotu, jego własną historię cen w oknie
krótkim i długim, liczbę transakcji w oknie (jako miarę płynności), filtr
budżetowy użytkownika oraz zawartość jego inwentarza wraz z opcjonalną ceną
zakupu. Nie konsumuje żadnych danych spoza rynku — aktualizacje gry, wydarzenia
wydawcy i kalendarz esportu są poza pierwszą wersją i ujawniają się wyłącznie
pośrednio, jako ruch w cenie i wolumenie.

Wynikiem reguły jest zgłoszenie przedmiotu wraz z powodem (co konkretnie odstaje
od normy tego przedmiotu) oraz warunkową projekcją kierunku (dokąd to zmierza,
jeśli tempo się utrzyma). Projekcja jest zawsze warunkowa i nigdy nie twierdzi,
że dana cena zostanie osiągnięta.

Ta sama reguła obsługuje oba rodzaje sygnałów; różni je znak odchylenia i zbiór
przedmiotów, na którym działa. Sygnał zakupowy patrzy na cały rynek ograniczony
filtrem budżetowym użytkownika, sygnał sprzedażowy wyłącznie na przedmioty z jego
inwentarza. Użytkownik spotyka regułę w dwóch miejscach: na liście trendujących,
widocznej bez konta, oraz w zakładce sygnałów, dostępnej po zalogowaniu.

## Access Control

Konto w aplikacji zakładane na adres e-mail. W pierwszej wersji adres e-mail
pełni wyłącznie rolę tożsamości — sygnały są widoczne w samej aplikacji i nie są
wysyłane pocztą (patrz Non-Goals).

Model ról jest płaski — nie ma ról o różnych uprawnieniach. Każdy zalogowany
użytkownik widzi i edytuje wyłącznie własny inwentarz, własną listę obserwowanych
przedmiotów i własne progi sygnałów. Dane rynkowe (ceny, wolumeny, historia) są
wspólne dla wszystkich i nikt ich nie edytuje.

Niezalogowany użytkownik nie ma dostępu do inwentarza, filtru budżetowego ani
zakładki sygnałów. Lista trendujących jest dla niego widoczna bez ograniczeń.

## Non-Goals

- **Bez importu ekwipunku z zewnętrznego konta gracza.** Inwentarz wpisywany
  wyłącznie ręcznie. Druga integracja wraz z mapowaniem przedmiotów na nazwy
  rynkowe nie mieści się w zakresie pierwszej wersji.
- **Bez wysyłki sygnałów pocztą elektroniczną.** Sygnały widoczne wyłącznie
  w aplikacji. Świadomie osłabia to model informowania opisany w sekcji
  User & Persona — użytkownik musi wejść, żeby zobaczyć sygnał.
- **Bez danych spoza rynku.** Żadnych aktualizacji gry, wydarzeń wydawcy ani
  kalendarza esportu. Reguła działa wyłącznie na cenie i wolumenie; te czynniki
  ujawniają się pośrednio jako ruch w liczbach.
- **Bez własnego modelu prognozującego cenę.** Projekcja kierunku jest warunkową
  arytmetyką na dostępnych oknach, nie prognozą. Pełna predykcja jest kierunkiem
  poza pierwszą wersją.
- **Bez porównywania cen pomiędzy wieloma portalami w pierwszej wersji.** Nie jest
  to wykluczenie kierunku — furtka na kolejną wersję pozostaje otwarta — ale
  pierwsza wersja korzysta z jednego źródła i nie nazywa jego ceny najlepszą ofertą.

## Open Questions

1. **Jaki jest insight — co autor wie o tym rynku, czego nie wiedzą istniejące
   narzędzia?** Autor nie sprawdzał konkurencji. Właściciel: autor. Blokuje: nie,
   ale bez tego sekcja wizji pozostaje niepełna.
2. **Czy przyjęte progi są właściwe na prawdziwych danych?** Wartości (7 d wobec
   30 d, 15%, kilkadziesiąt transakcji) przyjęto jako punkt startowy do strojenia
   po zobaczeniu rzeczywistego rozkładu cen i wolumenów. Właściciel: autor.
   Blokuje: nie.
3. **Ile sygnałów dziennie to jeszcze znośna liczba?** Wartość graniczna dla NFR
   o liczbie sygnałów nieustalona. Właściciel: autor. Blokuje: nie.
4. **Sprzeczność wewnętrzna: czy pierwsze kryterium sukcesu wymaga konta?**
   Success Criteria → Primary mówi, że nowy użytkownik zakłada konto i dopiero
   wtedy widzi listę, podczas gdy FR-003 i US-01 mówią, że lista jest widoczna
   bez konta. Kryterium pochodzi z wcześniejszego etapu niż decyzja o FR-003.
   Właściciel: autor. Blokuje: nie, ale kryterium sukcesu mierzy dziś co innego,
   niż opisuje wymaganie.
5. **Sprzeczność wewnętrzna: jakie jest domyślne okno analizy?** Success Criteria
   → Primary mówi o domyślnym oknie 3 dni albo tydzień, podczas gdy Business Logic
   stwierdza, że okno trzydniowe nie jest dostępne w danych, i przyjmuje 7 dni
   wobec normy z 30 dni. Właściciel: autor. Blokuje: nie.
