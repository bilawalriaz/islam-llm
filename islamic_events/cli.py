"""
CLI tool for managing Islamic events database.
Main entry point for all operations.
"""

import argparse
import sys
import json
from pathlib import Path
from datetime import date

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from islamic_events.query import IslamicEventsDB, print_on_this_day
from islamic_events.scraper import fetch_all_wiki_data
from islamic_events.llm import extract_islamic_events_from_wiki
from islamic_events.utils import validate_dual_date


def cmd_scrape(args):
    """Scrape Wikipedia for Islamic events."""
    print("Scraping Wikipedia for Islamic historical events...")
    print("This may take a while as we fetch multiple pages.\n")

    raw_events = fetch_all_wiki_data()

    output_file = args.output or "raw_wiki_events.json"
    with open(output_file, 'w') as f:
        json.dump(raw_events, f, indent=2)

    print(f"\n✓ Saved {len(raw_events)} raw events to {output_file}")
    print("\nNext step: Run 'python cli.py extract --input " + output_file + "'")


def cmd_extract(args):
    """Extract structured events from raw data using LLM."""
    input_file = args.input

    if not Path(input_file).exists():
        print(f"Error: Input file not found: {input_file}")
        print("Run 'python cli.py scrape' first to fetch data from Wikipedia.")
        return 1

    print(f"Extracting structured events from {input_file}...")
    print("Using NVIDIA NIM API (this may take a few minutes)...\n")

    events = extract_islamic_events_from_wiki(raw_events_file=input_file)

    output_file = args.output or "extracted_events.json"
    with open(output_file, 'w') as f:
        json.dump(events, f, indent=2)

    print(f"\n✓ Saved {len(events)} extracted events to {output_file}")
    print("\nNext step: Run 'python cli.py import --input " + output_file + "'")
    return 0


def cmd_import(args):
    """Import events into the database."""
    input_file = args.input

    if not Path(input_file).exists():
        print(f"Error: Input file not found: {input_file}")
        return 1

    with open(input_file) as f:
        events = json.load(f)

    db = IslamicEventsDB(args.db)

    print(f"Importing {len(events)} events into database...")

    count = 0
    for event in events:
        try:
            # Validate dates if both are present
            if event.get('hijri') and event.get('gregorian'):
                if validate_dual_date(event['hijri'], event['gregorian']):
                    db.add_event(event)
                    count += 1
                else:
                    print(f"Warning: Skipping event with invalid dates: {event['title']}")
            else:
                db.add_event(event)
                count += 1
        except Exception as e:
            print(f"Error importing event '{event.get('title', 'Unknown')}': {e}")

    db.save()
    print(f"\n✓ Imported {count} events into {args.db}")
    return 0


def cmd_query(args):
    """Query the database."""
    db = IslamicEventsDB(args.db)

    if args.date:
        target_date = date.fromisoformat(args.date)
        print_on_this_day(db, target_date)
    elif args.category:
        events = db.get_by_category(args.category)
        print(f"\n📁 Events in category '{args.category}': {len(events)}\n")
        for event in events:
            print(f"- {event['title']}")
            if event.get('gregorian'):
                g = event['gregorian']
                print(f"  {g['year']}-{g['month']:02d}-{g['day']:02d} CE")
            print()
    elif args.tag:
        events = db.get_by_tag(args.tag)
        print(f"\n🏷️  Events with tag '{args.tag}': {len(events)}\n")
        for event in events:
            print(f"- {event['title']}")
            print()
    elif args.search:
        events = db.search(args.search)
        print(f"\n🔍 Search results for '{args.search}': {len(events)}\n")
        for event in events:
            print(f"- {event['title']}")
            if event.get('gregorian'):
                g = event['gregorian']
                print(f"  {g['year']}-{g['month']:02d}-{g['day']:02d} CE")
            print(f"  {event['description'][:100]}...")
            print()
    elif args.period:
        # Parse period (e.g., "600-700" or "600-700:hijri")
        parts = args.period.split(':')
        year_range = parts[0].split('-')
        calendar = parts[1] if len(parts) > 1 else 'gregorian'

        if len(year_range) != 2:
            print("Error: Invalid period format. Use 'START-END' or 'START-END:calendar'")
            return 1

        start, end = int(year_range[0]), int(year_range[1])
        events = db.get_by_period(start, end, calendar)

        print(f"\n📅 Events {calendar.title()} {start}-{end}: {len(events)}\n")
        for event in events:
            print(f"- {event['title']}")
            date_key = 'gregorian' if calendar == 'gregorian' else 'hijri'
            if event.get(date_key):
                d = event[date_key]
                print(f"  {d['year']}-{d['month']:02d}-{d['day']:02d}")
            print()
    else:
        # Default: show today's events
        print_on_this_day(db)

    return 0


def cmd_stats(args):
    """Show database statistics."""
    db = IslamicEventsDB(args.db)
    stats = db.get_statistics()

    print("\n📊 Islamic Events Database Statistics")
    print("="*50)
    print(f"Total events: {stats['total_events']}")
    print(f"Unique tags: {stats['unique_tags']}")
    print(f"\n📁 Categories:")
    for cat, count in stats['categories'].items():
        print(f"   {cat}: {count}")

    print(f"\n📅 Gregorian range:")
    if stats['gregorian_range']['earliest']:
        print(f"   {stats['gregorian_range']['earliest']} - {stats['gregorian_range']['latest']} CE")

    print(f"\n🌙 Hijri range:")
    if stats['hijri_range']['earliest']:
        print(f"   {stats['hijri_range']['earliest']} - {stats['hijri_range']['latest']} AH")

    print(f"\n🏷️  All tags:")
    tags = db.get_tags()
    print(f"   {', '.join(tags)}")

    print()
    return 0


def cmd_export(args):
    """Export database to various formats."""
    db = IslamicEventsDB(args.db)

    if args.format == 'json':
        with open(args.output, 'w') as f:
            json.dump(db.get_all_events(), f, indent=2)
        print(f"✓ Exported {len(db.events)} events to {args.output}")

    elif args.format == 'csv':
        import csv
        with open(args.output, 'w', newline='') as f:
            if not db.events:
                print("No events to export")
                return 1

            writer = csv.DictWriter(f, fieldnames=[
                'id', 'title', 'category',
                'hijri_year', 'hijri_month', 'hijri_day',
                'gregorian_year', 'gregorian_month', 'gregorian_day',
                'tags', 'description'
            ])
            writer.writeheader()

            for event in db.events:
                row = {
                    'id': event.get('id'),
                    'title': event.get('title'),
                    'category': event.get('category'),
                    'tags': ', '.join(event.get('tags', [])),
                    'description': event.get('description', '')[:200],
                }
                if event.get('hijri'):
                    row.update({
                        'hijri_year': event['hijri'].get('year'),
                        'hijri_month': event['hijri'].get('month'),
                        'hijri_day': event['hijri'].get('day'),
                    })
                if event.get('gregorian'):
                    row.update({
                        'gregorian_year': event['gregorian'].get('year'),
                        'gregorian_month': event['gregorian'].get('month'),
                        'gregorian_day': event['gregorian'].get('day'),
                    })
                writer.writerow(row)

        print(f"✓ Exported {len(db.events)} events to {args.output}")

    else:
        print(f"Unknown format: {args.format}")
        return 1

    return 0


def cmd_pipeline(args):
    """Run the full pipeline: scrape -> extract -> import."""
    print("Running full pipeline...\n")

    # Step 1: Scrape
    print("Step 1: Scraping Wikipedia...")
    raw_events = fetch_all_wiki_data()
    raw_file = "raw_wiki_events.json"
    with open(raw_file, 'w') as f:
        json.dump(raw_events, f, indent=2)
    print(f"✓ Saved {len(raw_events)} raw events\n")

    # Step 2: Extract
    print("Step 2: Extracting structured events with LLM...")
    extracted_events = extract_islamic_events_from_wiki(raw_events_file=raw_file)
    extracted_file = "extracted_events.json"
    with open(extracted_file, 'w') as f:
        json.dump(extracted_events, f, indent=2)
    print(f"✓ Saved {len(extracted_events)} extracted events\n")

    # Step 3: Import
    print("Step 3: Importing into database...")
    db = IslamicEventsDB(args.db)
    count = 0
    for event in extracted_events:
        try:
            if event.get('hijri') and event.get('gregorian'):
                if validate_dual_date(event['hijri'], event['gregorian']):
                    db.add_event(event)
                    count += 1
            else:
                db.add_event(event)
                count += 1
        except Exception as e:
            print(f"Warning: Skipping event '{event.get('title')}': {e}")

    db.save()
    print(f"✓ Imported {count} events to {args.db}\n")

    # Show stats
    stats = db.get_statistics()
    print("\n" + "="*50)
    print("Pipeline Complete!")
    print("="*50)
    print(f"Total events in database: {stats['total_events']}")
    print(f"Categories: {', '.join(stats['categories'].keys())}")
    print(f"\nTry: python cli.py query")
    print()

    return 0


def main():
    parser = argparse.ArgumentParser(
        description='Islamic Events Database - Manage and query Islamic historical events',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run full pipeline (scrape, extract, import)
  python cli.py pipeline

  # Query what happened today
  python cli.py query

  # Query specific date
  python cli.py query --date 2024-01-15

  # Search for events
  python cli.py query --search "battle"

  # Show statistics
  python cli.py stats

  # Export to CSV
  python cli.py export --format csv --output events.csv
        """
    )

    parser.add_argument('--db', default='islamic_events/data/events.json',
                       help='Path to events database')

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # Scrape command
    scrape_parser = subparsers.add_parser('scrape', help='Scrape Wikipedia for Islamic events')
    scrape_parser.add_argument('--output', default='raw_wiki_events.json',
                              help='Output file for raw events')
    scrape_parser.set_defaults(func=cmd_scrape)

    # Extract command
    extract_parser = subparsers.add_parser('extract', help='Extract structured events with LLM')
    extract_parser.add_argument('--input', default='raw_wiki_events.json',
                               help='Input file with raw events')
    extract_parser.add_argument('--output', default='extracted_events.json',
                               help='Output file for extracted events')
    extract_parser.set_defaults(func=cmd_extract)

    # Import command
    import_parser = subparsers.add_parser('import', help='Import events into database')
    import_parser.add_argument('--input', required=True,
                              help='Input file with events to import')
    import_parser.set_defaults(func=cmd_import)

    # Query command
    query_parser = subparsers.add_parser('query', help='Query the database')
    query_parser.add_argument('--date', help='Query specific date (YYYY-MM-DD)')
    query_parser.add_argument('--category', help='Filter by category')
    query_parser.add_argument('--tag', help='Filter by tag')
    query_parser.add_argument('--search', help='Search text')
    query_parser.add_argument('--period', help='Time period (START-END[:calendar])')
    query_parser.set_defaults(func=cmd_query)

    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show database statistics')
    stats_parser.set_defaults(func=cmd_stats)

    # Export command
    export_parser = subparsers.add_parser('export', help='Export database')
    export_parser.add_argument('--format', choices=['json', 'csv'], default='json',
                              help='Export format')
    export_parser.add_argument('--output', required=True, help='Output file')
    export_parser.set_defaults(func=cmd_export)

    # Pipeline command
    pipeline_parser = subparsers.add_parser('pipeline', help='Run full pipeline')
    pipeline_parser.set_defaults(func=cmd_pipeline)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main() or 0)
