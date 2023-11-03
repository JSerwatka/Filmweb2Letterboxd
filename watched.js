function loadAllInfiniteScrollChildren(allMoviesContainer, expectedChildCount) {
  function scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  return new Promise((resolve, reject) => {
    if (!allMoviesContainer) {
      reject("Błąd skryptu: Target element not found.");
      return;
    }

    if (!expectedChildCount) {
      reject("Błąd skryptu: No children found");
      return;
    }

    const currentChildCount = allMoviesContainer.children.length;
    if (currentChildCount >= expectedChildCount) {
      resolve(allMoviesContainer.children);
    }

    const checkAndScroll = (mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          scrollToBottom();
          const currentChildCount = allMoviesContainer.children.length;

          if (currentChildCount >= expectedChildCount) {
            // All expected children are now visible, scrolling is done
            observer.disconnect();
            resolve(allMoviesContainer.children);
          }
        }
      }
    };

    const observer = new MutationObserver(checkAndScroll);

    observer.observe(allMoviesContainer, { childList: true, subtree: true });

    // Initialize creating new children
    scrollToBottom();
  });
}

function formatDate(dateNumber) {
  const dateStr = dateNumber.toString();

  const year = dateStr.substring(0, 4);
  const month = dateStr.substring(4, 6);
  const day = dateStr.substring(6, 8);

  return `${year}-${month}-${day}`;
}

async function getMovieData(movieUrl) {
  const parser = new DOMParser();

  const DOMContent = await fetch(movieUrl, {
    method: "GET",
    headers: {
      Cookie: document.cookie,
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Bład skryptu podczas ściągania danych filmu`);
      }
      return response.text();
    })
    .catch((error) => {
      console.log(error);
      return undefined;
    });

  if (!DOMContent) {
    return undefined;
  }

  const htmlDocument = parser.parseFromString(DOMContent, "text/html");

  let title = htmlDocument.querySelector(
    ".filmCoverSection__titleDetails > .filmCoverSection__originalTitle"
  )?.textContent;
  if (!title) {
    title = htmlDocument.querySelector(
      ".filmCoverSection__titleDetails > .filmCoverSection__title"
    )?.textContent;
  }

  const year = htmlDocument.querySelector(
    ".filmCoverSection__titleDetails > .filmCoverSection__year"
  )?.textContent;
  const id = htmlDocument.querySelector("a[data-filmid]")?.dataset?.filmid;

  return {
    id,
    movieData: {
      Title: title.includes(",") ? `"${title}"` : title,
      Year: year,
    },
  };
}

async function getRatingData(movieId) {
  const movieUrl = `https://www.filmweb.pl/api/v1/logged/vote/film/${movieId}/details`;
  const ratingJSON = await fetch(movieUrl, {
    method: "GET",
    headers: {
      Cookie: document.cookie,
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Bład skryptu podczas ściągania oceny filmu`);
      }
      return response.json();
    })
    .catch((error) => {
      console.log(error);
      return undefined;
    });

  if (!ratingJSON) {
    return undefined;
  }

  return {
    WatchedDate: formatDate(ratingJSON.viewDate),
    ...(ratingJSON.rate >= 1 && { Rating10: ratingJSON.rate }),
  };
}

async function getAllRates() {
  const allMoviesContainer = document.querySelector(
    'div[data-group="userPage"]  section > div:nth-child(2)'
  );
  const expectedChildCount = Number(
    document.querySelector(
      'div[data-group="userPage"] li > a.active[data-counter]'
    ).dataset.counter ?? ""
  );
  let allMoviesElements;

  try {
    allMoviesElements = await loadAllInfiniteScrollChildren(
      allMoviesContainer,
      expectedChildCount
    );
  } catch (error) {
    throw new Error(error);
  }

  const allRates = [];

  for (let i = 0; i <= expectedChildCount - 1; i++) {
    const movieLink = allMoviesElements[i].querySelector("a").href;

    try {
      const { id, movieData } = await getMovieData(movieLink);
      if (!id || !movieData) {
        continue;
      }
      const ratingData = await getRatingData(id);

      allRates.push({ ...movieData, ...ratingData });
    } catch (e) {
      console.log(e);
      return allRates;
    }
    console.log("pobrano " + (i + 1) + " z " + expectedChildCount);
  }
  return allRates;
}

function download(filename, text) {
  const element = document.createElement("a");
  element.setAttribute(
    "href",
    "data:text/plain;charset=utf-8," + encodeURIComponent(text)
  );
  element.setAttribute("download", filename);
  element.style.display = "none";
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function arrayToCsv(allRates) {
  let csvRates = Object.keys(allRates[0]).join(",") + "\n";
  let filesArray = [];

  for (let i = 0; i < allRates.length; i++) {
    // Split csv for rate count > 1800
    if (i % 1799 == 0 && i > 0) {
      filesArray.push(csvRates);
      csvRates = Object.keys(allRates[0]).join(",") + "\n";
    }
    csvRates += Object.values(allRates[i]).join(",");
    csvRates += "\n";
  }
  filesArray.push(csvRates);

  return filesArray;
}

async function main() {
  console.log("Rozpoczynam pobieranie, cierpliwości...");
  console.log("Proszę nie zamykać, przełączać, ani minimalizować tego okna!");
  let allRates = await getAllRates();
  console.log("rozpoczynam ściąganie pliku csv");
  let csvRates = arrayToCsv(allRates);

  for (let i = 0; i < csvRates.length; i++) {
    download(`Filmweb2Letterboxd_watched_${i}.csv`, csvRates[i]);
  }
}

main();
