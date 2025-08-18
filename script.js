document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const movieForm = document.getElementById('movie-form');
    const movieList = document.getElementById('movie-list');
    const mangaForm = document.getElementById('manga-form');
    const mangaList = document.getElementById('manga-list');
    const gameForm = document.getElementById('game-form');
    const gameList = document.getElementById('game-list');
    const bookForm = document.getElementById('book-form');
    const bookList = document.getElementById('book-list');

    // Load items from local storage
    loadItems('movies', movieList);
    loadItems('manga', mangaList);
    loadItems('games', gameList);
    loadItems('books', bookList);

    // Event Listeners
    movieForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addItem('movies', movieForm, movieList);
    });

    mangaForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addItem('manga', mangaForm, mangaList);
    });

    gameForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addItem('games', gameForm, gameList);
    });

    bookForm.addEventListener('submit', (e) => {
        e.preventDefault();
        addItem('books', bookForm, bookList);
    });

    function addItem(category, form, list) {
        const title = form.querySelector('input[type="text"]').value;
        const rating = form.querySelector('input[type="number"]').value;
        const notes = form.querySelector('textarea').value;

        const item = {
            title,
            rating,
            notes,
            summary: ''
        };

        // For movies, fetch summary from API
        if (category === 'movies') {
            fetchMovieSummary(title, (summary) => {
                item.summary = summary;
                const items = getItems(category);
                items.push(item);
                saveItems(category, items);
                displayItem(item, list);
                form.reset();
            });
        } else {
            const items = getItems(category);
            items.push(item);
            saveItems(category, items);
            displayItem(item, list);
            form.reset();
        }
    }

    function getItems(category) {
        return JSON.parse(localStorage.getItem(category)) || [];
    }

    function saveItems(category, items) {
        localStorage.setItem(category, JSON.stringify(items));
    }

    function loadItems(category, list) {
        const items = getItems(category);
        items.forEach(item => displayItem(item, list));
    }

    function displayItem(item, list) {
        const itemElement = document.createElement('div');
        itemElement.classList.add('media-item');
        itemElement.innerHTML = `
            <h3>${item.title}</h3>
            <p><strong>Rating:</strong> ${item.rating}/10</p>
            <p><strong>Notes:</strong> ${item.notes}</p>
            <p><strong>Summary:</strong> ${item.summary || 'Not available'}</p>
        `;
        list.appendChild(itemElement);
    }

    function fetchMovieSummary(title, callback) {
        const searchUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/search?q=${title}`)}`;

        fetch(searchUrl)
            .then(response => response.json())
            .then(data => {
                if (data.ok && data.description && data.description.length > 0) {
                    const imdbId = data.description[0]['#IMDB_ID'];
                    const detailsUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/title/${imdbId}`)}`;

                    fetch(detailsUrl)
                        .then(response => response.text())
                        .then(html => {
                            const parser = new DOMParser();
                            const doc = parser.parseFromString(html, 'text/html');
                            const summaryElement = doc.querySelector('tg-spoiler');
                            const summary = summaryElement ? summaryElement.textContent.trim() : 'Summary not found.';
                            callback(summary);
                        })
                        .catch(error => {
                            console.error('Error fetching movie details:', error);
                            callback('Could not fetch summary.');
                        });
                } else {
                    callback('Movie not found.');
                }
            })
            .catch(error => {
                console.error('Error searching for movie:', error);
                callback('Could not fetch summary.');
            });
    }
});
