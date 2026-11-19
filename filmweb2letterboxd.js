// Filmweb2Letterboxd – eksport ocen i listy "Chcę zobaczyć" z Filmwebu do CSV dla Letterboxd.
// Użycie: zaloguj się na www.filmweb.pl, otwórz konsolę (Ctrl+Shift+J / Cmd+Option+J),
// wklej cały skrypt i naciśnij Enter. Nie przełączaj karty do końca działania skryptu.

(async () => {
  // ===================== KONFIGURACJA =====================
  const CONFIG = {
    // Które eksporty wykonać. Usuń niepotrzebne pozycje, np. ["watched_film"].
    exports: ["watched_film", "watched_serial", "watchlist_film", "watchlist_serial"],

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

    // Pobrane tytuły są zapamiętywane w przeglądarce, więc ponowne uruchomienie po przerwaniu nie zaczyna od zera.
    // Pamięć jest czyszczona po udanym przebiegu.
    persistCache: true,

    // Zabezpieczenie przed nieskończonym stronicowaniem.
    maxPages: 500,

    // Odstęp między kolejnymi pobieranymi plikami (żeby przeglądarka ich nie blokowała).
    downloadIntervalMs: 1500,
  };
  // ========================================================

  const API_BASE = "https://www.filmweb.pl/api/v1/";

  const EXPORT_DEFINITIONS = {
    watched_film: { kind: "watched", voteTypes: ["film"], label: "obejrzane filmy" },
    watched_serial: { kind: "watched", voteTypes: ["serial", "tvshow"], label: "obejrzane seriale" },
    watchlist_film: { kind: "watchlist", entityNames: ["film"], label: "\"Chcę zobaczyć\" – filmy" },
    watchlist_serial: { kind: "watchlist", entityNames: ["serial", "tvshow"], label: "\"Chcę zobaczyć\" – seriale" },
  };

  class FatalError extends Error {}

  // ---------- narzędzia ----------

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const randomBetween = (min, max) => Math.round(min + Math.random() * (max - min));

  function formatDate(dateNumber) {
    // Filmweb zwraca datę jako liczbę RRRRMMDD. Brak daty -> pusta wartość
    // (Letterboxd oznaczy film jako obejrzany bez tworzenia wpisu w dzienniku).
    const dateStr = dateNumber?.toString();
    if (!dateStr || dateStr.length !== 8) {
      return "";
    }
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
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
    slowdown: 1, // mnożnik przerw, rośnie po 429/5xx i powoli wraca do 1
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
          data = await response.json();
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

      throw new Error(`HTTP ${response.status} ${response.statusText} (${endpoint})`);
    }
  }

  // ---------- pobieranie danych ----------

  const CACHE_KEY = "Filmweb2Letterboxd_titleInfoCache";
  const titleInfoCache = new Map();
  let unsavedCacheEntries = 0;

  function loadCache() {
    if (!CONFIG.persistCache) {
      return;
    }
    try {
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

  function clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(LISTS_KEY);
    } catch (e) {}
  }

  async function getTitleInfo(id) {
    if (!titleInfoCache.has(id)) {
      const info = await fetchApi(`title/${id}/info`);
      // Zapamiętujemy tylko potrzebne pola, żeby nie zapchać localStorage.
      titleInfoCache.set(id, { title: info.title, originalTitle: info.originalTitle, year: info.year });
      unsavedCacheEntries++;
      saveCache();
    }
    return titleInfoCache.get(id);
  }

  async function getAllVotes(voteType) {
    const votes = [];
    const seenIds = new Set();

    for (let page = 1; ; page++) {
      if (page > CONFIG.maxPages) {
        console.warn(
          `Osiągnięto limit ${CONFIG.maxPages} stron dla "${voteType}" – część ocen może być pominięta. ` +
            `Zwiększ CONFIG.maxPages, jeśli masz więcej ocen.`
        );
        break;
      }

      const pageVotes = await fetchApi(`logged/vote/title/${voteType}?page=${page}`);
      if (!Array.isArray(pageVotes) || pageVotes.length === 0) {
        break;
      }

      // Jeśli API zaczęło zwracać w kółko te same wpisy, przerywamy zamiast kręcić się bez końca.
      const newVotes = pageVotes.filter((vote) => !seenIds.has(vote.entity));
      if (newVotes.length === 0) {
        break;
      }
      newVotes.forEach((vote) => seenIds.add(vote.entity));
      votes.push(...newVotes);
      console.log(`Pobrano stronę ${page} ocen (${voteType}), łącznie ${votes.length}`);
    }

    return votes;
  }

  async function getWatchlistIds(entityName) {
    const entries = await fetchApi(`logged/want2see?entityName=${entityName}`);
    // entry = [id, poziom zainteresowania, …]; poziom 0 = "nie interesuje mnie"
    return (entries ?? []).filter((entry) => entry[1] > 0).map((entry) => entry[0]);
  }

  // Zwraca { rows, failures, aborted }. Przy FatalError zwraca to, co udało się zebrać.
  async function buildRows(items, toRow, label) {
    const rows = [];
    const failures = [];
    const startedAt = Date.now();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        rows.push(await toRow(item));
      } catch (e) {
        if (e instanceof FatalError) {
          return { rows, failures, aborted: e };
        }
        failures.push({ export: label, id: item.id ?? "", error: e.message });
        console.warn(e.message);
      }

      if ((i + 1) % 10 === 0 || i + 1 === items.length) {
        const elapsed = Date.now() - startedAt;
        const etaMin = Math.ceil(((elapsed / (i + 1)) * (items.length - i - 1)) / 60000);
        console.log(`${label}: ${i + 1}/${items.length} (pozostało ok. ${etaMin} min)`);
      }
    }

    return { rows, failures, aborted: null };
  }

  function titleFromInfo(info) {
    return info.originalTitle || info.title;
  }

  // Etap 1: lista pozycji bez tytułów (ID Filmwebu + ocena + data obejrzenia).
  // Zapamiętywana w localStorage, więc po przerwaniu nie trzeba ponownie przechodzić stron ocen.
  const LISTS_KEY = "Filmweb2Letterboxd_lists";

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

  function saveList(exportName, items) {
    if (!CONFIG.persistCache) {
      return;
    }
    try {
      const lists = loadSavedLists();
      lists[exportName] = items;
      localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
    } catch (e) {}
  }

  async function listItems(exportName, definition) {
    const saved = loadSavedLists()[exportName];
    if (Array.isArray(saved)) {
      console.log(
        `Wznawiam: lista "${definition.label}" (${saved.length} pozycji) z poprzedniego uruchomienia – pomijam pobieranie stron.`
      );
      return { items: saved, fromCache: true };
    }

    const items = [];
    if (definition.kind === "watched") {
      for (const voteType of definition.voteTypes) {
        const votes = await getAllVotes(voteType);
        items.push(...votes.map((vote) => ({ id: vote.entity, rate: vote.rate, viewDate: vote.viewDate })));
      }
    } else {
      for (const entityName of definition.entityNames) {
        items.push(...(await getWatchlistIds(entityName)).map((id) => ({ id })));
      }
    }

    saveList(exportName, items);
    return { items, fromCache: false };
  }

  function intermediateCsv(definition, items) {
    if (definition.kind === "watched") {
      const rows = items.map((item) => ({
        FilmwebID: item.id,
        Rating10: item.rate > 0 ? item.rate : "",
        WatchedDate: formatDate(item.viewDate),
      }));
      return rowsToCsv(rows, ["FilmwebID", "Rating10", "WatchedDate"]);
    }
    return rowsToCsv(items.map((item) => ({ FilmwebID: item.id })), ["FilmwebID"]);
  }

  // Etap 2: dociągnięcie tytułu i roku dla każdej pozycji.
  async function itemToRow(definition, item) {
    if (!item.id) {
      throw new Error(`Brak ID tytułu w pozycji: ${JSON.stringify(item)}`);
    }
    const info = await getTitleInfo(item.id);
    if (definition.kind === "watched") {
      return {
        Title: titleFromInfo(info),
        Year: info.year,
        Rating10: item.rate > 0 ? item.rate : "",
        WatchedDate: formatDate(item.viewDate),
      };
    }
    return { Title: titleFromInfo(info), Year: info.year };
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

  function download(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
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
    for (let i = 0; i < files.length; i++) {
      if (i > 0) {
        await sleep(CONFIG.downloadIntervalMs);
      }
      download(files[i].name, files[i].content);
      console.log(`Zapisano plik ${files[i].name}`);
    }
  }

  // ---------- główna logika ----------

  if (location.hostname !== "www.filmweb.pl") {
    console.error("Uruchom skrypt w konsoli na stronie https://www.filmweb.pl (po zalogowaniu).");
    return;
  }

  const unknown = CONFIG.exports.filter((name) => !EXPORT_DEFINITIONS[name]);
  if (unknown.length > 0) {
    console.error(`Nieznane eksporty w CONFIG.exports: ${unknown.join(", ")}`);
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
  console.log(
    "Skrypt celowo robi przerwy między zapytaniami, żeby nie obciążać Filmwebu – duże kolekcje mogą zająć kilkadziesiąt minut."
  );

  const files = [];
  const allFailures = [];
  const summary = [];
  let fatal = null;

  for (const exportName of CONFIG.exports) {
    const definition = EXPORT_DEFINITIONS[exportName];
    console.log(`=== ${definition.label} ===`);

    // Etap 1: lista bez tytułów -> od razu plik wstępny, żeby dane były bezpieczne,
    // zanim zacznie się długie dociąganie tytułów.
    let items;
    try {
      const listed = await listItems(exportName, definition);
      items = listed.items;
      if (items.length > 0 && !listed.fromCache) {
        await downloadAll([
          { name: `Filmweb2Letterboxd_${exportName}_wstepny.csv`, content: intermediateCsv(definition, items) },
        ]);
        console.log(`Plik wstępny (bez tytułów, ${items.length} pozycji) zapisany. Dociągam tytuły…`);
      }
    } catch (e) {
      if (e instanceof FatalError) {
        fatal = e;
        break;
      }
      console.error(`Nie udało się pobrać listy: ${definition.label}. ${e.message}`);
      summary.push({ eksport: definition.label, zapisane: 0, nieudane: "cała lista" });
      continue;
    }

    // Etap 2: tytuły i lata.
    const { rows, failures, aborted } = await buildRows(
      items,
      (item) => itemToRow(definition, item),
      definition.label
    );
    allFailures.push(...failures);
    summary.push({ eksport: definition.label, zapisane: rows.length, nieudane: failures.length });

    if (rows.length === 0) {
      console.log(`Brak pozycji: ${definition.label} – pomijam plik.`);
    } else {
      const columns =
        definition.kind === "watched" ? ["Title", "Year", "Rating10", "WatchedDate"] : ["Title", "Year"];
      rowsToCsvFiles(rows, columns).forEach((content, i) => {
        files.push({ name: `Filmweb2Letterboxd_${exportName}_${i}.csv`, content });
      });
    }

    if (aborted) {
      fatal = aborted;
      break;
    }
  }

  if (allFailures.length > 0) {
    files.push({
      name: "Filmweb2Letterboxd_bledy.csv",
      content: rowsToCsv(allFailures, ["export", "id", "error"]),
    });
  }

  document.removeEventListener("visibilitychange", onVisibilityChange);
  window.removeEventListener("beforeunload", onBeforeUnload);
  clearInterval(watchdog);
  setActivity("zapisywanie plików");

  const complete = !fatal && allFailures.length === 0;
  if (complete) {
    clearCache();
  } else {
    saveCache(true);
  }

  if (files.length > 0) {
    console.log("Rozpoczynam zapisywanie plików CSV. Jeśli przeglądarka zapyta o pobieranie wielu plików – zezwól.");
    await downloadAll(files);
  }

  console.table(summary);
  if (allFailures.length > 0) {
    console.warn(`Nie udało się pobrać ${allFailures.length} tytułów – szczegóły w pliku Filmweb2Letterboxd_bledy.csv:`);
    console.table(allFailures);
  }
  if (fatal) {
    console.error(`Przerwano: ${fatal.message}`);
    console.error("Zapisane pliki zawierają tylko dane pobrane przed przerwaniem.");
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
