document.addEventListener('DOMContentLoaded', () => {
    // Toast Notification System
    const Toast = {
        init() {
            this.container = document.createElement('div');
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        },
        show(message, type = 'info') {
            if (!this.container) this.init();

            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            let icon = 'fa-info-circle';
            if (type === 'success') icon = 'fa-check-circle';
            if (type === 'error') icon = 'fa-exclamation-circle';

            toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;

            this.container.appendChild(toast);

            // Trigger reflow for animation
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });

            setTimeout(() => {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => {
                    toast.remove();
                });
            }, 3000);
        }
    };

    // State
    let activeCategory = 'movies';

    // DOM Elements
    const tabs = document.querySelectorAll('.tab-btn');
    const contentArea = document.getElementById('content-area');
    const addForm = document.getElementById('add-form');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const categoryLabel = document.getElementById('category-label');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Filter & Sort
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');

    // Modals
    const importBtn = document.getElementById('import-btn');
    const importModal = document.getElementById('import-modal');
    const confirmImportBtn = document.getElementById('confirm-import-btn');
    const statsBtn = document.getElementById('stats-btn');
    const statsModal = document.getElementById('stats-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const recommendBtn = document.getElementById('recommend-btn');
    const recommendModal = document.getElementById('recommend-modal');
    const recommendationContent = document.getElementById('recommendation-content');
    const closeButtons = document.querySelectorAll('.close-modal');

    // Initial Load
    renderItems();
    loadApiKey();

    // Filter Listeners
    searchInput.addEventListener('input', renderItems);
    sortSelect.addEventListener('change', renderItems);

    // Modal Logic
    function openModal(modal) {
        modal.classList.remove('hidden');
    }
    function closeModal(modal) {
        modal.classList.add('hidden');
    }

    [importBtn, statsBtn, settingsBtn, recommendBtn].forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.currentTarget.id === 'import-btn') openModal(importModal);
            if (e.currentTarget.id === 'stats-btn') {
                openModal(statsModal);
                updateStats();
            }
            if (e.currentTarget.id === 'settings-btn') openModal(settingsModal);
            if (e.currentTarget.id === 'recommend-btn') {
                openModal(recommendModal);
                generateRecommendations();
            }
        });
    });

    closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.add('hidden');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.add('hidden');
        }
    });

    // Import Logic
    confirmImportBtn.addEventListener('click', async () => {
        const text = document.getElementById('import-text').value;
        if (!text.trim()) return;

        confirmImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing with AI...';
        confirmImportBtn.disabled = true;

        const apiKey = localStorage.getItem('google_api_key') ? localStorage.getItem('google_api_key').trim() : '';
        let itemsToImport = [];

        // Try AI Import first
        if (apiKey) {
            try {
                const prompt = `Parse the following unstructured text into a JSON array of objects.
                Each object must have:
                - "title": (string) The title of the media.
                - "year": (number or null) The release year if mentioned or widely known for this title (e.g. 2024).
                - "rating": (number) A score from 1 to 10. if not explicitly stated, infer it from the sentiment of the review (e.g. "masterclass"=10, "nul"=2).
                - "notes": (string) The user's review or comments.

                The text contains multiple items mixed together. Ignore lines that look like generic headers unless they are titles.
                Return ONLY valid JSON, no markdown formatting.

                Text to parse:
                ${text.substring(0, 30000)} // Limit length to avoid token limits
                `;

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }]
                    })
                });

                const data = await response.json();

                if (data.error) {
                    throw new Error(data.error.message);
                }

                if (data.candidates && data.candidates[0].content) {
                    let jsonText = data.candidates[0].content.parts[0].text;
                    // Clean up markdown code blocks if present
                    jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
                    itemsToImport = JSON.parse(jsonText);
                }
            } catch (e) {
                console.error('AI Import failed, falling back to basic parsing:', e);
                Toast.show(`AI Import failed (${e.message}). Falling back to simple line-by-line import.`, 'error');
            }
        } else {
             Toast.show("No API Key found. Using simple line-by-line import. Add API Key in Settings for smart import.", 'info');
        }

        // Fallback or if AI returned empty (and didn't error out completely)
        if (itemsToImport.length === 0) {
            const lines = text.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                let title = line;
                let notes = '';
                if (line.includes(':')) {
                    const parts = line.split(':');
                    title = parts[0].trim();
                    notes = parts.slice(1).join(':').trim();
                }
                // Basic heuristic for fallback
                let rating = 5;
                const lower = notes.toLowerCase();
                if (lower.includes('masterclass')) rating = 10;
                else if (lower.includes('nul')) rating = 2;

                itemsToImport.push({ title, rating, notes });
            }
        }

        // Process imported items
        let count = 0;
        for (const importedItem of itemsToImport) {
            const item = {
                title: importedItem.title || 'Unknown Title',
                year: importedItem.year || null,
                rating: importedItem.rating || 5,
                notes: importedItem.notes || '',
                summary: '',
                imageUrl: '',
                dateAdded: new Date().toISOString()
            };

            // Fetch metadata
            if (typeof fetchMetadata === 'function') {
                try {
                     const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000));
                     const metadata = await Promise.race([fetchMetadata(activeCategory, item.title, item.year), timeoutPromise]).catch(() => null);
                     if (metadata) {
                         item.summary = metadata.summary || '';
                         item.imageUrl = metadata.imageUrl || '';
                     }
                } catch (e) { console.log('Import fetch skipped for ' + item.title); }
            }

            saveItem(activeCategory, item);
            count++;
        }

        renderItems();
        closeModal(importModal);
        document.getElementById('import-text').value = '';
        confirmImportBtn.innerHTML = 'Import';
        confirmImportBtn.disabled = false;
        Toast.show(`Successfully imported ${count} items into ${activeCategory}!`, 'success');
    });

    // Settings Logic
    saveSettingsBtn.addEventListener('click', async () => {
        const keyInput = document.getElementById('api-key');
        const key = keyInput.value.trim();

        if (!key) {
            Toast.show('Please enter an API Key.', 'error');
            return;
        }

        const originalText = saveSettingsBtn.innerHTML;
        saveSettingsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying...';
        saveSettingsBtn.disabled = true;

        try {
            // Test the key by listing models
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            const data = await response.json();

            if (response.ok && data.models) {
                localStorage.setItem('google_api_key', key);
                Toast.show('API Key verified and saved successfully!', 'success');
                closeModal(settingsModal);
            } else {
                const errorMsg = data.error ? data.error.message : 'Unknown error';
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('API Key Validation Failed:', error);
            Toast.show(`Invalid API Key: ${error.message}`, 'error');
        } finally {
            saveSettingsBtn.innerHTML = originalText;
            saveSettingsBtn.disabled = false;
        }
    });

    function loadApiKey() {
        const key = localStorage.getItem('google_api_key');
        if (key) {
            document.getElementById('api-key').value = key.trim();
        }
    }

    // Recommendation Logic (Gemini)
    async function generateRecommendations() {
        const apiKey = localStorage.getItem('google_api_key') ? localStorage.getItem('google_api_key').trim() : '';
        if (!apiKey) {
            recommendationContent.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-key"></i>
                    <p>Please enter your Google AI Studio API Key in Settings first.</p>
                </div>`;
            return;
        }

        const items = getItems(activeCategory);
        if (items.length < 3) {
            recommendationContent.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-info-circle"></i>
                    <p>Add at least 3 items to your ${activeCategory} list to get recommendations.</p>
                </div>`;
            return;
        }

        // Prepare Prompt
        const libraryText = items.slice(0, 30).map(i => `- ${i.title} (${i.rating}/10): ${i.notes}`).join('\n');
        const prompt = `Based on my following ${activeCategory} library and reviews, recommend 3 new ${activeCategory} I might like.
        Format the output as a simple HTML list with <h3>Title</h3>, <p><strong>Reason:</strong> ...</p> per item. Do not include markdown code blocks.

        My Library:
        ${libraryText}`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            const data = await response.json();

            if (data.candidates && data.candidates[0].content) {
                const aiText = data.candidates[0].content.parts[0].text;
                // Basic clean up of markdown if Gemini sends it
                const htmlContent = aiText.replace(/```html/g, '').replace(/```/g, '');
                recommendationContent.innerHTML = htmlContent;
            } else {
                throw new Error('No candidates in response');
            }

        } catch (error) {
            console.error('Recommendation Error:', error);
            recommendationContent.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to get recommendations. Check your API Key and internet connection.</p>
                    <small>${error.message}</small>
                </div>`;
        }
    }

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeCategory = tab.dataset.tab;

            // Update label text based on category
            const singularMap = {
                'movies': 'Movie',
                'manga': 'Manga',
                'games': 'Game',
                'books': 'Book'
            };
            categoryLabel.textContent = singularMap[activeCategory] || 'Item';

            renderItems();
        });
    });

    // Form Toggle
    toggleFormBtn.addEventListener('click', () => {
        addForm.classList.toggle('hidden');
        if (!addForm.classList.contains('hidden')) {
             document.getElementById('item-title').focus();
        }
    });

    // Add Item
    addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const titleInput = document.getElementById('item-title');
        const yearInput = document.getElementById('item-year');
        const ratingInput = document.getElementById('item-rating');
        const notesInput = document.getElementById('item-notes');

        const title = titleInput.value;
        const year = yearInput.value ? parseInt(yearInput.value) : null;
        const rating = ratingInput.value;
        const notes = notesInput.value;

        try {
            const dateAdded = new Date().toISOString();
            const item = {
                title,
                year,
                rating,
                notes,
                summary: '',
                imageUrl: '',
                dateAdded: dateAdded,
                isLoading: true
            };

            saveItem(activeCategory, item);
            renderItems();

            // Reset and Close Immediately
            addForm.reset();
            addForm.classList.add('hidden');
            Toast.show('Item added! Fetching details...', 'info');

            // Background Fetch
            (async () => {
                let updates = { isLoading: false };

                if (typeof fetchMetadata === 'function') {
                    try {
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), 10000)
                        );

                        const metadata = await Promise.race([
                            fetchMetadata(activeCategory, title, year),
                            timeoutPromise
                        ]);

                        if (metadata) {
                            updates.summary = metadata.summary || '';
                            updates.imageUrl = metadata.imageUrl || '';
                        }
                    } catch (e) {
                        console.warn('Background fetch failed:', e);
                    }
                }

                updateItemData(activeCategory, dateAdded, updates);
            })();

        } catch (error) {
            console.error('Error adding item:', error);
            Toast.show('Failed to add item.', 'error');
        }
    });

    // Stats Logic
    function updateStats() {
        const categories = ['movies', 'manga', 'games', 'books'];
        let totalItems = 0;
        let totalRating = 0;
        let maxCount = -1;
        let topCategory = '-';
        let breakdownHtml = '';

        categories.forEach(cat => {
            const items = getItems(cat);
            const count = items.length;
            totalItems += count;

            if (count > 0) {
                const catTotalRating = items.reduce((sum, item) => sum + parseFloat(item.rating || 0), 0);
                totalRating += catTotalRating;
            }

            if (count > maxCount) {
                maxCount = count;
                topCategory = cat;
            }

            breakdownHtml += `
                <div class="stat-row">
                    <span>${cat}</span>
                    <span>${count} items</span>
                </div>
            `;
        });

        const avg = totalItems > 0 ? (totalRating / totalItems).toFixed(1) : '0.0';

        document.getElementById('stat-total').textContent = totalItems;
        document.getElementById('stat-avg').textContent = avg;
        document.getElementById('stat-top-cat').textContent = totalItems > 0 ? topCategory : '-';
        document.getElementById('stat-breakdown').innerHTML = breakdownHtml;
    }

    // Data Management
    function getItems(category) {
        return JSON.parse(localStorage.getItem(category)) || [];
    }

    function saveItem(category, item) {
        const items = getItems(category);
        items.unshift(item); // Add to top
        localStorage.setItem(category, JSON.stringify(items));
    }

    function updateItemData(category, dateAdded, updates) {
        const items = getItems(category);
        const index = items.findIndex(i => i.dateAdded === dateAdded);
        if (index !== -1) {
            items[index] = { ...items[index], ...updates };
            localStorage.setItem(category, JSON.stringify(items));
            renderItems();
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function deleteItem(dateAdded) {
        const items = getItems(activeCategory);
        const index = items.findIndex(i => i.dateAdded === dateAdded);

        if (index !== -1 && confirm(`Are you sure you want to delete "${items[index].title}"?`)) {
            items.splice(index, 1);
            localStorage.setItem(activeCategory, JSON.stringify(items));
            renderItems();
        }
    }

    // Rendering
    function renderItems() {
        contentArea.innerHTML = '';
        let items = getItems(activeCategory);

        // Filter
        const query = searchInput.value.toLowerCase();
        if (query) {
            items = items.filter(item => item.title.toLowerCase().includes(query));
        }

        // Sort
        const sortMode = sortSelect.value;
        items.sort((a, b) => {
            if (sortMode === 'date-new') {
                return new Date(b.dateAdded) - new Date(a.dateAdded);
            }
            if (sortMode === 'date-old') {
                return new Date(a.dateAdded) - new Date(b.dateAdded);
            }
            if (sortMode === 'rating-high') {
                return b.rating - a.rating;
            }
            if (sortMode === 'rating-low') {
                return a.rating - b.rating;
            }
            if (sortMode === 'title-az') {
                return a.title.localeCompare(b.title);
            }
            return 0;
        });

        if (items.length === 0) {
            contentArea.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px; display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <i class="fas fa-ghost" style="font-size: 3rem; opacity: 0.5;"></i>
                    <p>No items found.</p>
                </div>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        items.forEach((item, index) => {
            if (item.isLoading) {
                 const card = document.createElement('div');
                 card.className = 'skeleton-card skeleton';
                 card.innerHTML = `
                    <div class="skeleton-poster skeleton"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-text skeleton-title skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                        <div class="skeleton-text skeleton"></div>
                    </div>
                 `;
                 fragment.appendChild(card);
                 return;
            }

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
                    <button class="delete-btn" title="Delete Item">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="item-info">
                    <div class="item-rating"><i class="fas fa-star"></i> ${escapeHtml(item.rating)}/10</div>
                    <h3 class="item-title">${escapeHtml(item.title)}</h3>
                    <p class="item-summary">${escapeHtml(item.summary || 'No summary available.')}</p>
                    <p class="item-notes">${escapeHtml(item.notes || '')}</p>
                </div>
            `;

            // Attach delete listener directly to the button element we just created inside HTML string
            // Wait, we need to access it after appendChild. Or better, use delegation or querySelector after loop.
            // Let's use delegation on contentArea or individual attach.
            // Individual attach is cleaner here:
            fragment.appendChild(card);

            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click if we add one later
                deleteItem(item.dateAdded);
            });
        });
        contentArea.appendChild(fragment);
    }

    // API Integrations
    const metadataCache = {};

    window.fetchMetadata = async function(category, title, year = null) {
        const cacheKey = `${category}:${title.toLowerCase().trim()}:${year || ''}`;

        if (metadataCache[cacheKey]) {
            return metadataCache[cacheKey];
        }

        try {
            let result = null;
            if (category === 'movies') {
                result = await fetchMovieMetadata(title, year);
            } else if (category === 'manga') {
                result = await fetchMangaMetadata(title, year);
            } else if (category === 'games') {
                result = await fetchGameMetadata(title, year);
            } else if (category === 'books') {
                result = await fetchBookMetadata(title, year);
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

    async function fetchMovieMetadata(title, year) {
        try {
            const query = year ? `${title} ${year}` : title;
            const searchUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/search?q=${query}`)}`;
            const response = await fetch(searchUrl);
            const data = await response.json();

            if (data.ok && data.description && data.description.length > 0) {
                const result = data.description[0];
                const imdbId = result['#IMDB_ID'];
                let imageUrl = result['#IMG_POSTER'];

                // Fetch details for summary
                const detailsUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/title/${imdbId}`)}`;
                const detailsResponse = await fetch(detailsUrl);
                const html = await detailsResponse.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');

                const summaryElement = doc.querySelector('tg-spoiler') || doc.querySelector('[data-testid="plot-xl"]') || doc.querySelector('.ipc-html-content-inner-div');
                const summary = summaryElement ? summaryElement.textContent.trim() : 'Summary not available.';

                if (!imageUrl) {
                    const imgElement = doc.querySelector('.ipc-image') || doc.querySelector('img[class*="poster"]');
                    if (imgElement) imageUrl = imgElement.src;
                }

                return { summary, imageUrl };
            }
        } catch (e) {
            console.error('Movie API Error:', e);
        }
        return null;
    }

    async function fetchMangaMetadata(title, year) {
        try {
            // Jikan search is less strict with years, but we can try appending if it helps context,
            // though usually title is enough for manga. Let's keep it simple for now as Jikan doesn't support fuzzy year in query well.
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

    async function fetchGameMetadata(title, year) {
        try {
            // Wikipedia search is strict on titles. Appending year might break "God of War" -> "God of War 2018".
            // However, "God of War (2018 video game)" is a common wiki title format.
            // Let's try searching for the title, and if year is provided, maybe prefer a result with that year?
            // For simplicity with this API, we'll stick to title but if year is provided, we might try appending it if the first fails?
            // Actually, let's just use the title for now to avoid breaking existing valid lookups.
            // A better strategy for games with year is "Title (Year video game)" or similar, but it's hard to guess.
            // Let's rely on the user providing a specific title or just searching "Title".
            const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|extracts&titles=${encodeURIComponent(title)}&pithumbsize=600&exintro&explaintext&origin=*`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.query && data.query.pages) {
                const pages = data.query.pages;
                const pageId = Object.keys(pages)[0];

                if (pageId !== '-1') {
                    const page = pages[pageId];
                    return {
                        summary: page.extract,
                        imageUrl: page.thumbnail ? page.thumbnail.source : null
                    };
                }
            }
        } catch (e) {
            console.error('Game API Error:', e);
        }
        return null;
    }

    async function fetchBookMetadata(title, year) {
        try {
            // OpenLibrary supports title search nicely.
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
