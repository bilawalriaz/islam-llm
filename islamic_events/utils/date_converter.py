"""
Islamic-Gregorian date conversion utilities.
Custom implementation for historical dates (7th century onwards).
"""

from dataclasses import dataclass
from typing import Optional, Tuple
from datetime import date, datetime, timedelta

# Islamic calendar epoch: July 16, 622 CE (1 Muharram 1 AH)
ISLAMIC_EPOCH = datetime(622, 7, 16)

# Average length of Hijri year (lunar year is ~354.37 days)
HIJRI_YEAR_DAYS = 354.367
HIJRI_MONTH_DAYS = 29.5306  # Average lunar month

# Month lengths in Hijri calendar (alternating 29/30 days)
# This is an approximation - actual months vary by lunar sighting
HIJRI_MONTH_LENGTHS = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29]  # Muharram to Dhu al-Hijjah


def _approximate_hijri_to_gregorian(year: int, month: int, day: int) -> date:
    """
    Approximate conversion from Hijri to Gregorian.
    Note: This is an approximation due to historical variations in lunar sighting.
    """
    # Calculate days from Islamic epoch
    days_from_epoch = (year - 1) * HIJRI_YEAR_DAYS

    # Add days for preceding months
    for m in range(month - 1):
        days_from_epoch += HIJRI_MONTH_LENGTHS[m]

    # Add days in current month
    days_from_epoch += (day - 1)

    # Convert to Gregorian date
    gregorian_date = ISLAMIC_EPOCH + timedelta(days=days_from_epoch)

    return gregorian_date.date()


def _approximate_gregorian_to_hijri(year: int, month: int, day: int) -> Tuple[int, int, int]:
    """
    Approximate conversion from Gregorian to Hijri.
    Returns (hijri_year, hijri_month, hijri_day)
    """
    gregorian_date = date(year, month, day)

    # Calculate days from Islamic epoch
    delta = gregorian_date - ISLAMIC_EPOCH.date()
    days_from_epoch = delta.days

    # Calculate Hijri year
    hijri_year = 1
    remaining_days = days_from_epoch

    while remaining_days >= HIJRI_YEAR_DAYS:
        remaining_days -= HIJRI_YEAR_DAYS
        hijri_year += 1

    # Calculate Hijri month
    hijri_month = 1
    for month_len in HIJRI_MONTH_LENGTHS:
        if remaining_days < month_len:
            break
        remaining_days -= month_len
        hijri_month += 1

    hijri_day = int(remaining_days) + 1

    return (hijri_year, hijri_month, hijri_day)


@dataclass
class DualDate:
    """Represents a date that can be expressed in both Hijri and Gregorian calendars."""
    year: int
    month: int
    day: int
    calendar: str  # 'hijri' or 'gregorian'

    def to_gregorian(self) -> 'DualDate':
        """Convert to Gregorian date."""
        if self.calendar == 'gregorian':
            return self
        try:
            greg_date = _approximate_hijri_to_gregorian(self.year, self.month, self.day)
            return DualDate(greg_date.year, greg_date.month, greg_date.day, 'gregorian')
        except ValueError as e:
            raise ValueError(f"Invalid Hijri date: {self.year}-{self.month:02d}-{self.day:02d}") from e

    def to_hijri(self) -> 'DualDate':
        """Convert to Hijri date."""
        if self.calendar == 'hijri':
            return self
        try:
            hy, hm, hd = _approximate_gregorian_to_hijri(self.year, self.month, self.day)
            return DualDate(hy, hm, hd, 'hijri')
        except ValueError as e:
            raise ValueError(f"Invalid Gregorian date: {self.year}-{self.month:02d}-{self.day:02d}") from e

    def __str__(self) -> str:
        cal = "AH" if self.calendar == 'hijri' else "CE"
        return f"{self.year:04d}-{self.month:02d}-{self.day:02d} {cal}"

    def to_dict(self) -> dict:
        """Convert to dictionary format for JSON storage."""
        return {
            "year": self.year,
            "month": self.month,
            "day": self.day
        }


def validate_dual_date(hijri_date: dict, gregorian_date: dict, tolerance_days: int = 2) -> bool:
    """
    Validate that Hijri and Gregorian dates correspond to the same day.

    Args:
        hijri_date: Dict with 'year', 'month', 'day' keys (Hijri)
        gregorian_date: Dict with 'year', 'month', 'day' keys (Gregorian)
        tolerance_days: Allowable difference in days (historical observations varied)

    Returns:
        True if dates match (within tolerance), False otherwise
    """
    try:
        h = DualDate(**hijri_date, calendar='hijri')
        h_converted = h.to_gregorian()

        # Check if converted date matches provided Gregorian date
        g = DualDate(**gregorian_date, calendar='gregorian')

        # Calculate absolute difference in days
        date1 = date(h_converted.year, h_converted.month, h_converted.day)
        date2 = date(g.year, g.month, g.day)

        diff_days = abs((date2 - date1).days)

        if diff_days == 0:
            return True
        elif diff_days <= tolerance_days:
            print(f"⚠️  Dates differ by {diff_days} day(s) - within tolerance")
            return True
        else:
            print(f"⚠️  Dates differ by {diff_days} days - exceeds tolerance")
            print(f"   Hijri {hijri_date['year']}-{hijri_date['month']:02d}-{hijri_date['day']:02d}")
            print(f"   Converted: {h_converted}")
            print(f"   Provided: {g}")
            return False

    except Exception as e:
        print(f"Error validating dates: {e}")
        return False


def convert_hijri_to_gregorian(year: int, month: int, day: int) -> dict:
    """Convert Hijri date to Gregorian, returning dict with year, month, day."""
    try:
        greg_date = _approximate_hijri_to_gregorian(year, month, day)
        return {"year": greg_date.year, "month": greg_date.month, "day": greg_date.day}
    except ValueError:
        return None


def convert_gregorian_to_hijri(year: int, month: int, day: int) -> dict:
    """Convert Gregorian date to Hijri, returning dict with year, month, day."""
    try:
        hy, hm, hd = _approximate_gregorian_to_hijri(year, month, day)
        return {"year": hy, "month": hm, "day": hd}
    except ValueError:
        return None


def years_since(gregorian_date: dict, current_date: date = None) -> int:
    """Calculate years elapsed since a given Gregorian date."""
    if current_date is None:
        current_date = date.today()

    event_date = date(gregorian_date['year'],
                      gregorian_date['month'],
                      gregorian_date['day'])

    # Check if the event's day/month has passed this year
    has_passed = (current_date.month > event_date.month or
                  (current_date.month == event_date.month and
                   current_date.day >= event_date.day))

    years = current_date.year - event_date.year
    if not has_passed:
        years -= 1

    return years


# Hijri month names
HIJRI_MONTHS = [
    "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
    "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
    "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah"
]

HIJRI_MONTH_NUMBERS = {name: i+1 for i, name in enumerate(HIJRI_MONTHS)}


def parse_hijri_month(month_name: str) -> int:
    """Convert Hijri month name to number (1-12)."""
    month_name = month_name.strip().lower()
    for i, name in enumerate(HIJRI_MONTHS):
        if name.lower().startswith(month_name):
            return i + 1
    raise ValueError(f"Unknown Hijri month: {month_name}")
