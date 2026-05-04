#!/usr/bin/env python3
"""
Sahayak Police Station Scraper
Scrapes official police station data for Bangalore and Mysore
"""

import requests
import json
import time
import logging
from bs4 import BeautifulSoup
from geopy.geocoders import Nominatim
from urllib.parse import urlparse, parse_qs

# Configuration
OUTPUT_FILE = "../public/police_stations_bangalore_mysore.json"
GEOCODE_DELAY = 1.0  # Rate limiting
USER_AGENT = "Sahayak Police Portal Scraper 1.0"

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize geocoder
geolocator = Nominatim(user_agent=USER_AGENT)

def extract_address_from_maps_url(url):
    """Extract address from Google Maps URL query parameter"""
    try:
        parsed = urlparse(url)
        query_params = parse_qs(parsed.query)
        if 'query' in query_params:
            return query_params['query'][0]
    except:
        pass
    return None

def geocode_address(address, area=""):
    """Geocode address to lat/lng with error handling"""
    try:
        # Enhance address with area context
        full_address = f"{address}, {area}, Karnataka, India" if area else f"{address}, Karnataka, India"
        logger.info(f"Geocoding: {full_address}")
        
        location = geolocator.geocode(full_address, timeout=10)
        if location:
            return location.latitude, location.longitude
        else:
            logger.warning(f"Geocoding failed for: {full_address}")
            return None, None
    except Exception as e:
        logger.error(f"Geocoding error for '{address}': {e}")
        return None, None

def scrape_mysore_stations():
    """Scrape Mysore police stations from mysore.nic.in"""
    stations = []
    base_url = "https://mysore.nic.in"
    
    try:
        # Try multiple pages
        for page in range(1, 4):  # Pages 1-3
            url = f"{base_url}/police-stations/" if page == 1 else f"{base_url}/police-stations/page/{page}/"
            logger.info(f"Scraping Mysore page: {url}")
            
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                logger.warning(f"Failed to fetch {url}: {response.status_code}")
                continue
                
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Find station entries (h2 or h3 headers followed by links)
            station_headers = soup.find_all(['h2', 'h3'])
            
            for header in station_headers:
                station_name = header.get_text().strip()
                if not station_name or len(station_name) < 5:
                    continue
                    
                # Look for address and phone in following elements
                address = ""
                phone = ""
                
                # Check siblings for links
                next_elem = header.find_next_sibling()
                while next_elem and next_elem.name in ['p', 'div', 'a']:
                    if next_elem.name == 'a':
                        href = next_elem.get('href', '')
                        if 'maps.google' in href or 'goo.gl' in href:
                            # Extract address from Google Maps URL
                            maps_address = extract_address_from_maps_url(href)
                            if maps_address:
                                address = maps_address
                        elif 'tel:' in href:
                            phone = href.replace('tel:', '').strip()
                    
                    text = next_elem.get_text().strip()
                    if text and not address and ('road' in text.lower() or 'street' in text.lower()):
                        address = text
                    elif text and not phone and any(char.isdigit() for char in text):
                        phone = text
                        
                    next_elem = next_elem.find_next_sibling()
                
                if station_name and (address or phone):
                    logger.info(f"Found Mysore station: {station_name}")
                    stations.append({
                        'name': station_name,
                        'address': address or f"{station_name}, Mysuru, Karnataka",
                        'phone': phone or "N/A",
                        'area': "Mysuru"
                    })
                    
            time.sleep(2)  # Be respectful to the server
            
    except Exception as e:
        logger.error(f"Error scraping Mysore stations: {e}")
    
    return stations

def scrape_bangalore_stations():
    """Scrape Bangalore police stations from police-station.com"""
    stations = []
    
    try:
        url = "https://www.police-station.com/karnataka/bangalore/"
        logger.info(f"Scraping Bangalore: {url}")
        
        response = requests.get(url, timeout=10)
        if response.status_code != 200:
            logger.error(f"Failed to fetch Bangalore data: {response.status_code}")
            return stations
            
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Look for table with police station data
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows[1:]:  # Skip header row
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    station_name = cells[0].get_text().strip()
                    address_cell = cells[1] if len(cells) > 1 else cells[0]
                    
                    # Extract address and phone
                    address = address_cell.get_text().strip()
                    phone = "N/A"
                    
                    # Look for phone in address or separate cell
                    if len(cells) > 2:
                        phone_text = cells[2].get_text().strip()
                        if any(char.isdigit() for char in phone_text):
                            phone = phone_text
                    
                    if station_name and len(station_name) > 3:
                        # Determine area based on station name/address
                        area = "Bangalore Central"
                        if any(term in station_name.lower() for term in ['electronic', 'btm', 'koramangala', 'hsr']):
                            area = "Bangalore South"
                        elif any(term in station_name.lower() for term in ['whitefield', 'marathahalli', 'brigade']):
                            area = "Bangalore East"
                        elif any(term in station_name.lower() for term in ['hebbal', 'yelahanka', 'airport']):
                            area = "Bangalore North"
                        elif any(term in station_name.lower() for term in ['rajajinagar', 'malleshwaram', 'jayanagar']):
                            area = "Bangalore West"
                            
                        logger.info(f"Found Bangalore station: {station_name}")
                        stations.append({
                            'name': station_name,
                            'address': address,
                            'phone': phone,
                            'area': area
                        })
                        
    except Exception as e:
        logger.error(f"Error scraping Bangalore stations: {e}")
    
    return stations

def main():
    """Main scraper function"""
    logger.info("Starting Sahayak Police Station Scraper")
    
    all_stations = []
    
    # Scrape Mysore
    logger.info("=== Scraping Mysore Stations ===")
    mysore_stations = scrape_mysore_stations()
    all_stations.extend(mysore_stations)
    logger.info(f"Found {len(mysore_stations)} Mysore stations")
    
    # Scrape Bangalore
    logger.info("=== Scraping Bangalore Stations ===")
    bangalore_stations = scrape_bangalore_stations()
    all_stations.extend(bangalore_stations)
    logger.info(f"Found {len(bangalore_stations)} Bangalore stations")
    
    # Geocode all stations
    logger.info("=== Geocoding Stations ===")
    geocoded_stations = []
    
    for i, station in enumerate(all_stations):
        logger.info(f"Processing {i+1}/{len(all_stations)}: {station['name']}")
        
        lat, lng = geocode_address(station['address'], station['area'])
        
        if lat and lng:
            geocoded_station = {
                'id': f"ps_{str(i+1).zfill(3)}",
                'name': station['name'],
                'address': station['address'],
                'phone': station['phone'],
                'lat': round(lat, 6),
                'lng': round(lng, 6),
                'area': station['area']
            }
            geocoded_stations.append(geocoded_station)
            logger.info(f"✓ Geocoded: {lat:.6f}, {lng:.6f}")
        else:
            logger.warning(f"✗ Failed to geocode: {station['name']}")
        
        # Rate limiting
        time.sleep(GEOCODE_DELAY)
    
    # Save to JSON
    logger.info(f"=== Saving {len(geocoded_stations)} stations to {OUTPUT_FILE} ===")
    
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(geocoded_stations, f, indent=2, ensure_ascii=False)
        logger.info(f"✓ Successfully saved to {OUTPUT_FILE}")
    except Exception as e:
        logger.error(f"✗ Failed to save file: {e}")
        return
    
    # Summary
    logger.info("=== SCRAPING COMPLETE ===")
    logger.info(f"Total stations processed: {len(all_stations)}")
    logger.info(f"Successfully geocoded: {len(geocoded_stations)}")
    logger.info(f"Success rate: {len(geocoded_stations)/len(all_stations)*100:.1f}%")
    
    # Show area breakdown
    area_counts = {}
    for station in geocoded_stations:
        area = station['area']
        area_counts[area] = area_counts.get(area, 0) + 1
    
    logger.info("Area breakdown:")
    for area, count in area_counts.items():
        logger.info(f"  {area}: {count} stations")

if __name__ == "__main__":
    main()