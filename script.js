document.addEventListener('DOMContentLoaded', () => {
    // State
    let activeCategory = 'movies';

    const singularMap = {
        'movies': 'Movie',
        'manga': 'Manga',
        'games': 'Game',
        'books': 'Book'
    };

    // DOM Elements
    const tabs = document.querySelectorAll('.tab-btn');
    const contentArea = document.getElementById('content-area');
    const addForm = document.getElementById('add-form');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const categoryLabel = document.getElementById('category-label');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Initial Load
    renderItems();

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCategory = tab.dataset.tab;

            // Update label text based on category
            categoryLabel.textContent = singularMap[activeCategory] || 'Item';

            renderItems();
        });
    });

    // Form Toggle
    toggleFormBtn.addEventListener('click', () => {
        addForm.classList.toggle('hidden');
        if (!addForm.classList.contains('hidden')) {
            requestAnimationFrame(() => {
                document.getElementById('item-title').focus();
            });
        }
    });

    // Add Item
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('item-title');
        const ratingInput = document.getElementById('item-rating');
        const notesInput = document.getElementById('item-notes');

        const title = titleInput.value;
        const rating = ratingInput.value;
        const notes = notesInput.value;

        // UI Feedback
        const submitBtn = addForm.querySelector('.submit-btn');
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding Metadata...';
        submitBtn.disabled = true;

        try {
            const item = {
                title,
                rating,
                notes,
                summary: '',
                imageUrl: '',
                dateAdded: new Date().toISOString()
            };

            // Fetch Metadata
            let deferredFetch = null;
            if (typeof window.fetchMetadata === 'function') {
                const metadata = await window.fetchMetadata(activeCategory, title);
                if (metadata) {
                    item.summary = metadata.summary || '';
                    item.imageUrl = metadata.imageUrl || '';
                    if (metadata.deferredSummary) {
                        deferredFetch = metadata.deferredSummary;
                    }
                }
            }

            saveItem(activeCategory, item);
            renderItems();

            // Reset and Close
            addForm.reset();
            addForm.classList.add('hidden');

            // Handle deferred fetch
            if (deferredFetch) {
                deferredFetch().then(result => {
                    if (result) {
                        // Result can be string or object { summary, imageUrl }
                        if (typeof result === 'string') {
                            item.summary = result;
                        } else if (typeof result === 'object') {
                            if (result.summary) item.summary = result.summary;
                            if (result.imageUrl) item.imageUrl = result.imageUrl;
                        }

                        updateItem(activeCategory, item);
                        renderItems();
                    }
                });
            }
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Failed to add item. See console for details.');
        } finally {
             submitBtn.innerHTML = originalBtnContent;
             submitBtn.disabled = false;
        }
    });

    // Data Management
    function getItems(category) {
        return JSON.parse(localStorage.getItem(category)) || [];
    }

    function saveItem(category, item) {
        const items = getItems(category);
        items.unshift(item); // Add to top
        localStorage.setItem(category, JSON.stringify(items));
    }

    function updateItem(category, updatedItem) {
        const items = getItems(category);
        const index = items.findIndex(i => i.dateAdded === updatedItem.dateAdded);
        if (index !== -1) {
            items[index] = updatedItem;
            localStorage.setItem(category, JSON.stringify(items));
        }
    }

    // Rendering
    function renderItems() {
        contentArea.innerHTML = '';
        const items = getItems(activeCategory);

        if (items.length === 0) {
            contentArea.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <i class="fas fa-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
                    <p>No items in this collection yet.</p>
                </div>`;
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'media-item';

            // Handle legacy data or missing images
            let imageHtml;
            if (item.imageUrl) {
                imageHtml = `<img src="${item.imageUrl}" alt="${item.title}" class="poster-image">`;
            } else {
                let icon = 'fa-image';
                if (activeCategory === 'movies') icon = 'fa-film';
                if (activeCategory === 'manga') icon = 'fa-book-open';
                if (activeCategory === 'games') icon = 'fa-gamepad';
                if (activeCategory === 'books') icon = 'fa-book';

                imageHtml = `<div class="no-image"><i class="fas ${icon}"></i><span>${item.title}</span></div>`;
            }

            card.innerHTML = `
                <div class="poster-container">
                    ${imageHtml}
                </div>
                <div class="item-info">
                    <div class="item-rating"><i class="fas fa-star"></i> ${item.rating}/10</div>
                    <h3 class="item-title">${item.title}</h3>
                    <p class="item-summary">${item.summary || 'No summary available.'}</p>
                    <p class="item-notes">${item.notes || ''}</p>
                </div>
            `;
            fragment.appendChild(card);
        });
        contentArea.appendChild(fragment);
    }

    // API Integrations
    const metadataCache = {};

    window.fetchMetadata = async function(category, title) {
        const cacheKey = `${category}:${title.toLowerCase().trim()}`;
        if (metadataCache[cacheKey]) {
            return metadataCache[cacheKey];
        }

        try {
            let result = null;
            if (category === 'movies') {
                result = await fetchMovieMetadata(title);
            } else if (category === 'manga') {
                result = await fetchMangaMetadata(title);
            } else if (category === 'games') {
                result = await fetchGameMetadata(title);
            } else if (category === 'books') {
                result = await fetchBookMetadata(title);
            }

            if (result) {
                metadataCache[cacheKey] = result;
            }
            return result;
        } catch (error) {
            console.error(`Error fetching metadata for ${category}:`, error);
            return null;
        }
    };

    async function fetchImdbMetadata(title) {
        try {
            const searchUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/search?q=${title}`)}`;
            const response = await fetch(searchUrl);
            const data = await response.json();

            if (data.ok && data.description && data.description.length > 0) {
                const result = data.description[0];
                const imdbId = result['#IMDB_ID'];
                let imageUrl = result['#IMG_POSTER'];

                // Define deferred task for fetching details
                const deferredSummary = async () => {
                    try {
                        const detailsUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/title/${imdbId}`)}`;
                        const detailsResponse = await fetch(detailsUrl);
                        const html = await detailsResponse.text();
                        const parser = new DOMParser();
                        const doc = parser.parseFromString(html, 'text/html');

                        const summaryElement = doc.querySelector('tg-spoiler') || doc.querySelector('[data-testid="plot-xl"]') || doc.querySelector('.ipc-html-content-inner-div');
                        const summary = summaryElement ? summaryElement.textContent.trim() : 'Summary not available.';

                        // Also try to find better image if initial was missing
                        let updatedImageUrl = imageUrl;
                        if (!updatedImageUrl) {
                            const imgElement = doc.querySelector('.ipc-image') || doc.querySelector('img[class*="poster"]');
                            if (imgElement) updatedImageUrl = imgElement.src;
                        }

                        return { summary, imageUrl: updatedImageUrl };
                    } catch (e) {
                        console.error('Deferred IMDb Details Error:', e);
                        return null;
                    }
                };

                return { summary: '', imageUrl, deferredSummary };
            }
        } catch (e) {
            console.error('IMDb API Error:', e);
        }
        return null;
    }

    async function fetchMovieMetadata(title) {
        return fetchImdbMetadata(title);
    }

    // Uses Jikan API (MyAnimeList) - Dedicated and robust for Manga
    async function fetchMangaMetadata(title) {
        try {
            const response = await fetch(`https://api.jikan.moe/v4/manga?q=${title}&limit=1`);
            const data = await response.json();

            if (data.data && data.data.length > 0) {
                const manga = data.data[0];
                return {
                    summary: manga.synopsis,
                    imageUrl: manga.images.jpg.large_image_url
                };
            }
        } catch (e) {
            console.error('Manga API Error:', e);
        }
        return null;
    }

    // Uses IMDb via proxy - Provides high-quality images.
    // Note: May return movie adaptations for ambiguous titles (e.g. "Mario"), but ensures an image is always found.
    async function fetchGameMetadata(title) {
        return fetchImdbMetadata(title);
    }

    // Uses OpenLibrary API - Dedicated and open for Books
    async function fetchBookMetadata(title) {
        try {
            const response = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&limit=1`);
            const data = await response.json();

            if (data.docs && data.docs.length > 0) {
                const book = data.docs[0];
                const coverId = book.cover_i;
                const imageUrl = coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;

                let summary = 'Summary not available.';
                if (book.key) {
                     try {
                         const workResponse = await fetch(`https://openlibrary.org${book.key}.json`);
                         const workData = await workResponse.json();
                         if (typeof workData.description === 'string') {
                             summary = workData.description;
                         } else if (workData.description && workData.description.value) {
                             summary = workData.description.value;
                         }
                     } catch (e) {
                         console.warn('Could not fetch book summary', e);
                     }
                }

                return { summary, imageUrl };
            }
        } catch (e) {
            console.error('Book API Error:', e);
        }
        return null;
    }
});
