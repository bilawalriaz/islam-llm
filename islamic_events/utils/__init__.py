"""Islamic events utilities package."""

from .date_converter import (
    DualDate,
    validate_dual_date,
    convert_hijri_to_gregorian,
    convert_gregorian_to_hijri,
    years_since,
    HIJRI_MONTHS,
    HIJRI_MONTH_NUMBERS,
    parse_hijri_month,
)

__all__ = [
    "DualDate",
    "validate_dual_date",
    "convert_hijri_to_gregorian",
    "convert_gregorian_to_hijri",
    "years_since",
    "HIJRI_MONTHS",
    "HIJRI_MONTH_NUMBERS",
    "parse_hijri_month",
]
