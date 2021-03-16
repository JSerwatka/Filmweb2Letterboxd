# Filmweb2Letterboxd
## O Projekcie

Skrypty eksportują oceny filmów/seriali i "Chcę zobaczyć" z Filmweb'u do formatu csv.
Pliku csv ma następujące kolumny:
* _Title_ - oryginalny tytuł programu, a jak nie znajdzie, to polski;
* _Year_ - rok produkcji programu;
* _Rating10_ - ocena użytkownika;
* _WatchedDate_ - data obejrzenia.

Kod powstał na podstawie projektu [tomasz152/filmweb-export](https://github.com/tomasz152/filmweb-export).

## Jak używać
### Pobranie obejrzanych filmów
1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>/films`.
3. Otwórz konsolę (*ctrl+shift+i*  -> _Console_).
4. Wklej skrypt z pliku [watched.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched.js)

### Pobranie obejrzanych seriali
1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>/serials`.
3. Otwórz konsolę (*ctrl+shift+i*  -> _Console_).
4. Wklej skrypt z pliku [watched.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watched.js)

### Pobranie "Chcę zobaczyć"
1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>/wantToSee`.
3. Otwórz konsolę (*ctrl+shift+i* -> _Console_).
4. Wklej skrypt z pliku [watchlist.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/watchlist.js)

## Uwagi
- Z powodu ograniczenia rozmiaru pliku, narzuconego przez importer Letterboxd, skrypy dzieli obejrzane filmy/seriale na kilka plików (max 1800 wierszy).
- Częste zmiany na stronie Filmweb'u powodują, że skrypty i API szybko stają się nieaktualne. Gdyby tak się stało, można śmiało zgłaszać swoje _PR_ lub _Issues_.
