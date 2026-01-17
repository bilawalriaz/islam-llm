"""
LLM-based event extractor using NVIDIA NIM API.
Extracts structured Islamic historical events from raw text.
"""

import os
import json
from typing import List, Dict, Optional
from openai import OpenAI


# NVIDIA NIM API configuration
NVIDIA_API_KEY = os.getenv("NVIDIA_NIM_API_KEY", "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")

# Model to use
MODEL = "nvidia/llama-3.3-nemotron-large-4096-instruct"

# Alternative models available:
# "meta/llama-3.1-405b-instruct"
# "mistralai/mistral-large"
# "mistralai/mixtral-8x7b-instruct-v0.1"


class IslamicEventExtractor:
    """Extract structured Islamic historical events using LLM."""

    def __init__(self, api_key: str = None):
        self.client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key or NVIDIA_API_KEY
        )

    def _create_extraction_prompt(self, raw_events: List[Dict]) -> str:
        """Create prompt for extracting structured events from raw text."""

        # Sample events to show format
        sample_events = json.dumps([
            {
                "id": "hijrah",
                "title": "Hijrah to Medina",
                "hijri_year": 1,
                "hijri_month": 1,
                "hijri_day": 1,
                "gregorian_year": 622,
                "gregorian_month": 7,
                "gregorian_day": 16,
                "category": "milestone",
                "tags": ["prophetic", "migration"],
                "description": "The migration of Prophet Muhammad and his followers from Mecca to Medina, marking the beginning of the Islamic calendar."
            }
        ], indent=2)

        # Format raw events for the prompt
        raw_text = "\n".join([
            f"- {e.get('raw_text', e.get('text', ''))}"
            for e in raw_events[:50]  # Limit to avoid token limits
        ])

        prompt = f"""You are an expert in Islamic history. Extract structured historical events from the following raw text.

For each event, provide:
- id: lowercase slug identifier
- title: concise event name
- hijri_year, hijri_month, hijri_day: Hijri date (AH calendar)
- gregorian_year, gregorian_month, gregorian_day: Gregorian date (CE/AD)
- category: milestone, battle, death, birth, conquest, caliph, treaty, or other
- tags: relevant keywords (e.g., prophetic, rashidun, abbasid, ottoman, battle)
- description: 1-2 sentence summary

IMPORTANT:
- If Hijri date is not specified, set all hijri fields to null
- If Gregorian date is not specified, set all gregorian fields to null
- Month numbers: 1-12 (1 = January/Muharram)
- Extract as many events as you can find
- Be precise with dates

Example output format:
{sample_events}

Raw events to process:
{raw_text}

Return ONLY valid JSON with an "events" array. No markdown, no explanation."""

        return prompt

    def extract_events(self, raw_events: List[Dict]) -> List[Dict]:
        """Extract structured events from raw Wikipedia text."""
        prompt = self._create_extraction_prompt(raw_events)

        print("Calling NVIDIA NIM API to extract events...")
        print(f"Processing {len(raw_events)} raw events...")

        try:
            completion = self.client.chat.completions.create(
                model=MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a precise historian specializing in Islamic calendar conversion and historical events. Always return valid JSON."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.3,
                top_p=0.9,
                max_tokens=16384,
                stream=False
            )

            response = completion.choices[0].message.content.strip()

            # Clean up response (remove markdown code blocks if present)
            if response.startswith("```"):
                response = response.split("```")[1]
                if response.startswith("json"):
                    response = response[4:]
            response = response.strip()

            # Parse JSON
            result = json.loads(response)

            if isinstance(result, dict) and "events" in result:
                events = result["events"]
            elif isinstance(result, list):
                events = result
            else:
                print(f"Unexpected response format: {type(result)}")
                return []

            print(f"Extracted {len(events)} structured events")
            return events

        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM response as JSON: {e}")
            print(f"Response preview: {response[:500]}")
            return []
        except Exception as e:
            print(f"Error calling NVIDIA NIM API: {e}")
            return []

    def extract_batch(self, raw_events: List[Dict], batch_size: int = 50) -> List[Dict]:
        """Extract events in batches to handle large datasets."""
        all_events = []

        for i in range(0, len(raw_events), batch_size):
            batch = raw_events[i:i+batch_size]
            print(f"\nProcessing batch {i//batch_size + 1}...")

            events = self.extract_events(batch)
            all_events.extend(events)

        return all_events

    def validate_and_fix_events(self, events: List[Dict]) -> List[Dict]:
        """Validate and fix extracted events."""
        valid_events = []

        for event in events:
            # Check required fields
            if not all(k in event for k in ['id', 'title', 'description']):
                print(f"Skipping event missing required fields: {event.get('title', 'Unknown')}")
                continue

            # Validate date ranges
            valid = True

            if event.get('hijri_year'):
                if not (1 <= event['hijri_year'] <= 1500):
                    print(f"Warning: Invalid Hijri year {event['hijri_year']} for {event['title']}")
                    valid = False

            if event.get('gregorian_year'):
                if not (500 <= event['gregorian_year'] <= 2100):
                    print(f"Warning: Invalid Gregorian year {event['gregorian_year']} for {event['title']}")
                    valid = False

            # Validate months
            if event.get('hijri_month') and not (1 <= event['hijri_month'] <= 12):
                print(f"Warning: Invalid Hijri month {event['hijri_month']} for {event['title']}")
                event['hijri_month'] = None

            if event.get('gregorian_month') and not (1 <= event['gregorian_month'] <= 12):
                print(f"Warning: Invalid Gregorian month {event['gregorian_month']} for {event['title']}")
                event['gregorian_month'] = None

            # Validate days
            if event.get('hijri_day') and not (1 <= event['hijri_day'] <= 30):
                print(f"Warning: Invalid Hijri day {event['hijri_day']} for {event['title']}")
                event['hijri_day'] = None

            if event.get('gregorian_day') and not (1 <= event['gregorian_day'] <= 31):
                print(f"Warning: Invalid Gregorian day {event['gregorian_day']} for {event['title']}")
                event['gregorian_day'] = None

            if valid:
                valid_events.append(event)

        return valid_events

    def deduplicate_events(self, events: List[Dict]) -> List[Dict]:
        """Remove duplicate events based on title and dates."""
        seen = set()
        unique_events = []

        for event in events:
            # Create a key based on title and dates
            key = (
                event['title'].lower(),
                event.get('hijri_year'),
                event.get('gregorian_year')
            )

            if key not in seen:
                seen.add(key)
                unique_events.append(event)
            else:
                print(f"Duplicate removed: {event['title']}")

        return unique_events


def extract_islamic_events_from_wiki(raw_events_file: str = None, raw_events: List[Dict] = None) -> List[Dict]:
    """
    Main function to extract Islamic events from Wikipedia data.

    Args:
        raw_events_file: Path to JSON file with raw Wikipedia events
        raw_events: Direct list of raw events (takes precedence)

    Returns:
        List of structured event dictionaries
    """
    # Load raw events
    if raw_events:
        pass  # Use provided events
    elif raw_events_file:
        with open(raw_events_file) as f:
            raw_events = json.load(f)
    else:
        raise ValueError("Must provide either raw_events_file or raw_events")

    print(f"Loaded {len(raw_events)} raw events")

    # Extract using LLM
    extractor = IslamicEventExtractor()
    events = extractor.extract_batch(raw_events, batch_size=50)

    print(f"\nExtracted {len(events)} events")

    # Validate and fix
    events = extractor.validate_and_fix_events(events)
    print(f"After validation: {len(events)} events")

    # Deduplicate
    events = extractor.deduplicate_events(events)
    print(f"After deduplication: {len(events)} events")

    return events


if __name__ == "__main__":
    # Test the extractor
    import sys

    if len(sys.argv) > 1:
        raw_file = sys.argv[1]
    else:
        raw_file = "raw_wiki_events.json"

    print(f"Extracting events from {raw_file}...")

    events = extract_islamic_events_from_wiki(raw_file)

    # Save to file
    output_file = "islamic_events.json"
    with open(output_file, 'w') as f:
        json.dump(events, f, indent=2)

    print(f"\nSaved {len(events)} events to {output_file}")
