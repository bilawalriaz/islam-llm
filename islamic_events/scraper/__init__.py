"""Wikipedia scraper package."""

from .wiki_scraper import (
    WikiScraper,
    extract_dates_from_text,
    fetch_all_wiki_data,
)

__all__ = [
    "WikiScraper",
    "extract_dates_from_text",
    "fetch_all_wiki_data",
]
