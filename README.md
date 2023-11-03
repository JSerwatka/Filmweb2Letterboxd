# Filmweb2Letterboxd

## O projekcie

Skrypty eksportują oceny filmów/seriali i "Chcę zobaczyć" z Filmweb'u do formatu csv.
Pliku csv ma następujące kolumny:

- _Title_ - oryginalny tytuł programu, a jak nie znajdzie, to polski;
- _Year_ - rok produkcji programu;
- _Rating10_ - ocena użytkownika;
- _WatchedDate_ - data obejrzenia.

## Jak używać

### Pobranie obejrzanych filmów

1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>#/film`.
3. Otwórz konsolę (_ctrl+shift+i_ -> _Console_).
4. Wklej skrypt z pliku [watched.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched.js)
5. Zostaw kartę otwartą i nie przełączaj na żadną inną!

### Pobranie obejrzanych seriali

1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>#/votes/serial`.
3. Otwórz konsolę (_ctrl+shift+i_ -> _Console_).
4. Wklej skrypt z pliku [watched.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched.js)
5. Zostaw kartę otwartą i nie przełączaj na żadną inną!

### Pobranie "Chcę zobaczyć"

1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>#/wantToSee`.
3. Otwórz konsolę (_ctrl+shift+i_ -> _Console_).
4. Wklej skrypt z pliku [watchlist.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watchlist.js)
5. Zostaw kartę otwartą i nie przełączaj na żadną inną!

## Uwagi

- Z powodu ograniczenia rozmiaru pliku, narzuconego przez importer Letterboxd, skrypt dzieli obejrzane filmy/seriale na kilka plików (max 1800 wierszy).
- Częste zmiany na stronie Filmweb'u powodują, że skrypty i API szybko stają się nieaktualne. Gdyby tak się stało, można śmiało zgłaszać swoje _PR_ lub _Issues_.
