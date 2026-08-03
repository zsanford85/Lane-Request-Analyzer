import os
import re
import json
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from collections import Counter, defaultdict

AIRPORT_DB = {
    "IAD": {"name": "Washington Dulles Intl", "city": "Dulles", "state": "VA", "coords": [38.9531, -77.4565]},
    "ADS": {"name": "Addison Airport", "city": "Addison", "state": "TX", "coords": [32.9685, -96.8364]},
    "FRG": {"name": "Republic Airport", "city": "Farmingdale", "state": "NY", "coords": [40.7288, -73.4134]},
    "LBB": {"name": "Lubbock Preston Smith Intl", "city": "Lubbock", "state": "TX", "coords": [33.6636, -101.8228]},
    "ELP": {"name": "El Paso Intl", "city": "El Paso", "state": "TX", "coords": [31.8072, -106.3778]},
    "CMH": {"name": "John Glenn Columbus Intl", "city": "Columbus", "state": "OH", "coords": [39.9980, -82.8919]},
    "DAL": {"name": "Dallas Love Field", "city": "Dallas", "state": "TX", "coords": [32.8471, -96.8518]},
    "MMU": {"name": "Morristown Municipal", "city": "Morristown", "state": "NJ", "coords": [40.7993, -74.4149]},
    "BHM": {"name": "Birmingham-Shuttlesworth Intl", "city": "Birmingham", "state": "AL", "coords": [33.5629, -86.7535]},
    "PDK": {"name": "DeKalb-Peachtree Airport", "city": "Atlanta", "state": "GA", "coords": [33.8756, -84.3020]},
    "LZU": {"name": "Gwinnett County Airport", "city": "Lawrenceville", "state": "GA", "coords": [33.9786, -83.9622]},
    "MEM": {"name": "Memphis Intl", "city": "Memphis", "state": "TN", "coords": [35.0424, -89.9767]},
    "GYH": {"name": "Donaldson Field", "city": "Greenville", "state": "SC", "coords": [34.7584, -82.3758]},
    "LRD": {"name": "Laredo Intl", "city": "Laredo", "state": "TX", "coords": [27.5438, -99.4616]},
    "PIB": {"name": "Hattiesburg-Laurel Regional", "city": "Hattiesburg", "state": "MS", "coords": [31.4671, -89.3370]},
    "LUK": {"name": "Cincinnati Municipal Lunken", "city": "Cincinnati", "state": "OH", "coords": [39.1033, -84.4186]},
    "ORF": {"name": "Norfolk Intl", "city": "Norfolk", "state": "VA", "coords": [36.8946, -76.2012]},
    "HOU": {"name": "William P. Hobby", "city": "Houston", "state": "TX", "coords": [29.6454, -95.2789]},
    "BKL": {"name": "Burke Lakefront", "city": "Cleveland", "state": "OH", "coords": [41.5172, -81.6833]},
    "RVS": {"name": "Richard Lloyd Jones Jr", "city": "Tulsa", "state": "OK", "coords": [36.0396, -95.9846]},
    "ROC": {"name": "Greater Rochester Intl", "city": "Rochester", "state": "NY", "coords": [43.1189, -77.6724]},
    "TUL": {"name": "Tulsa Intl", "city": "Tulsa", "state": "OK", "coords": [36.1984, -95.8881]},
    "IND": {"name": "Indianapolis Intl", "city": "Indianapolis", "state": "IN", "coords": [39.7173, -86.2944]},
    "JFK": {"name": "John F. Kennedy Intl", "city": "New York", "state": "NY", "coords": [40.6413, -73.7781]},
    "INT": {"name": "Smith Reynolds Airport", "city": "Winston-Salem", "state": "NC", "coords": [36.1337, -80.2220]},
    "DCU": {"name": "Pryor Field Regional", "city": "Decatur", "state": "AL", "coords": [34.6543, -86.9452]},
    "CHO": {"name": "Charlottesville-Albemarle", "city": "Charlottesville", "state": "VA", "coords": [38.1386, -78.4529]},
    "SFB": {"name": "Orlando Sanford Intl", "city": "Sanford", "state": "FL", "coords": [28.7776, -81.2375]},
    "LEX": {"name": "Blue Grass Airport", "city": "Lexington", "state": "KY", "coords": [38.0365, -84.6059]},
    "CHS": {"name": "Charleston Intl", "city": "Charleston", "state": "SC", "coords": [32.8986, -80.0405]},
    "BDL": {"name": "Bradley Intl", "city": "Hartford", "state": "CT", "coords": [41.9389, -72.6832]},
    "CTJ": {"name": "West Georgia Regional", "city": "Carrollton", "state": "GA", "coords": [33.6311, -85.1534]},
    "OLV": {"name": "Olive Branch Airport", "city": "Olive Branch", "state": "MS", "coords": [34.9788, -89.7871]},
    "DRT": {"name": "Del Rio Intl", "city": "Del Rio", "state": "TX", "coords": [29.3744, -100.9272]},
    "TYS": {"name": "McGhee Tyson", "city": "Knoxville", "state": "TN", "coords": [35.8110, -83.9940]},
    "TPA": {"name": "Tampa Intl", "city": "Tampa", "state": "FL", "coords": [27.9755, -82.5332]},
    "RDU": {"name": "Raleigh-Durham Intl", "city": "Raleigh", "state": "NC", "coords": [35.8776, -78.7875]},
    "FTW": {"name": "Fort Worth Meacham", "city": "Fort Worth", "state": "TX", "coords": [32.8198, -97.3621]},
    "SAT": {"name": "San Antonio Intl", "city": "San Antonio", "state": "TX", "coords": [29.5337, -98.4698]},
    "ALB": {"name": "Albany Intl", "city": "Albany", "state": "NY", "coords": [42.7483, -73.8017]},
    "TEB": {"name": "Teterboro Airport", "city": "Teterboro", "state": "NJ", "coords": [40.8501, -74.0608]},
    "CRG": {"name": "Jacksonville Executive Craig", "city": "Jacksonville", "state": "FL", "coords": [30.3363, -81.5144]},
    "HDC": {"name": "Hammond Northshore Regional", "city": "Hammond", "state": "LA", "coords": [30.5212, -90.4172]},
    "AMG": {"name": "Bacon County Airport", "city": "Alma", "state": "GA", "coords": [31.5360, -82.5066]},
    "STF": {"name": "George M. Bryan Airport", "city": "Starkville", "state": "MS", "coords": [33.4323, -88.8478]}
}

def excel_date(val):
    try:
        n = float(val)
        dt = datetime(1899, 12, 30) + timedelta(days=n)
        return dt.strftime('%Y-%m-%d')
    except:
        return str(val)

def geocode_airport(code, cache):
    if code in AIRPORT_DB:
        return AIRPORT_DB[code]
    if code in cache:
        return cache[code]

    res = {"name": f"Airport {code}", "city": code, "state": "", "coords": [38.5 + (hash(code) % 100) / 20.0, -96.0 + (hash(code) % 100) / 10.0]}
    cache[code] = res
    return res

def main():
    filepath = '/Users/zsanford/Library/CloudStorage/OneDrive-Axio/GTA Flight Logs (1).xlsx'
    if not os.path.exists(filepath):
        print("GTA Flight Logs file not found!")
        return

    with zipfile.ZipFile(filepath, 'r') as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
            for elem in tree.iter():
                if elem.tag.endswith('t') and elem.text:
                    strings.append(elem.text)

        sheet_tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        rows = []
        for row in sheet_tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
            r_cells = []
            for cell in row.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                v = cell.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                t = cell.attrib.get('t')
                val = ''
                if v is not None and v.text:
                    if t == 's':
                        idx = int(v.text)
                        val = strings[idx] if idx < len(strings) else v.text
                    else:
                        val = v.text
                r_cells.append(val)
            rows.append(r_cells)

    print(f"Total raw rows in GTA Flight Logs: {len(rows)}")

    geo_cache = dict(AIRPORT_DB)

    flight_records = []
    routes_counter = Counter()
    airport_counter = Counter()
    aircraft_counter = Counter()
    category_counter = Counter()

    route_details = defaultdict(lambda: {
        'flight_count': 0,
        'origin': '',
        'dest': '',
        'origin_code': '',
        'dest_code': '',
        'aircraft_breakdown': defaultdict(int),
        'category_breakdown': defaultdict(int)
    })

    for r in rows:
        if len(r) >= 4:
            date_str = excel_date(r[0])
            category = r[1].strip() if r[1] else "Other"
            aircraft = r[2].strip() if r[2] else "Unknown"
            route_raw = r[3].strip().upper() if r[3] else ""

            if '-' in route_raw and len(route_raw) <= 10:
                parts = route_raw.split('-')
                if len(parts) == 2:
                    orig_code = parts[0].strip()
                    dest_code = parts[1].strip()

                    orig_info = geocode_airport(orig_code, geo_cache)
                    dest_info = geocode_airport(dest_code, geo_cache)

                    orig_display = f"{orig_code} ({orig_info['city']})" if orig_info['city'] else orig_code
                    dest_display = f"{dest_code} ({dest_info['city']})" if dest_info['city'] else dest_code

                    lane_key = f"{orig_code} \u2192 {dest_code}"
                    
                    routes_counter[lane_key] += 1
                    airport_counter[orig_code] += 1
                    airport_counter[dest_code] += 1
                    aircraft_counter[aircraft] += 1
                    category_counter[category] += 1

                    rd = route_details[lane_key]
                    rd['flight_count'] += 1
                    rd['origin'] = orig_display
                    rd['dest'] = dest_display
                    rd['origin_code'] = orig_code
                    rd['dest_code'] = dest_code
                    rd['origin_coords'] = orig_info['coords']
                    rd['dest_coords'] = dest_info['coords']
                    rd['origin_state'] = orig_info.get('state', '')
                    rd['dest_state'] = dest_info.get('state', '')
                    rd['aircraft_breakdown'][aircraft] += 1
                    rd['category_breakdown'][category] += 1

                    flight_records.append({
                        'date': date_str,
                        'category': category,
                        'aircraft': aircraft,
                        'orig_code': orig_code,
                        'dest_code': dest_code,
                        'orig_city': orig_info['city'],
                        'dest_city': dest_info['city'],
                        'orig_state': orig_info.get('state', ''),
                        'dest_state': dest_info.get('state', '')
                    })

    lanes_list = []
    for lane_key, rd in route_details.items():
        lanes_list.append({
            'lane': lane_key,
            'origin': rd['origin'],
            'dest': rd['dest'],
            'origin_code': rd['origin_code'],
            'dest_code': rd['dest_code'],
            'origin_coords': rd['origin_coords'],
            'dest_coords': rd['dest_coords'],
            'origin_state': rd['origin_state'],
            'dest_state': rd['dest_state'],
            'count': rd['flight_count'],
            'aircraft_breakdown': dict(rd['aircraft_breakdown']),
            'category_breakdown': dict(rd['category_breakdown'])
        })

    lanes_list.sort(key=lambda x: x['count'], reverse=True)

    output_data = {
        'summary': {
            'total_flights': len(flight_records),
            'total_routes': len(lanes_list),
            'total_airports': len(airport_counter),
            'top_route': lanes_list[0]['lane'] if lanes_list else '',
            'top_route_count': lanes_list[0]['count'] if lanes_list else 0,
            'top_aircraft': aircraft_counter.most_common(1)[0][0] if aircraft_counter else '',
            'top_category': category_counter.most_common(1)[0][0] if category_counter else ''
        },
        'aircraft_options': [k for k, v in aircraft_counter.most_common()],
        'category_options': [k for k, v in category_counter.most_common()],
        'top_lanes': lanes_list,
        'airport_hubs': [{'code': k, 'count': v, 'info': geo_cache.get(k, {})} for k, v in airport_counter.most_common(50)],
        'records': flight_records
    }

    with open('gta_flight_data.json', 'w') as f:
        json.dump(output_data, f, indent=2)

    print("Successfully generated gta_flight_data.json in <1s!")

if __name__ == '__main__':
    main()
