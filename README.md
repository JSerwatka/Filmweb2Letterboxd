# Filmweb2Letterboxd
<a href="https://buycoffee.to/jserwatka" target="_blank"><img src="https://buycoffee.to/btn/buycoffeeto-btn-primary.svg" style="width: 169px" alt="Postaw mi kawę na buycoffee.to"></a>
## O projekcie

Skrypty eksportują oceny filmów/seriali i "Chcę zobaczyć" z Filmweb'u do formatu csv.
Pliku csv ma następujące kolumny:

- _Title_ - oryginalny tytuł programu, a jak nie znajdzie, to polski;
- _Year_ - rok produkcji programu;
- _Rating10_ - ocena użytkownika;
- _WatchedDate_ - data obejrzenia.

## Jak używać

### Pobranie obejrzanych filmów lub seriali

1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>`.
3. Otwórz konsolę
       ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/2b4ce2e1-0556-4fbd-b29c-1cb957918ca4)

    - Windows: `Ctrl + Shift + J`
    - Mac: `Cmd + Option + J`
5. Wklej skrypt z pliku 
    - Dla filmów: [watched_film.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched_film.js)
    - Dla seriali: [watched_serial.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched_serial.js)
6. Zostaw kartę otwartą i nie przełączaj na żadną inną!

Dalej masz wątpliwości, sprawdź ten komentarz: https://github.com/JSerwatka/Filmweb2Letterboxd/issues/8#issuecomment-1887372746.

### Pobranie "Chcę zobaczyć" 

1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>`.
3. Otwórz konsolę
       ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/ced6335c-e391-4715-85ee-1ed95bfa0d9e)

    - Windows: `Ctrl + Shift + J`
    - Mac: `Cmd + Option + J`
5. Wklej skrypt z pliku 
    - Dla filmów: [watchlist_film.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watchlist_film.js)
    - Dla seriali: [watchlist_serial.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watchlist_serial.js)
6. Zostaw kartę otwartą i nie przełączaj na żadną inną!

## Jak zaimportować dane do Letterboxd
Zaloguj się, a następnie:
- Obejrzane filmy: 
    - Wejdź na _https://letterboxd.com/import/_ -> _Select a file_
          ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/12695a0f-2340-4b51-b0fc-0eb230c6dfc5)

    - Wczytaj wszystkie pliki, którę zostały ściągnięte
    - Po zakończeniu importowania przełącz _Hide successful matches_. Pojawią Ci się wtedy wszystkie filmy, których nie udało się zaimportować. Spróbuj wyszukać i dodać je ręcznie.
- Obejrzene seriale: Letterboxd obecnie ma niewielkie wsparcie dla seriali (będzie one wprowadzane w 2024 roku), ale możesz spróbować zrobić to samo, co w przypadku filmów.
- "Chcę zobaczyć" filmy:
    - Wejdź na _https://letterboxd.com/import/_ -> _import to you watchlist_ -> _Import films to watchlist..._
      ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/2f9c02b0-efe1-4bc6-bfeb-409fd7adb5b5)
        ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/c63743a3-515b-42ca-bba7-c381b75b480d)

    - Dalej, to samo co w "Obejrzane filmy"
- "Chcę zobaczyć" seriale:
    - Analogicznie do "Obejrzane seriale" i "Chcę zobaczyć filmy"

## Uwagi

- Z powodu ograniczenia rozmiaru pliku, narzuconego przez importer Letterboxd, skrypt dzieli obejrzane filmy/seriale na kilka plików (max 1800 wierszy).
- Częste zmiany na stronie Filmweb'u powodują, że skrypty i API szybko stają się nieaktualne. Gdyby tak się stało, można śmiało zgłaszać swoje _PR_ lub _Issues_.

## Letterboxd Tweaks
Stworzyłem również rozszerzenie do przeglądarek opartych na Chromium (Chrome, Edge, Brave), które znacząco podnosi komfort korzystania z serwisu Letterboxd. 
- Rozszerzenie jest dostępne [tutaj](https://chromewebstore.google.com/detail/letterboxd-tweaks/hopfbphfhmjgdnedoldfpbhepohibfkj)
- Kod projektu znajduje się w [tym repo](https://github.com/JSerwatka/letterboxd-tweaks)
