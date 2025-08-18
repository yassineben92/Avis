import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')

        await page.goto(f'file://{file_path}')

        # Add a movie
        await page.fill('#movie-title', 'The Matrix')
        await page.fill('#movie-rating', '9')
        await page.fill('#movie-notes', 'A classic sci-fi movie.')
        await page.click('#movie-form button')

        # Wait for the movie to appear in the list
        await page.wait_for_selector('.media-item')

        # Wait for the summary to be fetched and displayed
        summary_element = page.locator('.media-item p:has-text("Summary:")')
        await expect(summary_element).not_to_contain_text('Not available', timeout=30000)


        # Take a screenshot
        await page.screenshot(path='jules-scratch/verification/verification.png')

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())
