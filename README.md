# Filmweb2Letterboxd

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
2. Przejdź do `https://www.filmweb.pl/user/<username>#`.
3. Otwórz konsolę 
    - Windows: `Ctrl + Shift + J`
    - Mac: `Cmd + Option + J`
4. Wklej skrypt z pliku 
    - Dla filmów: [watched_film.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched_film.js)
    - Dla seriali: [watched_serial.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched_serial.js)
5. Zostaw kartę otwartą i nie przełączaj na żadną inną!

Dalej masz wątpliwości, sprawdź ten komentarz: https://github.com/JSerwatka/Filmweb2Letterboxd/issues/8#issuecomment-1887372746.

### Pobranie "Chcę zobaczyć" 

1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>`.
3. Otwórz konsolę 
    - Windows: `Ctrl + Shift + J`
    - Mac: `Cmd + Option + J`
4. Wklej skrypt z pliku 
    - Dla filmów: [watchlist_film.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watchlist_film.js)
    - Dla seriali: [watchlist_serial.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watchlist_serial.js)
5. Zostaw kartę otwartą i nie przełączaj na żadną inną!

## Jak zaimportować dane do Letterboxd
Zaloguj się, a następnie2:
- Obejrzane filmy: 
    - Wejdź na _https://letterboxd.com/import/_ -> _Select a file_
    - Wczytaj wszystkie pliki, którę zostały ściągnięte
    - Po zakończeniu importowania przełącz _Hide successful matches_. Pojawią Ci się wtedy wszystkie filmy, których nie udało się zaimportować. Spróbuj wyszukać i dodać je ręcznie.
- Obejrzene seriale: Letterboxd obecnie ma niewielkie wsparcie dla seriali (będzie one wprowadzane w 2024 roku), ale możesz spróbować zrobić to samo, co w przypadku filmów.
- "Chcę zobaczyć" filmy:
    - Wejdź na _https://letterboxd.com/import/_ -> _import to you watchlist_ -> _Import films to watchlist..._
    - Dalej, to samo co w "Obejrzane filmy"
- "Chcę zobaczyć" seriale:
    - Analogicznie do "Obejrzane seriale" i "Chcę zobaczyć filmy"

## Uwagi

- Z powodu ograniczenia rozmiaru pliku, narzuconego przez importer Letterboxd, skrypt dzieli obejrzane filmy/seriale na kilka plików (max 1800 wierszy).
- Częste zmiany na stronie Filmweb'u powodują, że skrypty i API szybko stają się nieaktualne. Gdyby tak się stało, można śmiało zgłaszać swoje _PR_ lub _Issues_.
