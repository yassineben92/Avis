from playwright.sync_api import sync_playwright, expect

def verify_fix(page):
    page.goto("http://localhost:8000")
    page.click("#toggle-form-btn")

    # Wait for the form to be visible
    add_form = page.locator("#add-form")
    expect(add_form).to_be_visible()

    # Check that the title input is focused
    title_input = page.locator("#item-title")
    expect(title_input).to_be_focused()

    page.screenshot(path="jules-scratch/verification/verification.png")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    verify_fix(page)
    browser.close()
