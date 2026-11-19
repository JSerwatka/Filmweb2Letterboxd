# Filmweb2Letterboxd
<a href="https://buycoffee.to/jserwatka" target="_blank"><img src="https://buycoffee.to/btn/buycoffeeto-btn-primary.svg" style="width: 169px" alt="Postaw mi kawę na buycoffee.to"></a>

Sprawdź też [Letterboxd Tweaks](https://chromewebstore.google.com/detail/letterboxd-tweaks/hopfbphfhmjgdnedoldfpbhepohibfkj)
## O projekcie

Skrypt archiwizuje Twoje oceny i listy "Chcę zobaczyć" z Filmweb'u (filmy, seriale, programy TV i gry), a potem tworzy z nich pliki csv do importu w Letterboxd.

Działa w dwóch fazach:

1. **Archiwum (bez tytułów)**: pobiera wszystkie oceny i listy "Chcę zobaczyć" dla wszystkich rodzajów i od razu je zapisuje. To kilkadziesiąt zapytań, zwykle kilka minut. Po tej fazie Twoje dane są już bezpieczne na dysku.
2. **Tytuły**: dla każdej pozycji dociąga tytuł i rok (jedno zapytanie na tytuł, przy kilku tysiącach ocen kilkadziesiąt minut), a potem zapisuje pełne archiwum z tytułami i pliki dla Letterboxd. Jeśli ta faza się przerwie, archiwum z fazy 1 i tak już masz.

## Pobierane pliki

Faza 1:

- `Filmweb2Letterboxd_archiwum_<data>.json` – surowe dane z Filmweb'u, bez żadnych przekształceń (pełna kopia zapasowa);
- `Filmweb2Letterboxd_wstepny_<data>.csv` – to samo w formie tabeli, z kolumnami:
    - _List_ – `watched` (oceny / obejrzane) albo `watchlist` ("Chcę zobaczyć"),
    - _Kind_ – `film`, `serial`, `tvshow` (program TV) albo `videogame` (gra),
    - _FilmwebID_ – identyfikator tytułu na Filmwebie,
    - _Rating10_ – ocena 1–10 (puste, jeśli obejrzane bez oceny),
    - _WatchedDate_ – data obejrzenia (puste, jeśli Filmweb jej nie zna),
    - _Timestamp_ – kiedy wystawiono ocenę albo dodano do listy,
    - _Favorite_, _SeenInCinema_ – `1`, jeśli zaznaczone,
    - _WatchlistLevel_ – poziom chęci obejrzenia (`0` = "nie interesuje mnie").

Faza 2:

- `Filmweb2Letterboxd_pelny_<data>.csv` – jak plik wstępny, ale z kolumnami _Title_ (polski tytuł), _OriginalTitle_ i _Year_;
- `Filmweb2Letterboxd_<lista>_<rodzaj>_<numer>.csv` – pliki do importu w Letterboxd, np. `Filmweb2Letterboxd_watched_film_0.csv`, z kolumnami:
    - _Title_ – oryginalny tytuł, a jak go nie ma, to polski,
    - _Year_ – rok produkcji,
    - _Rating10_ – ocena (puste, jeśli nie oceniono),
    - _WatchedDate_ – data obejrzenia (puste, jeśli Filmweb jej nie zna – wtedy Letterboxd oznaczy film jako obejrzany, ale nie doda wpisu do dziennika).

  Pliki "Chcę zobaczyć" (`watchlist_…`) mają tylko _Title_ i _Year_, bez pozycji oznaczonych jako "nie interesuje mnie";
- `Filmweb2Letterboxd_bledy.csv` – tylko jeśli jakichś tytułów nie udało się pobrać (ID tytułu i przyczyna).

Na koniec w konsoli pojawi się tabela z podsumowaniem: ile pozycji jest w archiwum, ile z nich ma tytuł, a ile nie.

## Jak używać

1. Zaloguj się do Filmweb'a.
2. W tej samej karcie otwórz `https://www.filmweb.pl/robots.txt`. To prosta strona, która nie przeładuje się w trakcie eksportu, w przeciwieństwie do zwykłych stron Filmweb'u.
3. Otwórz konsolę
       ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/2b4ce2e1-0556-4fbd-b29c-1cb957918ca4)

    - Windows: `Ctrl + Shift + J`
    - Mac: `Cmd + Option + J`
4. Wklej cały skrypt z pliku [filmweb2letterboxd.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/filmweb2letterboxd.js) i naciśnij Enter.
5. Zostaw kartę otwartą i nie przełączaj na żadną inną! Okno przeglądarki musi być **widoczne**: nie minimalizuj go i nie zasłaniaj innymi oknami (może być mniejsze, z boku ekranu).
6. Gdy przeglądarka zapyta, czy zezwolić stronie na pobranie wielu plików – zezwól.

Domyślnie skrypt pobiera wszystko. Zakres możesz zmienić w sekcji `KONFIGURACJA` na początku skryptu:

```js
kinds: ["film", "serial", "tvshow", "videogame"], // rodzaje tytułów
lists: ["watched", "watchlist"],                  // oceny / "Chcę zobaczyć"
fetchTitles: true,                                // false = tylko archiwum (faza 1), bez tytułów
```

Dalej masz wątpliwości, sprawdź ten komentarz: https://github.com/JSerwatka/Filmweb2Letterboxd/issues/8#issuecomment-1887372746.

## Jak zaimportować dane do Letterboxd
Zaloguj się, a następnie:
- Obejrzane filmy: 
    - Wejdź na _https://letterboxd.com/import/_ -> _Select a file_
          ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/12695a0f-2340-4b51-b0fc-0eb230c6dfc5)

    - Wczytaj wszystkie pliki `watched_film`, którę zostały ściągnięte
    - Po zakończeniu importowania przełącz _Hide successful matches_. Pojawią Ci się wtedy wszystkie filmy, których nie udało się zaimportować. Spróbuj wyszukać i dodać je ręcznie.
- Obejrzene seriale i programy TV: Letterboxd obecnie ma niewielkie wsparcie dla seriali, ale możesz spróbować zrobić to samo, co w przypadku filmów, z plikami `watched_serial` i `watched_tvshow`.
- "Chcę zobaczyć" filmy:
    - Wejdź na _https://letterboxd.com/import/_ -> _import to you watchlist_ -> _Import films to watchlist..._
      ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/2f9c02b0-efe1-4bc6-bfeb-409fd7adb5b5)
        ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/c63743a3-515b-42ca-bba7-c381b75b480d)

    - Wczytaj pliki `watchlist_film`, dalej to samo co w "Obejrzane filmy"
- "Chcę zobaczyć" seriale i programy TV:
    - Analogicznie do "Obejrzane seriale" i "Chcę zobaczyć filmy", z plikami `watchlist_serial` i `watchlist_tvshow`
- Gry: Letterboxd nie obsługuje gier. Pliki `watched_videogame` i `watchlist_videogame` są tylko dla Ciebie (albo dla innych narzędzi, które przyjmują ten format).

## Uwagi

- Z powodu ograniczenia rozmiaru pliku, narzuconego przez importer Letterboxd, skrypt dzieli pliki do importu na kilka części (max 1800 wierszy). Pliki są zapisywane z krótkimi odstępami – jeśli przeglądarka zablokowała pobieranie wielu plików, zezwól na nie w ustawieniach witryny (ikona w pasku adresu) i uruchom skrypt ponownie.
- Skrypt celowo robi losowe przerwy między zapytaniami (oraz co jakiś czas dłuższą pauzę), żeby nie obciążać Filmweb'u i nie zostać potraktowanym jak bot. Gdy serwer odpowiada błędem przeciążenia (429/5xx), skrypt zwalnia i ponawia zapytanie. Dlatego faza 2 przy dużych kolekcjach trwa kilkadziesiąt minut – w konsoli widać postęp i szacowany pozostały czas. Tempo można zmienić w sekcji `KONFIGURACJA`.
- Jeśli karta jest ukryta (przełączona, zminimalizowana albo całkiem zasłonięta innym oknem), przeglądarka budzi skrypt najwyżej raz na sekundę, a po 5 minutach nawet raz na minutę. Eksport wtedy praktycznie staje. Skrypt wypisuje ostrzeżenie, gdy wykryje takie spowolnienie.
- Gdy przez dłuższy czas nic się nie dzieje, skrypt co 30 s wypisuje, na co czeka (np. na odpowiedź Filmweb'u albo przerwę).
- Filmweb trzyma logowanie w krótko ważnym tokenie. Gdy w trakcie długiego eksportu token wygaśnie, skrypt sam odnawia sesję, wczytując stronę główną, i kontynuuje.
- Jeśli Filmweb nie odpowie na zapytanie w ciągu 30 s, skrypt je przerywa, zwalnia i ponawia, zamiast czekać w nieskończoność.
- Jeśli skrypt zostanie przerwany, zapisze dane pobrane do tego momentu i wyświetli komunikat. Listy i pobrane tytuły są zapamiętywane w przeglądarce (`localStorage`), więc po ponownym uruchomieniu skrypt nie pobiera list od nowa (archiwum już masz) i dociąga tylko brakujące tytuły. Lista, której nie udało się pobrać, jest pobierana ponownie. Po udanym przebiegu pamięć jest czyszczona. Jeśli chcesz zacząć od zera, skrypt wypisze w konsoli polecenie czyszczące pamięć.
- Częste zmiany na stronie Filmweb'u powodują, że skrypty i API szybko stają się nieaktualne. Gdyby tak się stało, można śmiało zgłaszać swoje _PR_ lub _Issues_.

## Letterboxd Tweaks
Stworzyłem również rozszerzenie do przeglądarek opartych na Chromium (Chrome, Edge, Brave) i Firefox, które znacząco podnosi komfort korzystania z serwisu Letterboxd. 
- Rozszerzenie jest dostępne [tutaj](https://chromewebstore.google.com/detail/letterboxd-tweaks/hopfbphfhmjgdnedoldfpbhepohibfkj)
- Kod projektu znajduje się w [tym repo](https://github.com/JSerwatka/letterboxd-tweaks)
