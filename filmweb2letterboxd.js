// Filmweb2Letterboxd – archiwum Twoich ocen i list "Chcę zobaczyć" z Filmwebu + pliki CSV dla Letterboxd.
// Użycie: zaloguj się na www.filmweb.pl, w tej karcie otwórz https://www.filmweb.pl/robots.txt,
// otwórz konsolę (Ctrl+Shift+J / Cmd+Option+J), wklej cały skrypt i naciśnij Enter.
// Okno przeglądarki musi być widoczne do końca działania skryptu.
//
// Faza 1 (archiwum): wszystkie oceny i listy "Chcę zobaczyć" dla filmów, seriali, programów TV i gier –
//   bez tytułów, za to szybko (kilkadziesiąt zapytań). Zapisywane od razu jako JSON (surowe dane) i CSV.
// Faza 2 (tytuły): dociągnięcie tytułu i roku dla każdej pozycji (jedno zapytanie na tytuł, długo),
//   potem pełny CSV i pliki do importu w Letterboxd.

(async () => {
  // ===================== KONFIGURACJA =====================
  const CONFIG = {
    // Rodzaje tytułów: film, serial, tvshow (programy TV), videogame (gry). Usuń niepotrzebne.
    kinds: ["film", "serial", "tvshow", "videogame"],

    // Listy: watched (oceny / obejrzane), watchlist ("Chcę zobaczyć"). Usuń niepotrzebne.
    lists: ["watched", "watchlist"],

    // false = tylko faza 1 (archiwum bez tytułów), bez długiego dociągania tytułów.
    fetchTitles: true,

    // Importer Letterboxd ma limit rozmiaru pliku – maksymalna liczba wierszy w pliku (z nagłówkiem).
    maxRowsPerFile: 1800,

    // Ograniczanie tempa: losowa przerwa przed każdym zapytaniem (ms).
    delayMinMs: 400,
    delayMaxMs: 1200,

    // Co pewien czas (losowo co 30–60 zapytań) dłuższa przerwa, jak u człowieka, który przegląda stronę.
    longPauseEveryMin: 30,
    longPauseEveryMax: 60,
    longPauseMinMs: 5000,
    longPauseMaxMs: 12000,

    // Ponawianie zapytań po błędach sieci, 429 i 5xx.
    maxRetries: 4,
    retryBaseDelayMs: 5000,
    // Maksymalny czas oczekiwania wg nagłówka Retry-After (dłuższe wartości są przycinane).
    maxRetryAfterMs: 5 * 60 * 1000,

    // Po tylu ms bez odpowiedzi zapytanie jest przerywane i ponawiane (bez tego mogłoby wisieć w nieskończoność).
    requestTimeoutMs: 30000,

    // Pobrane listy i tytuły są zapamiętywane w przeglądarce, więc ponowne uruchomienie po przerwaniu
    // nie zaczyna od zera. Pamięć jest czyszczona po udanym przebiegu.
    persistCache: true,

    // Zabezpieczenie przed nieskończonym stronicowaniem.
    maxPages: 500,

    // Odstęp między kolejnymi pobieranymi plikami (żeby przeglądarka ich nie blokowała).
    downloadIntervalMs: 1500,
  };
  // ========================================================

  const API_BASE = "https://www.filmweb.pl/api/v1/";

  // Rodzaje w ścieżkach API (potwierdzone 2026-11-19 na koncie autora w projekcie Kinoskop):
  // gry to "videogame" ("game" zwraca 400), programy TV to "tvshow".
  const KIND_LABELS = { film: "filmy", serial: "seriale", tvshow: "programy TV", videogame: "gry" };
  const LIST_LABELS = { watched: "oceny", watchlist: "Chcę zobaczyć" };

  class FatalError extends Error {}
  class HttpError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  // ---------- narzędzia ----------

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomBetween = (min, max) => Math.round(min + Math.random() * (max - min));
  const today = new Date().toISOString().slice(0, 10);

  function formatDate(dateNumber) {
    // Filmweb zwraca datę obejrzenia jako liczbę RRRRMMDD. Brak daty -> pusta wartość
    // (Letterboxd oznaczy film jako obejrzany bez tworzenia wpisu w dzienniku).
    const dateStr = dateNumber?.toString();
    if (!dateStr || dateStr.length !== 8) {
      return "";
    }
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }

  // `timestamp` = czas wystawienia oceny / dodania do listy, w ms.
  function formatTimestamp(ms) {
    return typeof ms === "number" && ms > 0 ? new Date(ms).toISOString() : "";
  }

  // ID tytułu: liczba wprost albo zagnieżdżony obiekt.
  function entityId(raw) {
    const value = raw?.entity;
    return typeof value === "object" && value !== null ? value.id : value;
  }

  // ---------- stan i kontrola "czy skrypt żyje" ----------

  // Co skrypt robi w tej chwili – wypisywane przez strażnika, gdy przez dłuższy czas nic się nie dzieje.
  const activity = { state: "start", since: Date.now() };
  const setActivity = (state) => {
    activity.state = state;
    activity.since = Date.now();
  };

  // Przerwa, która wykrywa spowolnienie przez przeglądarkę. Chrome w ukrytej karcie (inna karta,
  // zminimalizowane albo przykryte okno) budzi timery raz na sekundę, a po 5 min nawet raz na minutę
  // (developer.chrome.com/blog/timer-throttling-in-chrome-88).
  async function pause(ms, label) {
    setActivity(label);
    const startedAt = Date.now();
    await sleep(ms);
    const overdue = Date.now() - startedAt - ms;
    if (overdue > 10000) {
      console.warn(
        `Przeglądarka spowolniła skrypt: przerwa trwała ${Math.round((ms + overdue) / 1000)} s zamiast ` +
          `${Math.round(ms / 1000)} s. Okno Chrome z tą kartą musi być widoczne – nie minimalizuj go ` +
          `i nie zasłaniaj innymi oknami (może być mniejsze, z boku ekranu).`
      );
    }
  }

  // ---------- ograniczanie tempa zapytań ----------

  const throttle = {
    requestCount: 0,
    slowdown: 1, // mnożnik przerw, rośnie po 429/5xx/timeoutach i powoli wraca do 1
    nextLongPauseAt: randomBetween(CONFIG.longPauseEveryMin, CONFIG.longPauseEveryMax),

    async beforeRequest() {
      this.requestCount++;
      if (this.requestCount === 1) {
        return;
      }
      if (this.requestCount >= this.nextLongPauseAt) {
        this.nextLongPauseAt =
          this.requestCount + randomBetween(CONFIG.longPauseEveryMin, CONFIG.longPauseEveryMax);
        const ms = randomBetween(CONFIG.longPauseMinMs, CONFIG.longPauseMaxMs) * this.slowdown;
        console.log(`Krótka przerwa (${Math.round(ms / 1000)} s)…`);
        await pause(ms, "dłuższa przerwa między zapytaniami");
        return;
      }
      await pause(randomBetween(CONFIG.delayMinMs, CONFIG.delayMaxMs) * this.slowdown, "przerwa przed zapytaniem");
    },

    onSuccess() {
      this.slowdown = Math.max(1, this.slowdown * 0.97);
    },

    onThrottled() {
      this.slowdown = Math.min(8, this.slowdown * 1.5);
    },
  };

  function retryDelayMs(attempt, response) {
    const retryAfter = Number(response?.headers.get("Retry-After"));
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      return Math.min(retryAfter * 1000, CONFIG.maxRetryAfterMs);
    }
    // 5 s, 15 s, 45 s, 135 s … + losowy rozrzut
    return CONFIG.retryBaseDelayMs * 3 ** attempt + randomBetween(0, 2000);
  }

  // Filmweb trzyma logowanie w krótko ważnym tokenie (ciasteczko HttpOnly), który odświeża przy
  // wczytaniu dowolnej strony HTML. Długi eksport przekracza ten czas i API zaczyna zwracać 401/403.
  // Wczytanie strony głównej (zwykłe GET) odnawia token. Ustalone w projekcie Kinoskop, 2026-11-19.
  async function renewSession() {
    setActivity("odnawiam sesję Filmwebu");
    console.log("Sesja Filmwebu wygasła – odnawiam…");
    await pause(randomBetween(CONFIG.delayMinMs, CONFIG.delayMaxMs), "przerwa przed odnowieniem sesji");
    try {
      await fetch("/", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "text/html" },
        signal: AbortSignal.timeout(CONFIG.requestTimeoutMs),
      });
    } catch (e) {
      // Nieudane odnowienie – kolejne 401/403 przerwie skrypt z czytelnym komunikatem.
    }
  }

  async function fetchApi(endpoint) {
    let sessionRenewed = false;
    for (let attempt = 0; ; attempt++) {
      await throttle.beforeRequest();
      setActivity(`czekam na odpowiedź Filmwebu (${endpoint})`);

      // Timeout obejmuje zarówno nawiązanie połączenia, jak i odczyt treści odpowiedzi.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);

      let response;
      let data;
      try {
        // Ciasteczka sesji są wysyłane automatycznie (to samo źródło), nie trzeba ich dodawać ręcznie.
        response = await fetch(API_BASE + endpoint, {
          method: "GET",
          credentials: "same-origin",
          headers: { "X-Locale": "pl" },
          signal: controller.signal,
        });
        if (response.ok) {
          data = response.status === 204 ? null : await response.json();
        }
      } catch (networkError) {
        const timedOut = networkError.name === "AbortError";
        const reason = timedOut
          ? `brak odpowiedzi od ${Math.round(CONFIG.requestTimeoutMs / 1000)} s`
          : `błąd sieci: ${networkError.message}`;
        if (attempt >= CONFIG.maxRetries) {
          throw new Error(`${reason} (${endpoint})`);
        }
        if (timedOut) {
          throttle.onThrottled(); // serwer przytrzymuje zapytania – zwalniamy
        }
        const wait = retryDelayMs(attempt);
        console.warn(`${reason[0].toUpperCase()}${reason.slice(1)}, ponawiam za ${Math.round(wait / 1000)} s… (${endpoint})`);
        await pause(wait, `czekam na ponowienie po błędzie (${endpoint})`);
        continue;
      } finally {
        clearTimeout(timer);
      }

      if (response.ok) {
        throttle.onSuccess();
        return data;
      }

      if (response.status === 401 || response.status === 403) {
        if (!sessionRenewed) {
          sessionRenewed = true;
          await renewSession();
          attempt--; // odnowienie sesji nie zużywa próby
          continue;
        }
        throw new FatalError(
          `Filmweb odmówił dostępu (HTTP ${response.status}) także po odnowieniu sesji. Upewnij się, ` +
            `że jesteś zalogowany na www.filmweb.pl. Jeśli jesteś zalogowany, Filmweb mógł tymczasowo ` +
            `ograniczyć dostęp – odczekaj kilkanaście minut i uruchom skrypt ponownie (postęp zostanie wznowiony).`
        );
      }

      if ((response.status === 429 || response.status >= 500) && attempt < CONFIG.maxRetries) {
        throttle.onThrottled();
        const wait = retryDelayMs(attempt, response);
        console.warn(
          `HTTP ${response.status} – zwalniam i ponawiam za ${Math.round(wait / 1000)} s… (${endpoint})`
        );
        await pause(wait, `czekam na ponowienie po HTTP ${response.status} (${endpoint})`);
        continue;
      }

      throw new HttpError(response.status, `HTTP ${response.status} ${response.statusText} (${endpoint})`);
    }
  }

  // ---------- pamięć w przeglądarce (wznawianie) ----------

  const CACHE_KEY = "Filmweb2Letterboxd_titleInfoCache";
  const LISTS_KEY = "Filmweb2Letterboxd_lists_v2"; // v2: surowe wpisy z API (inny format niż v1)
  const titleInfoCache = new Map();
  let unsavedCacheEntries = 0;

  function loadCache() {
    if (!CONFIG.persistCache) {
      return;
    }
    try {
      localStorage.removeItem("Filmweb2Letterboxd_lists"); // format z poprzedniej wersji skryptu
      const stored = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
      Object.entries(stored).forEach(([id, info]) => titleInfoCache.set(Number(id), info));
      if (titleInfoCache.size > 0) {
        console.log(`Wznawiam: ${titleInfoCache.size} tytułów wczytanych z poprzedniego uruchomienia.`);
      }
    } catch (e) {
      console.warn("Nie udało się wczytać zapamiętanych tytułów – pobieram od nowa.");
    }
  }

  function saveCache(force = false) {
    if (!CONFIG.persistCache || (!force && unsavedCacheEntries < 10)) {
      return;
    }
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(titleInfoCache)));
      unsavedCacheEntries = 0;
    } catch (e) {
      // Brak miejsca lub zablokowany localStorage – skrypt działa dalej, tylko bez wznawiania.
    }
  }

  function loadSavedLists() {
    if (!CONFIG.persistCache) {
      return {};
    }
    try {
      return JSON.parse(localStorage.getItem(LISTS_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function saveList(listKey, entries) {
    if (!CONFIG.persistCache) {
      return;
    }
    try {
      const lists = loadSavedLists();
      lists[listKey] = entries;
      localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
    } catch (e) {}
  }

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(LISTS_KEY);
    } catch (e) {}
  }

  // ---------- faza 1: listy bez tytułów ----------

  // Stronicowanie: koniec listy = pusta tablica (strony bywają krótsze w środku listy).
  async function fetchAllPages(endpointForPage, label) {
    const entries = [];
    const seenIds = new Set();

    for (let page = 1; ; page++) {
      if (page > CONFIG.maxPages) {
        console.warn(
          `Osiągnięto limit ${CONFIG.maxPages} stron (${label}) – część pozycji może być pominięta. ` +
            `Zwiększ CONFIG.maxPages.`
        );
        break;
      }

      const pageEntries = await fetchApi(endpointForPage(page));
      if (!Array.isArray(pageEntries) || pageEntries.length === 0) {
        break;
      }

      // Jeśli API zaczęło zwracać w kółko te same wpisy, przerywamy zamiast kręcić się bez końca.
      const fresh = pageEntries.filter((entry) => !seenIds.has(entityId(entry)));
      if (fresh.length === 0) {
        break;
      }
      fresh.forEach((entry) => seenIds.add(entityId(entry)));
      entries.push(...fresh);
      console.log(`${label}: strona ${page}, łącznie ${entries.length}`);
    }

    return entries;
  }

  async function fetchWatchlist(kind, label) {
    try {
      // Stronicowane: [{ entity, timestamp, level, … }] (potwierdzone 2026-11-19).
      return await fetchAllPages((page) => `logged/want2see/${kind}?page=${page}`, label);
    } catch (e) {
      if (!(e instanceof HttpError) || (e.status !== 400 && e.status !== 404)) {
        throw e;
      }
      // Starszy endpoint, używany przez poprzednie wersje skryptu: [[id, poziom], …].
      const legacy = await fetchApi(`logged/want2see?entityName=${kind}`);
      return (legacy ?? []).map((entry) => (Array.isArray(entry) ? { entity: entry[0], level: entry[1] } : entry));
    }
  }

  async function fetchList(list, kind) {
    const label = `${LIST_LABELS[list]} – ${KIND_LABELS[kind]}`;
    return list === "watched"
      ? fetchAllPages((page) => `logged/vote/title/${kind}?page=${page}`, label)
      : fetchWatchlist(kind, label);
  }

  // Poziom 0 na liście "Chcę zobaczyć" = "nie interesuje mnie" – w archiwum zostaje, do Letterboxd nie trafia.
  const wantsToSee = (entry) => entry.level === undefined || entry.level === null || entry.level > 0;

  function archiveRow(list, kind, entry, info) {
    return {
      List: list,
      Kind: kind,
      FilmwebID: entityId(entry) ?? "",
      Title: info?.title ?? "", // polski tytuł
      OriginalTitle: info?.originalTitle ?? "",
      Year: info?.year ?? "",
      Rating10: entry.rate > 0 ? entry.rate : "",
      WatchedDate: formatDate(entry.viewDate),
      Timestamp: formatTimestamp(entry.timestamp),
      Favorite: entry.favorite === true ? 1 : "",
      SeenInCinema: entry.seenInCinema === true ? 1 : "",
      WatchlistLevel: entry.level ?? "",
    };
  }

  const ARCHIVE_COLUMNS_BASE = [
    "List", "Kind", "FilmwebID", "Rating10", "WatchedDate", "Timestamp", "Favorite", "SeenInCinema", "WatchlistLevel",
  ];
  const ARCHIVE_COLUMNS_FULL = [
    "List", "Kind", "FilmwebID", "Title", "OriginalTitle", "Year",
    "Rating10", "WatchedDate", "Timestamp", "Favorite", "SeenInCinema", "WatchlistLevel",
  ];

  // ---------- faza 2: tytuły ----------

  async function getTitleInfo(id) {
    if (!titleInfoCache.has(id)) {
      const info = (await fetchApi(`title/${id}/info`)) ?? {};
      // Zapamiętujemy tylko potrzebne pola, żeby nie zapchać localStorage.
      titleInfoCache.set(id, { title: info.title, originalTitle: info.originalTitle, year: info.year });
      unsavedCacheEntries++;
      saveCache();
    }
    return titleInfoCache.get(id);
  }

  function titleFromInfo(info) {
    return info.originalTitle || info.title || "";
  }

  // Zwraca { failures, aborted }. Przy FatalError przerywa i zwraca to, co udało się zebrać.
  async function fetchTitles(ids) {
    const failures = [];
    const todo = ids.filter((id) => !titleInfoCache.has(id));
    const startedAt = Date.now();
    if (ids.length > todo.length) {
      console.log(`Tytuły ${ids.length - todo.length} pozycji są już w pamięci – nie pobieram ich ponownie.`);
    }

    for (let i = 0; i < todo.length; i++) {
      try {
        await getTitleInfo(todo[i]);
      } catch (e) {
        if (e instanceof FatalError) {
          return { failures, aborted: e };
        }
        failures.push({ id: todo[i], error: e.message });
        console.warn(e.message);
      }

      if ((i + 1) % 10 === 0 || i + 1 === todo.length) {
        const elapsed = Date.now() - startedAt;
        const etaMin = Math.ceil(((elapsed / (i + 1)) * (todo.length - i - 1)) / 60000);
        console.log(`Tytuły: ${i + 1}/${todo.length} (pozostało ok. ${etaMin} min)`);
      }
    }

    return { failures, aborted: null };
  }

  // ---------- CSV i pobieranie plików ----------

  function csvField(value) {
    if (value === null || value === undefined) {
      return "";
    }
    const str = String(value);
    // Zgodnie z RFC 4180: cudzysłów, gdy pole zawiera przecinek, cudzysłów, nową linię lub spacje na brzegach.
    if (/[",\r\n]/.test(str) || str.trim() !== str) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  function rowsToCsv(rows, columns) {
    const lines = rows.map((row) => columns.map((column) => csvField(row[column])).join(","));
    return [columns.join(","), ...lines].join("\n") + "\n";
  }

  // Dzieli na pliki o maks. CONFIG.maxRowsPerFile wierszach (z nagłówkiem) – limit importera Letterboxd.
  function rowsToCsvFiles(rows, columns) {
    const rowsPerFile = CONFIG.maxRowsPerFile - 1; // miejsce na nagłówek
    const files = [];
    for (let start = 0; start < rows.length; start += rowsPerFile) {
      files.push(rowsToCsv(rows.slice(start, start + rowsPerFile), columns));
    }
    return files;
  }

  function download(filename, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function downloadAll(files) {
    setActivity("zapisywanie plików");
    for (let i = 0; i < files.length; i++) {
      if (i > 0) {
        await sleep(CONFIG.downloadIntervalMs);
      }
      const type = files[i].name.endsWith(".json") ? "application/json" : "text/csv;charset=utf-8";
      download(files[i].name, files[i].content, type);
      console.log(`Zapisano plik ${files[i].name}`);
    }
  }

  // ---------- główna logika ----------

  if (location.hostname !== "www.filmweb.pl") {
    console.error("Uruchom skrypt w konsoli na stronie https://www.filmweb.pl/robots.txt (po zalogowaniu).");
    return;
  }

  const unknownKinds = CONFIG.kinds.filter((kind) => !KIND_LABELS[kind]);
  const unknownLists = CONFIG.lists.filter((list) => !LIST_LABELS[list]);
  if (unknownKinds.length > 0 || unknownLists.length > 0) {
    console.error(`Nieznane wartości w CONFIG.kinds / CONFIG.lists: ${[...unknownKinds, ...unknownLists].join(", ")}`);
    return;
  }

  const onVisibilityChange = () => {
    if (document.hidden) {
      console.warn(
        "Karta jest ukryta (inna karta, zminimalizowane lub zasłonięte okno) – przeglądarka mocno spowolni skrypt. " +
          "Wróć na tę kartę i zostaw okno widoczne."
      );
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  // Ostrzeżenie przy próbie przeładowania lub zamknięcia karty w trakcie eksportu
  // (strona główna Filmwebu potrafi się sama przeładować i przerwać skrypt).
  const onBeforeUnload = (e) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", onBeforeUnload);

  // Strażnik: jeśli od 45 s nic się nie zmieniło, wypisuje, na co skrypt czeka.
  const watchdog = setInterval(() => {
    const idleSec = Math.round((Date.now() - activity.since) / 1000);
    if (idleSec >= 45) {
      console.warn(
        `Skrypt działa – stan: ${activity.state} (od ${idleSec} s)` +
          (document.hidden ? ". Karta jest UKRYTA – przeglądarka spowalnia skrypt, pokaż okno z tą kartą." : ".")
      );
    }
  }, 30000);

  if (location.pathname !== "/robots.txt") {
    console.warn(
      "Wskazówka: najpewniej działa na https://www.filmweb.pl/robots.txt – zwykłe strony Filmwebu potrafią " +
        "się same przeładować i przerwać skrypt."
    );
  }

  loadCache();
  console.log("Rozpoczynam pobieranie, cierpliwości…");
  console.log("Nie zamykaj ani nie przeładowuj tej karty. Okno Chrome musi być widoczne – nie minimalizuj go i nie zasłaniaj innymi oknami!");

  let fatal = null;
  const summary = [];
  const listErrors = {};
  const allFailures = [];

  // ===== Faza 1: archiwum bez tytułów =====
  console.log("=== Faza 1: archiwum ocen i list (bez tytułów) ===");
  const collected = []; // { list, kind, key, entries }
  let anyFetchedNow = false;

  phase1: for (const list of CONFIG.lists) {
    for (const kind of CONFIG.kinds) {
      const key = `${list}_${kind}`;
      const label = `${LIST_LABELS[list]} – ${KIND_LABELS[kind]}`;

      const saved = loadSavedLists()[key];
      if (Array.isArray(saved)) {
        console.log(`Wznawiam: ${label} (${saved.length} pozycji) z poprzedniego uruchomienia.`);
        collected.push({ list, kind, key, entries: saved });
        continue;
      }

      try {
        const entries = await fetchList(list, kind);
        saveList(key, entries);
        anyFetchedNow = true;
        collected.push({ list, kind, key, entries });
        console.log(`${label}: ${entries.length} pozycji.`);
      } catch (e) {
        if (e instanceof FatalError) {
          fatal = e;
          break phase1;
        }
        listErrors[key] = e.message;
        console.error(`Nie udało się pobrać listy: ${label}. ${e.message}`);
      }
    }
  }

  if (collected.length > 0 && anyFetchedNow) {
    const archive = {
      source: "www.filmweb.pl",
      script: "Filmweb2Letterboxd",
      exportedAt: new Date().toISOString(),
      complete: !fatal && Object.keys(listErrors).length === 0,
      notes:
        "Surowe wpisy z API Filmwebu. rate = ocena 1-10 (0 = bez oceny), viewDate = data obejrzenia RRRRMMDD, " +
        "timestamp = czas oceny / dodania do listy (ms), level = poziom chęci obejrzenia (0 = nie interesuje mnie).",
      lists: Object.fromEntries(collected.map(({ key, entries }) => [key, entries])),
      errors: listErrors,
    };
    const baseRows = collected.flatMap(({ list, kind, entries }) =>
      entries.map((entry) => archiveRow(list, kind, entry, null))
    );
    await downloadAll([
      { name: `Filmweb2Letterboxd_archiwum_${today}.json`, content: JSON.stringify(archive, null, 1) },
      { name: `Filmweb2Letterboxd_wstepny_${today}.csv`, content: rowsToCsv(baseRows, ARCHIVE_COLUMNS_BASE) },
    ]);
    console.log(`Archiwum zapisane: ${baseRows.length} pozycji (JSON z surowymi danymi i CSV).`);
  } else if (collected.length > 0) {
    console.log("Wszystkie listy pochodzą z poprzedniego uruchomienia – archiwum masz już zapisane, pomijam je.");
  }

  // ===== Faza 2: tytuły =====
  let titlesAborted = null;
  if (!fatal && CONFIG.fetchTitles && collected.length > 0) {
    console.log("=== Faza 2: dociąganie tytułów ===");
    const ids = [
      ...new Set(
        collected.flatMap(({ list, entries }) =>
          entries.filter((entry) => list === "watched" || wantsToSee(entry)).map(entityId)
        )
      ),
    ].filter((id) => id !== undefined && id !== null);

    const result = await fetchTitles(ids);
    titlesAborted = result.aborted;
    fatal = fatal || result.aborted;
    allFailures.push(...result.failures);

    const files = [];
    const fullRows = collected.flatMap(({ list, kind, entries }) =>
      entries.map((entry) => archiveRow(list, kind, entry, titleInfoCache.get(entityId(entry))))
    );
    files.push({ name: `Filmweb2Letterboxd_pelny_${today}.csv`, content: rowsToCsv(fullRows, ARCHIVE_COLUMNS_FULL) });

    // Pliki do importu w Letterboxd (format jak w poprzednich wersjach skryptu).
    for (const { list, kind, key, entries } of collected) {
      const rows = [];
      let missing = 0;
      for (const entry of entries) {
        if (list === "watchlist" && !wantsToSee(entry)) {
          continue;
        }
        const info = titleInfoCache.get(entityId(entry));
        if (!info || !titleFromInfo(info)) {
          missing++;
          continue;
        }
        rows.push(
          list === "watched"
            ? {
                Title: titleFromInfo(info),
                Year: info.year,
                Rating10: entry.rate > 0 ? entry.rate : "",
                WatchedDate: formatDate(entry.viewDate),
              }
            : { Title: titleFromInfo(info), Year: info.year }
        );
      }
      summary.push({ lista: `${LIST_LABELS[list]} – ${KIND_LABELS[kind]}`, archiwum: entries.length, "z tytułem": rows.length, "bez tytułu": missing });
      const columns = list === "watched" ? ["Title", "Year", "Rating10", "WatchedDate"] : ["Title", "Year"];
      rowsToCsvFiles(rows, columns).forEach((content, i) => {
        files.push({ name: `Filmweb2Letterboxd_${key}_${i}.csv`, content });
      });
    }

    if (allFailures.length > 0) {
      files.push({ name: "Filmweb2Letterboxd_bledy.csv", content: rowsToCsv(allFailures, ["id", "error"]) });
    }

    console.log("Zapisuję pliki z tytułami. Jeśli przeglądarka zapyta o pobieranie wielu plików – zezwól.");
    await downloadAll(files);
  } else {
    for (const { list, kind, entries } of collected) {
      summary.push({ lista: `${LIST_LABELS[list]} – ${KIND_LABELS[kind]}`, archiwum: entries.length });
    }
  }

  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("beforeunload", onBeforeUnload);
  clearInterval(watchdog);

  // Kompletny przebieg (archiwum bez błędów i, jeśli włączone, wszystkie tytuły) czyści pamięć,
  // żeby kolejne uruchomienie pobrało świeże listy.
  const complete = !fatal && Object.keys(listErrors).length === 0 && allFailures.length === 0;
  if (complete) {
    clearCache();
  } else {
    saveCache(true);
  }

  Object.keys(listErrors).forEach((key) => {
    const [list, kind] = key.split("_");
    summary.push({ lista: `${LIST_LABELS[list]} – ${KIND_LABELS[kind]}`, archiwum: "błąd – uruchom ponownie" });
  });
  console.table(summary);
  if (allFailures.length > 0) {
    console.warn(`Nie udało się pobrać ${allFailures.length} tytułów – szczegóły w pliku Filmweb2Letterboxd_bledy.csv.`);
  }
  if (fatal) {
    console.error(`Przerwano: ${fatal.message}`);
    console.error(
      titlesAborted
        ? "Archiwum bez tytułów jest kompletne; pliki z tytułami zawierają tylko tytuły pobrane przed przerwaniem."
        : "Zapisane archiwum zawiera tylko listy pobrane przed przerwaniem."
    );
  } else {
    console.log("Gotowe!");
  }
  if (!complete && CONFIG.persistCache) {
    console.log(
      "Pobrane listy i tytuły zostały zapamiętane – po ponownym uruchomieniu skrypt pobierze tylko brakujące. " +
        `Aby zacząć od zera: localStorage.removeItem("${CACHE_KEY}"); localStorage.removeItem("${LISTS_KEY}")`
    );
  }
})();
