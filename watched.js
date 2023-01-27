const monthMapper = {
  stycznia: "01",
  lutego: "02",
  marca: "03",
  kwietnia: "04",
  maja: "05",
  czerwca: "06",
  lipca: "07",
  sierpnia: "08",
  września: "09",
  października: "10",
  listopada: "11",
  grudnia: "12",
};

const mapDate = (date) => {
  const [day, monthName, year] = date.split(" ");

  if (!year || !monthName || !day) {
    return "";
  }

  return `${year}-${monthMapper[monthName]}-${day.padStart(2, "0")}`;
};

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
      const userVote = movie.querySelector("span.userRate__rate").textContent;
      const voteDate = mapDate(
        movie.querySelector(".voteCommentBox__date").textContent
      );

      arr.push({
        Title: title.includes(",") ? `"${title}"` : title,
        Year: year,
        Rating10: userVote,
        WatchedDate: voteDate,
      });
    }

    return arr;
  } catch (e) {
    console.log("Wystąpił problem z parsowaniem strony " + e);
    return [];
  }
};

const waitForCommentSectionToLoad = async (iframe, i) => {
  return new Promise((resolve) => {
    const waitForDateInterval = setInterval(() => {
      const childDocument = (
        iframe.contentDocument || iframe.contentWindow.document
      ).documentElement;
      const commentSections = childDocument.querySelectorAll(".voteCommentBox");

      commentSections[i].scrollIntoView(false);

      if (
        commentSections[i].querySelector(".voteCommentBox__date").textContent
      ) {
        clearInterval(waitForDateInterval);
        resolve();
      }
    }, 100);
  });
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
      const commentSections = childDocument.querySelectorAll(".voteCommentBox");

      for (let i = 0; i < commentSections.length; i++) {
        await waitForCommentSectionToLoad(iframe, i);
      }

      const dom = (iframe.contentDocument || iframe.contentWindow.document)
        .documentElement;
      iframe.remove();
      resolve(dom);
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
};

const main = async () => {
  let allRates = await getAllRates();
  let csvRates = arrayToCsv(allRates);

  for (let i = 0; i < csvRates.length; i++) {
    download(`Filmweb2Letterboxd_watched_${i}.csv`, csvRates[i]);
  }
};

main();
