document.addEventListener('DOMContentLoaded', () => {
    // State
    let activeCategory = 'movies';

    // DOM Elements
    const tabs = document.querySelectorAll('.tab-btn');
    const contentArea = document.getElementById('content-area');
    const addForm = document.getElementById('add-form');
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const categoryLabel = document.getElementById('category-label');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Modals
    const importBtn = document.getElementById('import-btn');
    const importModal = document.getElementById('import-modal');
    const confirmImportBtn = document.getElementById('confirm-import-btn');
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

    // Modal Logic
    function openModal(modal) {
        modal.classList.remove('hidden');
    }
    function closeModal(modal) {
        modal.classList.add('hidden');
    }

    [importBtn, settingsBtn, recommendBtn].forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.currentTarget.id === 'import-btn') openModal(importModal);
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

        confirmImportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        confirmImportBtn.disabled = true;

        const lines = text.split('\n').filter(line => line.trim() !== '');
        let count = 0;

        for (const line of lines) {
            // Simple parsing: "Title : Review"
            // If ":" exists, split. If not, treat whole line as title.
            let title = line;
            let notes = '';

            if (line.includes(':')) {
                const parts = line.split(':');
                title = parts[0].trim();
                notes = parts.slice(1).join(':').trim();
            }

            // Heuristic Rating Guessing based on keywords in notes
            let rating = 5; // Default
            const lowerNotes = notes.toLowerCase();
            if (lowerNotes.includes('masterclass') || lowerNotes.includes('dinguerie') || lowerNotes.includes('total') || lowerNotes.includes('grave bon')) rating = 10;
            else if (lowerNotes.includes('super') || lowerNotes.includes('excellent') || lowerNotes.includes('grave aimé')) rating = 9;
            else if (lowerNotes.includes('très bon') || lowerNotes.includes('bien aimé')) rating = 8;
            else if (lowerNotes.includes('bon film') || lowerNotes.includes('pas mal')) rating = 7;
            else if (lowerNotes.includes('ça va') || lowerNotes.includes('moyen')) rating = 6;
            else if (lowerNotes.includes('bof') || lowerNotes.includes('ennuyant') || lowerNotes.includes('pas ouf')) rating = 4;
            else if (lowerNotes.includes('nul') || lowerNotes.includes('bullshit')) rating = 2;

            const item = {
                title,
                rating,
                notes,
                summary: '',
                imageUrl: '',
                dateAdded: new Date().toISOString()
            };

            // Fetch metadata (fire and forget to speed up import, or await?)
            // Awaiting might be too slow for large lists. Let's await with short timeout to populate images if possible.
            // Using the robust fetch function we already have.
            if (typeof fetchMetadata === 'function') {
                try {
                     const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)); // Short timeout for bulk import
                     const metadata = await Promise.race([fetchMetadata(activeCategory, title), timeoutPromise]).catch(() => null);
                     if (metadata) {
                         item.summary = metadata.summary || '';
                         item.imageUrl = metadata.imageUrl || '';
                     }
                } catch (e) { console.log('Import fetch skipped for ' + title); }
            }

            saveItem(activeCategory, item);
            count++;
        }

        renderItems();
        closeModal(importModal);
        document.getElementById('import-text').value = '';
        confirmImportBtn.innerHTML = 'Import';
        confirmImportBtn.disabled = false;
        alert(`Successfully imported ${count} items into ${activeCategory}!`);
    });

    // Settings Logic
    saveSettingsBtn.addEventListener('click', () => {
        const key = document.getElementById('api-key').value;
        if (key) {
            localStorage.setItem('google_api_key', key);
            alert('API Key saved!');
            closeModal(settingsModal);
        }
    });

    function loadApiKey() {
        const key = localStorage.getItem('google_api_key');
        if (key) {
            document.getElementById('api-key').value = key;
        }
    }

    // Recommendation Logic (Gemini)
    async function generateRecommendations() {
        const apiKey = localStorage.getItem('google_api_key');
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
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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

            // Fetch Metadata with timeout
            if (typeof fetchMetadata === 'function') {
                // Create a timeout promise that rejects after 5 seconds
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                );

                try {
                    const metadata = await Promise.race([
                        fetchMetadata(activeCategory, title),
                        timeoutPromise
                    ]);

                    if (metadata) {
                        item.summary = metadata.summary || '';
                        item.imageUrl = metadata.imageUrl || '';
                    }
                } catch (fetchError) {
                    console.warn('Metadata fetch failed (likely offline or CORS):', fetchError);
                    // Continue saving without metadata, but warn if it's a critical failure
                    if (fetchError.message !== 'Timeout') {
                        // Optional: alert user only on real errors, not just "not found"
                    }
                }
            }

            saveItem(activeCategory, item);
            renderItems();

            // Reset and Close
            addForm.reset();
            addForm.classList.add('hidden');
        } catch (error) {
            console.error('Error adding item:', error);
            alert('Failed to add item. Check console for details.');
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

    function deleteItem(index) {
        const items = getItems(activeCategory);
        if (confirm(`Are you sure you want to delete "${items[index].title}"?`)) {
            items.splice(index, 1);
            localStorage.setItem(activeCategory, JSON.stringify(items));
            renderItems();
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

        items.forEach((item, index) => {
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
                    <button class="delete-btn" data-index="${index}" title="Delete Item">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="item-info">
                    <div class="item-rating"><i class="fas fa-star"></i> ${item.rating}/10</div>
                    <h3 class="item-title">${item.title}</h3>
                    <p class="item-summary">${item.summary || 'No summary available.'}</p>
                    <p class="item-notes">${item.notes || ''}</p>
                </div>
            `;

            // Attach delete listener directly to the button element we just created inside HTML string
            // Wait, we need to access it after appendChild. Or better, use delegation or querySelector after loop.
            // Let's use delegation on contentArea or individual attach.
            // Individual attach is cleaner here:
            contentArea.appendChild(card);

            card.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent card click if we add one later
                deleteItem(index);
            });
        });
    }

    // API Integrations
    window.fetchMetadata = async function(category, title) {
        try {
            if (category === 'movies') {
                return await fetchMovieMetadata(title);
            } else if (category === 'manga') {
                return await fetchMangaMetadata(title);
            } else if (category === 'games') {
                return await fetchGameMetadata(title);
            } else if (category === 'books') {
                return await fetchBookMetadata(title);
            }
        } catch (error) {
            console.error(`Error fetching metadata for ${category}:`, error);
            return null;
        }
    };

    async function fetchMovieMetadata(title) {
        try {
            const searchUrl = `https://corsproxy.io/?${encodeURIComponent(`https://imdb.iamidiotareyoutoo.com/search?q=${title}`)}`;
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

    async function fetchGameMetadata(title) {
        try {
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
