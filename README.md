# Filmweb2Letterboxd
<a href="https://buycoffee.to/jserwatka" target="_blank"><img src="https://buycoffee.to/btn/buycoffeeto-btn-primary.svg" style="width: 169px" alt="Postaw mi kawę na buycoffee.to"></a>

Sprawdź też [Letterboxd Tweaks](https://chromewebstore.google.com/detail/letterboxd-tweaks/hopfbphfhmjgdnedoldfpbhepohibfkj)
## O projekcie

Skrypt eksportuje oceny filmów/seriali i "Chcę zobaczyć" z Filmweb'u do formatu csv.
Pliki csv z obejrzanymi mają następujące kolumny:

- _Title_ - oryginalny tytuł programu, a jak nie znajdzie, to polski;
- _Year_ - rok produkcji programu;
- _Rating10_ - ocena użytkownika (puste, jeśli nie oceniono);
- _WatchedDate_ - data obejrzenia (puste, jeśli Filmweb jej nie zna – wtedy Letterboxd oznaczy film jako obejrzany, ale nie doda wpisu do dziennika).

Pliki "Chcę zobaczyć" mają tylko kolumny _Title_ i _Year_.

## Jak używać

1. Zaloguj się do Filmweb'a.
2. Przejdź do `https://www.filmweb.pl/user/<username>`.
3. Otwórz konsolę
       ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/2b4ce2e1-0556-4fbd-b29c-1cb957918ca4)

    - Windows: `Ctrl + Shift + J`
    - Mac: `Cmd + Option + J`
4. Wklej cały skrypt z pliku [filmweb2letterboxd.js](https://github.com/JSerwatka/Filmweb2Letterboxd/blob/master/filmweb2letterboxd.js) i naciśnij Enter.
5. Zostaw kartę otwartą i nie przełączaj na żadną inną!
6. Gdy przeglądarka zapyta, czy zezwolić stronie na pobranie wielu plików – zezwól.

Domyślnie skrypt pobiera wszystko naraz: obejrzane filmy, obejrzane seriale oraz "Chcę zobaczyć" dla filmów i seriali. Jeśli potrzebujesz tylko części, zmień na początku skryptu listę `exports` w sekcji `KONFIGURACJA`, np.:

```js
exports: ["watched_film"],
```

Dostępne wartości: `watched_film`, `watched_serial`, `watchlist_film`, `watchlist_serial`.

Pobrane pliki:

- `Filmweb2Letterboxd_<eksport>_<numer>.csv` – dane do importu;
- `Filmweb2Letterboxd_bledy.csv` – tylko jeśli jakichś tytułów nie udało się pobrać (ID tytułu i przyczyna).

Na koniec w konsoli pojawi się tabela z podsumowaniem: ile pozycji zapisano, a ile się nie udało.

Dalej masz wątpliwości, sprawdź ten komentarz: https://github.com/JSerwatka/Filmweb2Letterboxd/issues/8#issuecomment-1887372746.

## Jak zaimportować dane do Letterboxd
Zaloguj się, a następnie:
- Obejrzane filmy: 
    - Wejdź na _https://letterboxd.com/import/_ -> _Select a file_
          ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/12695a0f-2340-4b51-b0fc-0eb230c6dfc5)

    - Wczytaj wszystkie pliki `watched_film`, którę zostały ściągnięte
    - Po zakończeniu importowania przełącz _Hide successful matches_. Pojawią Ci się wtedy wszystkie filmy, których nie udało się zaimportować. Spróbuj wyszukać i dodać je ręcznie.
- Obejrzene seriale: Letterboxd obecnie ma niewielkie wsparcie dla seriali, ale możesz spróbować zrobić to samo, co w przypadku filmów, z plikami `watched_serial`.
- "Chcę zobaczyć" filmy:
    - Wejdź na _https://letterboxd.com/import/_ -> _import to you watchlist_ -> _Import films to watchlist..._
      ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/2f9c02b0-efe1-4bc6-bfeb-409fd7adb5b5)
        ![image](https://github.com/JSerwatka/Filmweb2Letterboxd/assets/33938646/c63743a3-515b-42ca-bba7-c381b75b480d)

    - Wczytaj pliki `watchlist_film`, dalej to samo co w "Obejrzane filmy"
- "Chcę zobaczyć" seriale:
    - Analogicznie do "Obejrzane seriale" i "Chcę zobaczyć filmy", z plikami `watchlist_serial`

## Uwagi

- Z powodu ograniczenia rozmiaru pliku, narzuconego przez importer Letterboxd, skrypt dzieli dane na kilka plików (max 1800 wierszy). Pliki są zapisywane z krótkimi odstępami – jeśli przeglądarka zablokowała pobieranie wielu plików, zezwól na nie w ustawieniach witryny (ikona w pasku adresu) i uruchom skrypt ponownie.
- Skrypt celowo robi losowe przerwy między zapytaniami (oraz co jakiś czas dłuższą pauzę), żeby nie obciążać Filmweb'u i nie zostać potraktowanym jak bot. Gdy serwer odpowiada błędem przeciążenia (429/5xx), skrypt zwalnia i ponawia zapytanie. Dlatego duże kolekcje (kilka tysięcy ocen) mogą się pobierać kilkadziesiąt minut – w konsoli widać postęp i szacowany pozostały czas. Tempo można zmienić w sekcji `KONFIGURACJA`.
- Jeśli przełączysz kartę, przeglądarka może bardzo spowolnić skrypt – dlatego zostaw ją na wierzchu.
- Jeśli skrypt zostanie przerwany (np. wylogowanie), zapisze dane pobrane do tego momentu i wyświetli komunikat.
- Pobrane tytuły są zapamiętywane w przeglądarce (`localStorage`). Jeśli skrypt się przerwie albo zamkniesz kartę, po ponownym uruchomieniu pobierze tylko brakujące tytuły. Po udanym przebiegu pamięć jest czyszczona.
- Jeśli Filmweb nie odpowie na zapytanie w ciągu 30 s, skrypt je przerywa, zwalnia i ponawia, zamiast czekać w nieskończoność.
- Częste zmiany na stronie Filmweb'u powodują, że skrypty i API szybko stają się nieaktualne. Gdyby tak się stało, można śmiało zgłaszać swoje _PR_ lub _Issues_.

## Letterboxd Tweaks
Stworzyłem również rozszerzenie do przeglądarek opartych na Chromium (Chrome, Edge, Brave) i Firefox, które znacząco podnosi komfort korzystania z serwisu Letterboxd. 
- Rozszerzenie jest dostępne [tutaj](https://chromewebstore.google.com/detail/letterboxd-tweaks/hopfbphfhmjgdnedoldfpbhepohibfkj)
- Kod projektu znajduje się w [tym repo](https://github.com/JSerwatka/letterboxd-tweaks)
