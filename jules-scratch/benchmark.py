from playwright.sync_api import sync_playwright
import json
import time

def run():
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch()
        page = browser.new_page()

        # 1. Generate dummy data
        print("Generating 5000 dummy items...")
        items = []
        for i in range(5000):
            items.append({
                "title": f"Movie {i}",
                "rating": 5,
                "notes": "Test note",
                "summary": "Test summary",
                "imageUrl": "",
                "dateAdded": "2023-01-01"
            })

        # 2. Navigate to app
        print("Navigating to app...")
        page.goto("http://localhost:8000")

        # 3. Inject data into localStorage
        print("Injecting data...")
        page.evaluate("(items) => localStorage.setItem('movies', JSON.stringify(items))", items)

        # 4. Reload to ensure clean state
        page.reload()

        # 5. Switch to Manga (empty) first
        page.click('[data-tab="manga"]')

        # 6. Measure time to switch back to Movies
        print("Measuring render time...")
        script = """
        () => {
            const start = performance.now();
            document.querySelector('[data-tab="movies"]').click();
            // Force layout to ensure rendering is triggered/calculated
            document.body.offsetHeight;
            const end = performance.now();
            return end - start;
        }
        """

        # Warmup (optional, but good)
        # page.evaluate(script)
        # Actually warmup might skew if we are just testing the DOM insertion cost which shouldn't be JITted as much as JS.

        duration = page.evaluate(script)

        print(f"Render time for 5000 items: {duration:.2f} ms")

        browser.close()

if __name__ == "__main__":
    run()
