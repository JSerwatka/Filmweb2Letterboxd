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

async function parseDomToFilmData(dom) {
  const titleElement = await waitForElement(
    dom,
    ".filmCoverSection__titleDetails"
  );

  try {
    let title = await waitForElementData(
      titleElement,
      ".filmCoverSection__originalTitle",
      { textContent: true }
    );
    if (!title) {
      title = await waitForElementData(
        titleElement,
        ".filmCoverSection__title",
        { textContent: true }
      );
    }
    const year = await waitForElementData(
      titleElement,
      ".filmCoverSection__year",
      { textContent: true }
    );

    return {
      Title: title.includes(",") ? `"${title}"` : title,
      Year: year,
    };
  } catch (e) {
    throw new Error("Błąd skryptu: Wystąpił problem z parsowaniem strony " + e);
  }
}

async function waitForElement(baseElement, selector, timeout = 5000) {
  let timeoutId;

  return new Promise((resolve) => {
    if (baseElement.querySelector(selector)) {
      return resolve(baseElement.querySelector(selector));
    }

    const observer = new MutationObserver((mutations) => {
      if (baseElement.querySelector(selector)) {
        timeoutId && clearTimeout(timeoutId);
        observer.disconnect();
        resolve(baseElement.querySelector(selector));
      }
    });

    observer.observe(baseElement, {
      childList: true,
      subtree: true,
    });

    timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(undefined);
    }, timeout);
  });
}

async function waitForElementData(
  baseElement,
  selector,
  dataToObserve,
  timeout = 3000
) {
  const { dataAttribute, textContent, titleAttribute } = dataToObserve;

  const countObservedData = [dataAttribute, textContent, titleAttribute].filter(
    (data) => Boolean(data)
  );
  if (countObservedData.length > 1) {
    throw new Error("only one attribute can be observed");
  }
  if (countObservedData.length < 1) {
    throw new Error("at least one attribute has to be observed");
  }

  const attributeFilter = [];
  dataAttribute && attributeFilter.push(dataAttribute);
  titleAttribute && attributeFilter.push("title");

  const observerOptions = {
    childList: true,
    subtree: true,
    characterData: Boolean(textContent),
    ...(attributeFilter.length > 0 && {
      attributes: true,
      attributeFilter: attributeFilter,
    }),
  };

  const getValue = () => {
    const element = baseElement.querySelector(selector);
    if (dataAttribute) {
      const dataAttributeNameParts = dataAttribute.split("-").slice(1);
      if (dataAttributeNameParts.length === 1) {
        return element?.dataset[dataAttributeNameParts[0]];
      }
      if (dataAttributeNameParts.length > 1) {
        const dataAttributeCapitalizedNameParts = dataAttributeNameParts
          .slice(1)
          .map(
            (item) =>
              item.charAt(0).toUpperCase() + item.substr(1).toLowerCase()
          );
        const dataAttributeMapped = [
          dataAttributeNameParts[0],
          ...dataAttributeCapitalizedNameParts,
        ].join("");
        return element?.dataset[dataAttributeMapped];
      }
      throw new Error("Incorrect data attribute");
    }
    if (titleAttribute && element?.title) {
      return element?.title;
    }
    if (textContent && element?.textContent) {
      return element?.textContent;
    }
  };

  let timeoutId;

  return new Promise((resolve) => {
    let value = getValue();
    if (value) {
      return resolve(value);
    }
    const observer = new MutationObserver(() => {
      let value = getValue();

      if (value) {
        timeoutId && clearTimeout(timeoutId);
        observer.disconnect();
        resolve(value);
      }
    });

    observer.observe(baseElement, observerOptions);

    timeoutId = setTimeout(() => {
      observer.disconnect();
      resolve(undefined);
    }, timeout);
  });
}

async function getIframeDom(url, iframe) {
  iframe.setAttribute("src", url);

  return new Promise((resolve) =>
    iframe.addEventListener("load", async () => {
      const childDocument = (
        iframe.contentDocument || iframe.contentWindow.document
      ).documentElement;
      iframe.contentWindow.scrollTo({
        top: childDocument.scrollHeight,
        left: 0,
        behavior: "smooth",
      });
      await waitForElement(childDocument, ".filmCoverSection__titleDetails");
      const dom = (iframe.contentDocument || iframe.contentWindow.document)
        .documentElement;
      iframe.contentWindow.scrollTo({ top: 0, left: 0, behavior: "smooth" });
      resolve(dom);
    })
  );
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

  const iframe = document.createElement("iframe");
  iframe.setAttribute("height", 200);
  iframe.setAttribute("width", 200);
  document.body.appendChild(iframe);

  for (let i = 0; i <= expectedChildCount - 1; i++) {
    const movieLink = allMoviesElements[i].querySelector("a").href;
    try {
      const dom = await getIframeDom(movieLink, iframe);
      const parsedData = await parseDomToFilmData(dom);
      allRates.push(parsedData);
    } catch (e) {
      console.log(e);
      return;
    }
    console.log("pobrano " + (i + 1) + " z " + expectedChildCount);
  }

  iframe.remove();

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
