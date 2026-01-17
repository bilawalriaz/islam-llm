# Islamic Events Database

A comprehensive database of Islamic historical events with Hijri-Gregorian date conversion and "On This Day" functionality.

## Features

- 📅 **Dual Calendar Support**: Events stored with both Hijri (AH) and Gregorian (CE) dates
- 🔍 **Flexible Queries**: Search by date, category, tag, or time period
- 🤖 **LLM-Powered Extraction**: Uses NVIDIA NIM API to extract structured events from Wikipedia
- 📊 **Statistics**: Analyze event distribution by category, time period, etc.
- 💾 **Local Data**: Everything stored locally - no external API dependencies for queries
- 🖥️ **CLI Interface**: Simple command-line tool for all operations

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Set NVIDIA API key (for LLM extraction)
export NVIDIA_NIM_API_KEY="your-key-here"
```

## Quick Start

### 1. Run the Full Pipeline

```bash
python cli.py pipeline
```

This will:
- Scrape Wikipedia for Islamic historical events
- Extract structured data using LLM
- Import into local database

### 2. Query What Happened Today

```bash
python cli.py query
```

### 3. Query Specific Date

```bash
python cli.py query --date 2024-01-15
```

### 4. Search Events

```bash
python cli.py query --search "battle"
python cli.py query --category "milestone"
python cli.py query --tag "prophetic"
```

### 5. Show Statistics

```bash
python cli.py stats
```

## Command Reference

| Command | Description | Example |
|---------|-------------|---------|
| `pipeline` | Run full pipeline (scrape → extract → import) | `python cli.py pipeline` |
| `scrape` | Scrape Wikipedia for raw data | `python cli.py scrape --output raw.json` |
| `extract` | Extract structured events with LLM | `python cli.py extract --input raw.json` |
| `import` | Import events into database | `python cli.py import --input events.json` |
| `query` | Query the database | `python cli.py query --search "battle"` |
| `stats` | Show database statistics | `python cli.py stats` |
| `export` | Export database to JSON/CSV | `python cli.py export --format csv --output data.csv` |

## Project Structure

```
islamic_events/
├── data/
│   └── events.json          # Main database
├── scraper/
│   └── wiki_scraper.py      # Wikipedia scraper
├── llm/
│   └── event_extractor.py   # LLM-based extraction
├── utils/
│   └── date_converter.py    # Hijri/Gregorian utilities
├── query.py                 # Query engine
├── cli.py                   # Main CLI tool
└── requirements.txt
```

## Data Schema

Each event has the following structure:

```json
{
  "id": "hijrah",
  "title": "Hijrah to Medina",
  "hijri": {
    "year": 1,
    "month": 1,
    "day": 1
  },
  "gregorian": {
    "year": 622,
    "month": 7,
    "day": 16
  },
  "category": "milestone",
  "tags": ["prophetic", "migration"],
  "description": "The migration marking the beginning of Islamic calendar"
}
```

## Categories

- `milestone` - Major historical milestones
- `battle` - Military battles and conflicts
- `death` - Deaths of notable figures
- `birth` - Births of notable figures
- `conquest` - Territorial conquests
- `caliph` - Events related to caliphs
- `treaty` - Treaties and agreements

## Date Conversion

The project uses `hijri-converter` for accurate bidirectional conversion:

```python
from islamic_events.utils import DualDate

# Convert Hijri to Gregorian
hijri = DualDate(2, 9, 17, 'hijri')  # 17 Ramadan 2 AH
gregorian = hijri.to_gregorian()
print(gregorian)  # 624-03-16 CE
```

## API Usage

### Python API

```python
from islamic_events.query import IslamicEventsDB
from datetime import date

# Initialize database
db = IslamicEventsDB('islamic_events/data/events.json')

# Query what happened today
events = db.on_this_day()
for event in events:
    print(f"{event['years_ago']} years ago: {event['title']}")

# Search by category
milestones = db.get_by_category('milestone')

# Search by time period
events_7th_century = db.get_by_period(600, 700, 'gregorian')
```

## Adding Events Manually

```python
from islamic_events.query import IslamicEventsDB

db = IslamicEventsDB()

event = {
    "id": "custom-event",
    "title": "Your Event Title",
    "hijri": {"year": 10, "month": 1, "day": 1},
    "gregorian": {"year": 632, "month": 3, "day": 15},
    "category": "milestone",
    "tags": ["custom"],
    "description": "Event description"
}

db.add_event(event)
db.save()
```

## NVIDIA NIM API

The LLM extraction uses NVIDIA's NIM API with the Llama 3.3 model. The API key is stored in the `NVIDIA_NIM_API_KEY` environment variable.

Alternative models available:
- `nvidia/llama-3.3-nemotron-large-4096-instruct`
- `meta/llama-3.1-405b-instruct`
- `mistralai/mistral-large`

## License

MIT
