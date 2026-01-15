from playwright.sync_api import sync_playwright
import json
import os

def run():
    # Ensure directory exists
    os.makedirs("jules-scratch/verification", exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        # 1. Generate 10 dummy items
        items = []
        for i in range(10):
            items.append({
                "title": f"Test Movie {i}",
                "rating": 8,
                "notes": "Verification note",
                "summary": "This is a verification summary.",
                "imageUrl": "", # No image to test fallback
                "dateAdded": "2023-01-01"
            })

        # 2. Navigate
        page.goto("http://localhost:8000")

        # 3. Inject
        page.evaluate("(items) => localStorage.setItem('movies', JSON.stringify(items))", items)

        # 4. Reload
        page.reload()

        # 5. Wait for items
        page.wait_for_selector(".media-item")

        # 6. Screenshot
        page.screenshot(path="jules-scratch/verification/verification.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    run()
