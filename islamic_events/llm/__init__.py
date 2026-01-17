"""LLM-based extraction package."""

from .event_extractor import (
    IslamicEventExtractor,
    extract_islamic_events_from_wiki,
)

__all__ = [
    "IslamicEventExtractor",
    "extract_islamic_events_from_wiki",
]
