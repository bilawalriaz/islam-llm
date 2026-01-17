"""
Wikipedia scraper for Islamic historical events.
Fetches timeline data and converts to structured format.
"""

import re
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional
from urllib.parse import urljoin
import time


WIKI_BASE = "https://en.wikipedia.org"
ISLAMIC_TIMELINE_URL = "https://en.wikipedia.org/wiki/Timeline_of_Islamic_history"


class WikiScraper:
    """Scrape Islamic history data from Wikipedia."""

    def __init__(self, delay: float = 1.0):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'IslamicEvents/1.0 (Educational/Research)'
        })

    def fetch_page(self, url: str) -> str:
        """Fetch a Wikipedia page."""
        print(f"Fetching: {url}")
        response = self.session.get(url, timeout=30)
        response.raise_for_status()
        time.sleep(self.delay)
        return response.text

    def parse_timeline(self) -> List[Dict]:
        """Parse the main Islamic timeline page."""
        html = self.fetch_page(ISLAMIC_TIMELINE_URL)
        soup = BeautifulSoup(html, 'html.parser')

        events = []

        # Find all content sections
        content = soup.find('div', {'id': 'mw-content-text'})
        if not content:
            print("Could not find content section")
            return events

        # Parse sections by century/period
        current_section = None

        for header in content.find_all(['h2', 'h3', 'h4']):
            if header.name == 'h2':
                # Main section
                span = header.find('span', class_='mw-headline')
                if span:
                    current_section = span.get_text()
                    print(f"Section: {current_section}")

            elif header.name in ['h3', 'h4']:
                # Subsection with specific time period
                span = header.find('span', class_='mw-headline')
                if span:
                    period_text = span.get_text()
                    print(f"  Period: {period_text}")

                    # Extract events from this subsection
                    subsection_events = self._extract_events_from_subsection(
                        header, period_text, current_section
                    )
                    events.extend(subsection_events)

        return events

    def _extract_events_from_subsection(
        self, header, period: str, section: str
    ) -> List[Dict]:
        """Extract events from a subsection."""
        events = []

        # Get all list items until next header
        current = header.find_next_sibling()
        items = []

        while current and current.name not in ['h2', 'h3', 'h4']:
            if current.name == 'ul':
                items.extend(current.find_all('li', recursive=False))
            elif current.name == 'p':
                # Some pages use paragraphs instead of lists
                items.append(current)
            current = current.find_next_sibling()

        for item in items:
            event_text = item.get_text(strip=True)
            if len(event_text) > 20:  # Skip very short entries
                events.append({
                    'raw_text': event_text,
                    'period': period,
                    'section': section,
                    'source': ISLAMIC_TIMELINE_URL
                })

        return events

    def get_specific_page_events(self, page_title: str) -> List[Dict]:
        """Fetch events from a specific Wikipedia page."""
        url = f"{WIKI_BASE}/wiki/{page_title}"
        html = self.fetch_page(url)
        soup = BeautifulSoup(html, 'html.parser')

        events = []

        # Look for infobox with dates
        infobox = soup.find('table', class_='infobox')
        if infobox:
            for row in infobox.find_all('tr'):
                th = row.find('th')
                td = row.find('td')
                if th and td:
                    label = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    events.append({
                        'raw_text': f"{label}: {value}",
                        'period': page_title,
                        'section': 'specific_event',
                        'source': url
                    })

        # Extract first paragraph for context
        first_para = soup.find('p')
        if first_para:
            text = first_para.get_text(strip=True)
            if len(text) > 50:
                events.append({
                    'raw_text': text,
                    'period': page_title,
                    'section': 'description',
                    'source': url
                })

        return events

    def fetch_prophetic_timeline(self) -> List[Dict]:
        """Fetch timeline of Muhammad's life."""
        url = "https://en.wikipedia.org/wiki/Timeline_of_Muhammad%27s_life"
        return self.get_specific_page_events(url.split('/')[-1])

    def fetch_rashidun_timeline(self) -> List[Dict]:
        """Fetch Rashidun Caliphate timeline."""
        url = "https://en.wikipedia.org/wiki/Rashidun_Caliphate"
        html = self.fetch_page(url)
        soup = BeautifulSoup(html, 'html.parser')

        events = []
        content = soup.find('div', {'id': 'mw-content-text'})

        # Extract timeline from the page
        for list_item in content.find_all('li'):
            text = list_item.get_text(strip=True)
            # Look for date patterns
            if re.search(r'\d+\s*(AH|CE|BCE|AD)', text):
                events.append({
                    'raw_text': text,
                    'period': 'Rashidun',
                    'section': 'caliphate',
                    'source': url
                })

        return events

    def fetch_ummayad_timeline(self) -> List[Dict]:
        """Fetch Umayyad Caliphate timeline."""
        url = "https://en.wikipedia.org/wiki/Umayyad_Caliphate"
        html = self.fetch_page(url)
        soup = BeautifulSoup(html, 'html.parser')

        events = []
        content = soup.find('div', {'id': 'mw-content-text'})

        for list_item in content.find_all('li'):
            text = list_item.get_text(strip=True)
            if re.search(r'\d+\s*(AH|CE|BCE|AD)', text):
                events.append({
                    'raw_text': text,
                    'period': 'Umayyad',
                    'section': 'caliphate',
                    'source': url
                })

        return events

    def fetch_abbasid_timeline(self) -> List[Dict]:
        """Fetch Abbasid Caliphate timeline."""
        url = "https://en.wikipedia.org/wiki/Abbasid_Caliphate"
        html = self.fetch_page(url)
        soup = BeautifulSoup(html, 'html.parser')

        events = []
        content = soup.find('div', {'id': 'mw-content-text'})

        for list_item in content.find_all('li'):
            text = list_item.get_text(strip=True)
            if re.search(r'\d+\s*(AH|CE|BCE|AD)', text):
                events.append({
                    'raw_text': text,
                    'period': 'Abbasid',
                    'section': 'caliphate',
                    'source': url
                })

        return events

    def fetch_ottoman_timeline(self) -> List[Dict]:
        """Fetch Ottoman Empire timeline."""
        url = "https://en.wikipedia.org/wiki/Ottoman_Empire"
        html = self.fetch_page(url)
        soup = BeautifulSoup(html, 'html.parser')

        events = []
        content = soup.find('div', {'id': 'mw-content-text'})

        for list_item in content.find_all('li'):
            text = list_item.get_text(strip=True)
            if re.search(r'\d+\s*(AH|CE|BCE|AD)', text):
                events.append({
                    'raw_text': text,
                    'period': 'Ottoman',
                    'section': 'empire',
                    'source': url
                })

        return events


def extract_dates_from_text(text: str) -> Dict[str, any]:
    """
    Extract potential dates from text using regex.
    Returns dict with various date formats found.
    """
    dates = {
        'hijri': [],
        'gregorian': [],
        'years': [],
        'raw_hijri': None,
        'raw_gregorian': None
    }

    # Hijri date patterns: "2 AH", "2 AH / 624 CE", "17 Ramadan 2 AH"
    hijri_patterns = [
        r'(\d+)\s+AH',
        r'(\d+)\s+(Muharram|Safar|Rabi\s+\w+|Jumada\s+\w+|Rajab|Sha' + "'" + r'ban|Ramadan|Shawwal|Dhu\s+\w+)\s+(\d+)\s+AH',
        r'(Muharram|Safar|Rabi\s+\w+|Jumada\s+\w+|Rajab|Sha' + "'" + r'ban|Ramadan|Shawwal|Dhu\s+\w+)\s+(\d+),?\s+(\d+)\s+AH',
    ]

    for pattern in hijri_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dates['hijri'].extend(matches)

    # Gregorian patterns: "624 CE", "624 AD", "March 16, 624"
    greg_patterns = [
        r'(\d+)\s+(CE|AD|BCE)',
        r'(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d+),?\s+(\d+)\s*(CE|AD|BCE)?',
    ]

    for pattern in greg_patterns:
        matches = re.findall(pattern, text, re.IGNORECASE)
        dates['gregorian'].extend(matches)

    # Standalone years
    years = re.findall(r'\b(\d{3,4})\b', text)
    dates['years'] = [int(y) for y in years if 500 < int(y) < 2100]

    return dates


def fetch_all_wiki_data() -> List[Dict]:
    """Fetch all relevant Wikipedia data for Islamic history."""
    scraper = WikiScraper(delay=1.5)
    all_events = []

    print("Fetching Islamic timeline...")
    all_events.extend(scraper.parse_timeline())

    print("\nFetching prophetic timeline...")
    try:
        all_events.extend(scraper.fetch_prophetic_timeline())
    except Exception as e:
        print(f"Error fetching prophetic timeline: {e}")

    print("\nFetching Rashidun timeline...")
    try:
        all_events.extend(scraper.fetch_rashidun_timeline())
    except Exception as e:
        print(f"Error fetching Rashidun timeline: {e}")

    print("\nFetching Umayyad timeline...")
    try:
        all_events.extend(scraper.fetch_ummayad_timeline())
    except Exception as e:
        print(f"Error fetching Umayyad timeline: {e}")

    print("\nFetching Abbasid timeline...")
    try:
        all_events.extend(scraper.fetch_abbasid_timeline())
    except Exception as e:
        print(f"Error fetching Abbasid timeline: {e}")

    print("\nFetching Ottoman timeline...")
    try:
        all_events.extend(scraper.fetch_ottoman_timeline())
    except Exception as e:
        print(f"Error fetching Ottoman timeline: {e}")

    print(f"\nTotal raw events fetched: {len(all_events)}")
    return all_events


if __name__ == "__main__":
    # Test the scraper
    events = fetch_all_wiki_data()

    # Save raw data for LLM processing
    import json
    with open('raw_wiki_events.json', 'w') as f:
        json.dump(events, f, indent=2)

    print(f"\nSaved {len(events)} raw events to raw_wiki_events.json")
