function parseDom(dom) {
    let iterator_card = dom.evaluate('//div[contains(@class, "voteBoxes__box")]',
        dom, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);
    let arr = [];
    try {
        let ratingBoxNode = iterator_card.iterateNext();
        while (ratingBoxNode) {
            // Get movie's title -> str
            let title = dom.evaluate('.//div[contains(@class, "filmPreview__originalTitle")]',
                ratingBoxNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            if (title == null)
                title = dom.evaluate('.//h2[contains(@class, "filmPreview__title")]',
                    ratingBoxNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
            title = `\"${title.textContent}\"` 

            // Get movie's release year -> str
            let year = dom.evaluate('.//div[contains(@class, "filmPreview__extraYear")]',
                ratingBoxNode, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent;

            arr.push({
                Title: title,
                Year: year
            });

            ratingBoxNode = iterator_card.iterateNext();
        }
        return arr;
    } catch (e) {
        console.log('Wystąpił problem z parsowaniem strony ' + e);
        return [];
    }
}

function getSourceAsDOM(url) {
    let xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", url, false);
    xmlhttp.send();
    let parser = new DOMParser();
    return parser.parseFromString(xmlhttp.responseText, "text/html");
}

function getAllRates() {
    let ratesNum = document.evaluate('//span[contains(@class, "blockHeader__titleInfoCount")]',
        document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.textContent;
    let pages = Math.ceil(ratesNum / 25);
    let url = window.location.href;

    console.log("Rozpoczynam pobieranie, cierpliwości...");
    let allRates = parseDom(document);
    for (let i = 2; i <= pages; i++) {
        let dom = getSourceAsDOM(url + "?page=" + i);
        allRates = allRates.concat(parseDom(dom));
        console.log("pobrano " + Math.min(25 * i, ratesNum) + " z " + ratesNum);
    }

    return allRates;
}

function download(filename, text) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function arrayToCsv(allRates) {
    let csvRates = Object.keys(allRates[0]).join(",") + "\n";
    allRates.forEach((dict) => {
        csvRates += Object.values(dict).join(",");
        csvRates += "\n";
    });

    return csvRates;
}

function main () {
    let allRates = getAllRates();
    let csvRates = arrayToCsv(allRates);
    download('Filmweb2Letterboxd_watchlist.csv', csvRates)
}

main();