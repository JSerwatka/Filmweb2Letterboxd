const parseDom = (dom) => {
  const moviesNodes = dom.querySelectorAll("div.voteBoxes__box");
  let arr = [];

  try {
    for (movie of moviesNodes) {
      let title = movie.querySelector(
        "div.preview__alternateTitle"
      )?.textContent;

      if (!title) {
        title = movie.querySelector("h2.preview__title").textContent;
      }

      const year = movie.querySelector("div.preview__year").textContent;

      arr.push({
        Title: title.includes(",") ? `"${title}"` : title,
        Year: year,
      });
    }

    return arr;
  } catch (e) {
    console.log("Wystąpił problem z parsowaniem strony " + e);
    return [];
  }
};

const getIframeDom = async (url) => {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("src", url);
  iframe.setAttribute("height", 200);
  iframe.setAttribute("width", 200);
  document.body.appendChild(iframe);

  return new Promise((resolve) =>
    iframe.addEventListener("load", async () => {
      const childDocument = (
        iframe.contentDocument || iframe.contentWindow.document
      ).documentElement;
      iframe.remove();
      resolve(childDocument);
    })
  );
};

const getAllRates = async () => {
  const ratesNum = Number(
    document.querySelector(".blockHeader__titleInfoCount").textContent
  );
  const numOfPages = Math.ceil(ratesNum / 25);
  const userFilmwebUrl = window.location.href;
  let allRates = [];

  console.log("Rozpoczynam pobieranie, cierpliwości...");
  for (let i = 1; i <= numOfPages; i++) {
    const dom = await getIframeDom(userFilmwebUrl + "?page=" + i);
    allRates = allRates.concat(parseDom(dom));
    console.log("pobrano " + Math.min(25 * i, ratesNum) + " z " + ratesNum);
  }

  return allRates;
};

const download = (filename, text) => {
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
};

const arrayToCsv = (allRates) => {
  let csvRates = Object.keys(allRates[0]).join(",") + "\n";
  allRates.forEach((dict) => {
    csvRates += Object.values(dict).join(",");
    csvRates += "\n";
  });

  return csvRates;
};

const main = async () => {
  let allRates = await getAllRates();
  let csvRates = arrayToCsv(allRates);
  download("Filmweb2Letterboxd_watchlist.csv", csvRates);
};

main();
