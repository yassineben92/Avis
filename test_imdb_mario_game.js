
async function fetchGameMetadata(title) {
    try {
        const searchUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/search?q=${title} video game`)}`;
        const response = await fetch(searchUrl);
        const data = await response.json();

        console.log("IMDb Search Data:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Movie API Error:', e);
    }
}

fetchGameMetadata("Super Mario Bros");
