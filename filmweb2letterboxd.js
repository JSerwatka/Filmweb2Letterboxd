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
        await sleep(randomBetween(CONFIG.longPauseMinMs, CONFIG.longPauseMaxMs) * this.slowdown);
        return;
      }
      await sleep(randomBetween(CONFIG.delayMinMs, CONFIG.delayMaxMs) * this.slowdown);
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
      return retryAfter * 1000;
    }
    // 5 s, 15 s, 45 s, 135 s … + losowy rozrzut
    return CONFIG.retryBaseDelayMs * 3 ** attempt + randomBetween(0, 2000);
  }

  async function fetchApi(endpoint) {
    for (let attempt = 0; ; attempt++) {
      await throttle.beforeRequest();

      let response;
      try {
        // Ciasteczka sesji są wysyłane automatycznie (to samo źródło), nie trzeba ich dodawać ręcznie.
        response = await fetch(API_BASE + endpoint, {
          method: "GET",
          credentials: "same-origin",
          headers: { "X-Locale": "pl" },
        });
      } catch (networkError) {
        if (attempt >= CONFIG.maxRetries) {
          throw new Error(`Błąd sieci (${endpoint}): ${networkError.message}`);
        }
        const wait = retryDelayMs(attempt);
        console.warn(`Błąd sieci, ponawiam za ${Math.round(wait / 1000)} s… (${endpoint})`);
        await sleep(wait);
        continue;
      }

      if (response.ok) {
        throttle.onSuccess();
        return response.json();
      }

      if (response.status === 401 || response.status === 403) {
        throw new FatalError(
          `Filmweb odmówił dostępu (HTTP ${response.status}). Upewnij się, że jesteś zalogowany ` +
            `i uruchamiasz skrypt na www.filmweb.pl. Jeśli jesteś zalogowany, Filmweb mógł tymczasowo ` +
            `ograniczyć dostęp – odczekaj kilkanaście minut i spróbuj ponownie.`
        );
      }

      if ((response.status === 429 || response.status >= 500) && attempt < CONFIG.maxRetries) {
        throttle.onThrottled();
        const wait = retryDelayMs(attempt, response);
        console.warn(
          `HTTP ${response.status} – zwalniam i ponawiam za ${Math.round(wait / 1000)} s… (${endpoint})`
        );
        await sleep(wait);
        continue;
      }

      throw new Error(`HTTP ${response.status} ${response.statusText} (${endpoint})`);
    }
  }

  // ---------- pobieranie danych ----------

  const titleInfoCache = new Map();

  async function getTitleInfo(id) {
    if (!titleInfoCache.has(id)) {
      titleInfoCache.set(id, await fetchApi(`title/${id}/info`));
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

  async function collectWatched(definition) {
    const votes = [];
    for (const voteType of definition.voteTypes) {
      votes.push(...(await getAllVotes(voteType)));
    }

    const items = votes.map((vote) => ({ id: vote.entity, vote }));
    return buildRows(
      items,
      async ({ id, vote }) => {
        if (!id) {
          throw new Error(`Brak ID tytułu w ocenie: ${JSON.stringify(vote)}`);
        }
        const info = await getTitleInfo(id);
        return {
          Title: titleFromInfo(info),
          Year: info.year,
          Rating10: vote.rate > 0 ? vote.rate : "",
          WatchedDate: formatDate(vote.viewDate),
        };
      },
      definition.label
    );
  }

  async function collectWatchlist(definition) {
    const ids = [];
    for (const entityName of definition.entityNames) {
      ids.push(...(await getWatchlistIds(entityName)));
    }

    return buildRows(
      ids.map((id) => ({ id })),
      async ({ id }) => {
        const info = await getTitleInfo(id);
        return { Title: titleFromInfo(info), Year: info.year };
      },
      definition.label
    );
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

  function rowsToCsvFiles(rows, columns) {
    const header = columns.join(",");
    const rowsPerFile = CONFIG.maxRowsPerFile - 1; // miejsce na nagłówek
    const files = [];

    for (let start = 0; start < rows.length; start += rowsPerFile) {
      const lines = rows
        .slice(start, start + rowsPerFile)
        .map((row) => columns.map((column) => csvField(row[column])).join(","));
      files.push([header, ...lines].join("\n") + "\n");
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
        "Karta jest w tle – przeglądarka może mocno spowolnić skrypt. Wróć na tę kartę i zostaw ją otwartą."
      );
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  console.log("Rozpoczynam pobieranie, cierpliwości…");
  console.log("Proszę nie zamykać, przełączać, ani minimalizować tego okna!");
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

    let result;
    try {
      result =
        definition.kind === "watched"
          ? await collectWatched(definition)
          : await collectWatchlist(definition);
    } catch (e) {
      if (e instanceof FatalError) {
        fatal = e;
        break;
      }
      console.error(`Nie udało się pobrać listy: ${definition.label}. ${e.message}`);
      summary.push({ eksport: definition.label, zapisane: 0, nieudane: "cała lista" });
      continue;
    }

    const { rows, failures, aborted } = result;
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
      content: rowsToCsvFiles(allFailures, ["export", "id", "error"]).join(""),
    });
  }

  document.removeEventListener("visibilitychange", onVisibilityChange);

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
})();
