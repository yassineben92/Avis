import pytest
import re
from playwright.sync_api import Page, expect

URL = "http://localhost:8000"

def test_add_item(page: Page):
    page.goto(URL)

    # Open Form
    page.click("#toggle-form-btn")

    # Fill Form
    page.fill("#item-title", "Test Movie")
    page.fill("#item-rating", "9")
    page.fill("#item-notes", "Great movie")

    # Submit
    page.click("button[type='submit']")

    # Expect Toast
    expect(page.locator(".toast.info")).to_contain_text("Item added")

    # Expect Item in List
    expect(page.get_by_role("heading", name="Test Movie")).to_be_visible(timeout=15000)

    # Verify Rating
    expect(page.locator(".media-item").filter(has_text="Test Movie").locator(".item-rating")).to_contain_text("9/10")

def test_delete_item(page: Page):
    page.goto(URL)

    # Add item to delete
    page.click("#toggle-form-btn")
    # Wait for form to be visible if it was hidden
    page.wait_for_selector("#add-form", state="visible")

    page.fill("#item-title", "Delete Me")
    page.fill("#item-rating", "1")
    page.click("button[type='submit']")

    expect(page.get_by_text("Delete Me")).to_be_visible(timeout=15000)

    # Handle Confirm Dialog
    page.on("dialog", lambda dialog: dialog.accept())

    # Click Delete
    card = page.locator(".media-item").filter(has_text="Delete Me")
    card.locator(".delete-btn").click()

    # Expect it to be gone
    expect(page.get_by_role("heading", name="Delete Me")).not_to_be_visible()

def test_tabs_switching(page: Page):
    page.goto(URL)

    # Click Manga
    page.click("button[data-tab='manga']")

    # Check Active Class
    expect(page.locator("button[data-tab='manga']")).to_have_class(re.compile(r"active"))

    # Check Label
    expect(page.locator("#category-label")).to_have_text("Manga")

    # Add Item to Manga
    page.click("#toggle-form-btn")
    # Wait for form
    page.wait_for_selector("#add-form", state="visible")

    page.fill("#item-title", "Naruto")
    page.fill("#item-rating", "8")
    page.click("button[type='submit']")

    expect(page.get_by_role("heading", name="Naruto")).to_be_visible(timeout=15000)

    # Switch back to Movies
    page.click("button[data-tab='movies']")
    expect(page.get_by_role("heading", name="Naruto")).not_to_be_visible()

def test_stats_modal(page: Page):
    page.goto(URL)
    page.click("#stats-btn")
    expect(page.locator("#stats-modal")).to_be_visible()
