# Sahayak Police Station Scraper

This Python script scrapes official police station data for Bangalore and Mysore, then geocodes the addresses to get latitude/longitude coordinates.

## Quick Start

```bash
cd scripts/
pip install -r requirements.txt
python scrape_police_stations.py
```

The script will generate `../public/police_stations_bangalore_mysore.json` with all station data.

## Data Sources

- **Mysore**: `mysore.nic.in/police-stations/` (official government site)
- **Bangalore**: `police-station.com/karnataka/bangalore/` (comprehensive directory)

## Geocoding

By default, uses **OpenStreetMap Nominatim** (free, no API key required).

### Alternative Geocoding APIs

To use Google Maps or Mapbox (more accurate), modify the script:

**Google Maps API:**
```python
# Replace Nominatim with:
import googlemaps
gmaps = googlemaps.Client(key='YOUR_API_KEY')
```

**Mapbox API:**
```python
# Replace Nominatim with:
from mapbox import Geocoder
geocoder = Geocoder(access_token='YOUR_TOKEN')
```

## Rate Limiting

- Default: 1 second delay between geocoding requests
- Adjust `GEOCODE_DELAY` in script if needed
- Nominatim has usage policy: 1 request/second max

## Troubleshooting

### SSL Certificate Error (macOS)

If you see `SSL: CERTIFICATE_VERIFY_FAILED`, run:

```bash
/Applications/Python\ 3.*/Install\ Certificates.command
```

Or install certificates manually:
```bash
pip install certifi
export SSL_CERT_FILE=$(python -m certifi)
```

### Network Issues

- Script includes retry logic and error handling
- Check internet connection
- Some sites may block automated requests

## Output Format

```json
[
  {
    "id": "ps_001",
    "name": "Station Name",
    "address": "Full Address",
    "phone": "Phone Number",
    "lat": 12.345678,
    "lng": 77.123456,
    "area": "Bangalore Central"
  }
]
```

## Integration

The generated JSON is automatically loaded by the Sahayak Police Portal backend (`server/geo.js`).