function formatDate(dateNumber) {
    const dateStr = dateNumber?.toString();
    if (!dateStr) {
        return `2000-01-01`
    }

    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);

    return `${year}-${month}-${day}`;
}

async function fetchApi(endpoint) {
    const dataJSON = await fetch(`https://www.filmweb.pl/api/v1/${endpoint}`, {
        method: "GET",
        headers: {
            Cookie: document.cookie,
            'X-Locale': 'pl',
        }
    })
        .then((response) => {
            if (!response.ok) {
                throw Error(`Błąd skryptu podczas fetchowania`, {
                    endpoint,
                    response: JSON.stringify(response)
                })
            }
            return response.json()
        })

    return dataJSON;
}

async function getAllRates(resourceType) {
    let nextPage = 1
    const allVotes = []
    const allData = [];

    while (true) {
        // get rating, id, viewDate
        const dataJSON = await fetchApi(`logged/vote/title/${resourceType}?page=${nextPage}`)
        if (dataJSON.length == 0) {
            break
        }

        allVotes.push(...dataJSON)
        nextPage += 1;
    }

    if (resourceType === "serial") {
        nextPage = 1

        while (true) {
            const tvseriesJSON = await fetchApi(`logged/vote/title/tvshow?page=${nextPage}`)
            if (tvseriesJSON.length == 0) {
                break
            }

            allVotes.push(...tvseriesJSON)
            nextPage += 1;
        }
    }

    for (let i = 0; i < allVotes.length; i++) {
        const vote = allVotes[i]

        const id = vote["entity"];
        if (!id) {
            throw Error(`Film nie znaleziony: ${JSON.stringify(vote)}`)
        }
        // get title, year
        const restOfData = await fetchApi(`title/${id}/info`);
        const title = restOfData["originalTitle"] ? restOfData["originalTitle"] : restOfData["title"]
        allData.push({
            Title: title.includes(",") ? `"${title}"` : title,
            Year: restOfData.year,
            WatchedDate: formatDate(vote.viewDate),
            Rating10: vote.rate > 0 ? vote.rate : null
        })

        console.log("pobrano " + (i + 1))
    }

    return allData;
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

async function main(resourceType) {
    console.log("Rozpoczynam pobieranie, cierpliwości...");
    console.log("Proszę nie zamykać, przełączać, ani minimalizować tego okna!");
    let allRates = await getAllRates(resourceType);
    console.log("rozpoczynam ściąganie pliku csv");
    let csvRates = arrayToCsv(allRates);

    for (let i = 0; i < csvRates.length; i++) {
        download(`Filmweb2Letterboxd_watched_${resourceType}_${i}.csv`, csvRates[i]);
    }
}

main("film");