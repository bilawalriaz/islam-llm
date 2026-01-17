"""
Query engine for Islamic historical events.
Supports "on this day" lookups and flexible queries.
"""

import json
from datetime import date, datetime
from typing import List, Dict, Optional, Callable
from pathlib import Path


class IslamicEventsDB:
    """Query engine for Islamic historical events database."""

    def __init__(self, db_path: str = None):
        """
        Initialize the database.

        Args:
            db_path: Path to events.json file. Defaults to data/events.json
        """
        if db_path is None:
            db_path = Path(__file__).parent / "data" / "events.json"

        self.db_path = Path(db_path)
        self.events = []
        self._load()

    def _load(self):
        """Load events from database file."""
        if not self.db_path.exists():
            print(f"Warning: Database file not found at {self.db_path}")
            self.events = []
            return

        with open(self.db_path) as f:
            data = json.load(f)
            self.events = data.get('events', [])

        print(f"Loaded {len(self.events)} events from {self.db_path}")

    def save(self):
        """Save events to database file."""
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            'events': self.events,
            'metadata': {
                'version': '1.0.0',
                'last_updated': datetime.now().isoformat(),
                'total_events': len(self.events)
            }
        }

        with open(self.db_path, 'w') as f:
            json.dump(data, f, indent=2)

        print(f"Saved {len(self.events)} events to {self.db_path}")

    def add_event(self, event: Dict):
        """Add a single event to the database."""
        # Validate required fields
        required = ['id', 'title', 'description']
        if not all(k in event for k in required):
            raise ValueError(f"Event missing required fields: {required}")

        # Check for duplicates
        for existing in self.events:
            if existing['id'] == event['id']:
                print(f"Warning: Event with id '{event['id']}' already exists. Updating.")
                self.events.remove(existing)
                break

        self.events.append(event)

    def add_events(self, events: List[Dict]):
        """Add multiple events to the database."""
        for event in events:
            self.add_event(event)

    def on_this_day(self, gregorian_date: date = None) -> List[Dict]:
        """
        Get events that occurred on this day (month/day) in history.

        Args:
            gregorian_date: Date to check. Defaults to today.

        Returns:
            List of events with additional 'years_ago' and 'display' fields.
        """
        if gregorian_date is None:
            gregorian_date = date.today()

        month, day = gregorian_date.month, gregorian_date.day
        matches = []

        for event in self.events:
            g = event.get('gregorian')
            if not g:
                continue

            # Check if month and day match
            if g.get('month') == month and g.get('day') == day:
                years_ago = gregorian_date.year - g['year']
                matches.append({
                    **event,
                    'years_ago': years_ago,
                    'display': self._format_display(event, years_ago)
                })

        # Sort by years ago (most recent first)
        matches.sort(key=lambda x: x['years_ago'])
        return matches

    def on_this_hijri_day(self, hijri_year: int, hijri_month: int, hijri_day: int) -> List[Dict]:
        """
        Get events that occurred on a specific Hijri date.

        Args:
            hijri_year: Hijri year
            hijri_month: Hijri month (1-12)
            hijri_day: Hijri day

        Returns:
            List of events matching the Hijri date
        """
        matches = []

        for event in self.events:
            h = event.get('hijri')
            if not h:
                continue

            if (h.get('year') == hijri_year and
                h.get('month') == hijri_month and
                h.get('day') == hijri_day):
                matches.append(event)

        return matches

    def get_by_category(self, category: str) -> List[Dict]:
        """Get all events in a specific category."""
        return [e for e in self.events if e.get('category') == category]

    def get_by_tag(self, tag: str) -> List[Dict]:
        """Get all events with a specific tag."""
        return [e for e in self.events if tag in e.get('tags', [])]

    def get_by_period(self, period_start: int, period_end: int, calendar: str = 'gregorian') -> List[Dict]:
        """
        Get events within a time period.

        Args:
            period_start: Start year
            period_end: End year
            calendar: 'gregorian' or 'hijri'
        """
        matches = []

        for event in self.events:
            date_key = 'gregorian' if calendar == 'gregorian' else 'hijri'
            date_data = event.get(date_key)

            if not date_data or not date_data.get('year'):
                continue

            year = date_data['year']
            if period_start <= year <= period_end:
                matches.append(event)

        # Sort by year
        matches.sort(key=lambda x: x[date_key]['year'])
        return matches

    def search(self, query: str, fields: List[str] = None) -> List[Dict]:
        """
        Search events by text query.

        Args:
            query: Search string
            fields: List of fields to search. Defaults to ['title', 'description', 'tags']
        """
        if fields is None:
            fields = ['title', 'description', 'tags']

        query_lower = query.lower()
        matches = []

        for event in self.events:
            for field in fields:
                value = event.get(field, '')

                # Handle list fields (tags)
                if isinstance(value, list):
                    value = ' '.join(str(v) for v in value)

                if query_lower in str(value).lower():
                    matches.append(event)
                    break

        return matches

    def get_event(self, event_id: str) -> Optional[Dict]:
        """Get a specific event by ID."""
        for event in self.events:
            if event['id'] == event_id:
                return event
        return None

    def get_all_events(self) -> List[Dict]:
        """Get all events in the database."""
        return self.events.copy()

    def get_categories(self) -> List[str]:
        """Get all unique categories in the database."""
        categories = set(e.get('category') for e in self.events if e.get('category'))
        return sorted(list(categories))

    def get_tags(self) -> List[str]:
        """Get all unique tags in the database."""
        tags = set()
        for event in self.events:
            tags.update(event.get('tags', []))
        return sorted(list(tags))

    def get_statistics(self) -> Dict:
        """Get statistics about the database."""
        categories = {}
        for event in self.events:
            cat = event.get('category', 'unknown')
            categories[cat] = categories.get(cat, 0) + 1

        # Year range
        gregorian_years = [e['gregorian']['year'] for e in self.events
                          if e.get('gregorian', {}).get('year')]
        hijri_years = [e['hijri']['year'] for e in self.events
                      if e.get('hijri', {}).get('year')]

        stats = {
            'total_events': len(self.events),
            'categories': categories,
            'gregorian_range': {
                'earliest': min(gregorian_years) if gregorian_years else None,
                'latest': max(gregorian_years) if gregorian_years else None
            },
            'hijri_range': {
                'earliest': min(hijri_years) if hijri_years else None,
                'latest': max(hijri_years) if hijri_years else None
            },
            'unique_tags': len(self.get_tags())
        }

        return stats

    def _format_display(self, event: Dict, years_ago: int) -> str:
        """Format display text for an event."""
        if years_ago == 0:
            return "Today"
        elif years_ago == 1:
            return "1 year ago today"
        else:
            return f"{years_ago} years ago today"


def print_on_this_day(db: IslamicEventsDB, target_date: date = None):
    """Print 'on this day' events in a formatted way."""
    if target_date is None:
        target_date = date.today()

    events = db.on_this_day(target_date)

    print(f"\n{'='*60}")
    print(f"On this day in Islamic History: {target_date.strftime('%B %d')}")
    print(f"{'='*60}\n")

    if not events:
        print("No major events recorded for this day.")
        return

    for event in events:
        print(f"📅 {event['display']}")
        print(f"   {event['title']}")

        if event.get('hijri'):
            h = event['hijri']
            print(f"   Hijri: {h['year']}-{h['month']:02d}-{h['day']:02d} AH")

        print(f"   {event['description']}")

        if event.get('tags'):
            print(f"   Tags: {', '.join(event['tags'])}")

        print()


if __name__ == "__main__":
    # Test the query engine
    import argparse

    parser = argparse.ArgumentParser(description='Query Islamic events database')
    parser.add_argument('--db', default='data/events.json', help='Path to database')
    parser.add_argument('--date', help='Date in YYYY-MM-DD format (default: today)')
    parser.add_argument('--stats', action='store_true', help='Show database statistics')
    parser.add_argument('--search', help='Search query')

    args = parser.parse_args()

    db = IslamicEventsDB(args.db)

    if args.stats:
        stats = db.get_statistics()
        print("\n📊 Database Statistics")
        print("="*40)
        print(f"Total events: {stats['total_events']}")
        print(f"Unique tags: {stats['unique_tags']}")
        print(f"\nCategories:")
        for cat, count in stats['categories'].items():
            print(f"  {cat}: {count}")
        print(f"\nGregorian range: {stats['gregorian_range']['earliest']} - {stats['gregorian_range']['latest']}")
        print(f"Hijri range: {stats['hijri_range']['earliest']} - {stats['hijri_range']['latest']}")

    elif args.search:
        results = db.search(args.search)
        print(f"\n🔍 Search results for '{args.search}': {len(results)} found\n")
        for event in results:
            print(f"- {event['title']}")
            if event.get('gregorian'):
                g = event['gregorian']
                print(f"  Date: {g['year']}-{g['month']:02d}-{g['day']:02d} CE")
            print(f"  {event['description'][:100]}...")
            print()

    elif args.date:
        target_date = datetime.strptime(args.date, '%Y-%m-%d').date()
        print_on_this_day(db, target_date)

    else:
        print_on_this_day(db)
