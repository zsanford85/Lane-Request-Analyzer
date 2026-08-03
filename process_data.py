import os
import sys
import re
import json
import time
import urllib.request
import urllib.parse
from html.parser import HTMLParser
from collections import Counter, defaultdict

# Common US / MX / CA City Coordinates fallback dictionary for instant lookup
KNOWN_CITIES = {
    "El Paso, TX": [31.7619, -106.4850],
    "Everett, WA": [47.9790, -122.2021],
    "Indianapolis, IN": [39.7684, -86.1581],
    "Auburn, AL": [32.6099, -85.4808],
    "Piedmont, SC": [34.7023, -82.4646],
    "Celaya Guanajuato, GJ": [20.5283, -100.8144],
    "Town Of Tonawanda, NY": [43.0039, -78.8950],
    "Laredo, TX": [27.5306, -99.4803],
    "Smyrna, TN": [35.9828, -86.5186],
    "Ellisville, MS": [31.6038, -89.2001],
    "Jacksonville, FL": [30.3322, -81.6557],
    "Normal, IL": [40.5142, -88.9906],
    "Nogales, AZ": [31.3404, -110.9343],
    "Louisville, KY": [38.2527, -85.7585],
    "Lapeer, MI": [43.0514, -83.3188],
    "Peebles, OH": [38.9484, -83.4046],
    "Teterboro, NJ": [40.8590, -74.0574],
    "Erlanger, KY": [39.0167, -84.6008],
    "Durham, NC": [35.9940, -78.8986],
    "Saltillo, CU": [25.4260, -101.0003],
    "Grand Prairie, TX": [32.7459, -96.9978],
    "Claycomo, MO": [39.1992, -94.4983],
    "Los Angeles, CA": [34.0522, -118.2437],
    "Chicago, IL": [41.8781, -87.6298],
    "Detroit, MI": [42.3314, -83.0458],
    "Dallas, TX": [32.7767, -96.7970],
    "Houston, TX": [29.7604, -95.3698],
    "Atlanta, GA": [33.7490, -84.3880],
    "Memphis, TN": [35.1495, -90.0490],
    "Nashville, TN": [36.1627, -86.7816],
    "Phoenix, AZ": [33.4484, -112.0740],
    "San Antonio, TX": [29.4241, -98.4936],
    "Columbus, OH": [39.9612, -82.9988],
    "Charlotte, NC": [35.2271, -80.8431],
    "Cincinnati, OH": [39.1031, -84.5120],
    "Cleveland, OH": [41.4993, -81.6944],
    "Milwaukee, WI": [43.0389, -87.9065],
    "Minneapolis, MN": [44.9778, -93.2650],
    "St. Louis, MO": [38.6270, -90.1994],
    "Kansas City, MO": [39.0997, -94.5786],
    "Seattle, WA": [47.6062, -122.3321],
    "Portland, OR": [45.5152, -122.6784],
    "Denver, CO": [39.7392, -104.9903],
    "Salt Lake City, UT": [40.7608, -111.8910],
    "McAllen, TX": [26.2034, -98.2300],
    "Pharr, TX": [26.1948, -98.1839],
    "Brownsville, TX": [25.9017, -97.4975],
    "San Luis Potosi, SL": [22.1565, -100.9855],
    "Monterrey, NL": [25.6866, -100.3161],
}

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.in_td = False
        self.current_row = []
        self.rows = []
        self.cell_text = ''

    def handle_starttag(self, tag, attrs):
        if tag in ('td', 'th'):
            self.in_td = True
            self.cell_text = ''
        elif tag == 'tr':
            self.current_row = []

    def handle_endtag(self, tag):
        if tag in ('td', 'th'):
            self.in_td = False
            self.current_row.append(self.cell_text.strip())
        elif tag == 'tr':
            if self.current_row:
                self.rows.append(self.current_row)

    def handle_data(self, data):
        if self.in_td:
            self.cell_text += data

def parse_loc(loc_str):
    loc_str = loc_str.strip()
    if not loc_str:
        return "", "", ""
    match = re.search(r'^(.*?),\s*([A-Z]{2})\s*(\d{5}(-\d{4})?)?$', loc_str, re.IGNORECASE)
    if match:
        city = match.group(1).title()
        state = match.group(2).upper()
        zip_code = match.group(3) or ''
        return city, state, zip_code
    parts = loc_str.split(',')
    if len(parts) >= 2:
        city = parts[0].strip().title()
        st_parts = parts[1].strip().split()
        state = st_parts[0].upper() if st_parts else ''
        zip_code = st_parts[1] if len(st_parts) > 1 else ''
        return city, state, zip_code
    return loc_str.title(), "", ""

def resolve_target_file():
    if len(sys.argv) > 1 and os.path.exists(sys.argv[1]):
        return sys.argv[1]
    
    data_dir = 'data'
    if os.path.exists(data_dir):
        for f in os.listdir(data_dir):
            if f.endswith('.xls') or f.endswith('.xlsx') or f.endswith('.csv'):
                return os.path.join(data_dir, f)

    default_path = '/Users/zsanford/Library/CloudStorage/OneDrive-Axio/CarrierBiddingStatsDetailReport.xls'
    if os.path.exists(default_path):
        return default_path
    
    raise FileNotFoundError("Could not find report file! Pass file path via: python3 process_data.py /path/to/report.xls")

def main():
    filepath = resolve_target_file()
    print(f"Processing data file: {filepath}")

    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    parser = TableParser()
    parser.feed(content)

    data_rows = [r for r in parser.rows if len(r) == 17 and r[0] != 'Shipment']
    print(f"Total shipment records found: {len(data_rows)}")

    geo_cache_path = 'geo_cache.json'
    geo_cache = {}
    if os.path.exists(geo_cache_path):
        with open(geo_cache_path, 'r') as f:
            geo_cache = json.load(f)
    
    for k, v in KNOWN_CITIES.items():
        geo_cache[k] = v

    records = []
    routes_counter = Counter()
    state_routes_counter = Counter()
    origin_cities = Counter()
    dest_cities = Counter()
    origin_states = Counter()
    dest_states = Counter()

    route_details = defaultdict(lambda: {
        'shipment_count': 0,
        'total_miles': 0.0,
        'total_lbs': 0.0,
        'response_count': 0,
        'award_count': 0,
        'origin_city': '',
        'dest_city': '',
        'origin_state': '',
        'dest_state': ''
    })

    for r in data_rows:
        shipment_id, call_date, orig_str, ready, dest_str, need, cont, lbs_str, miles_str, response, who, award, unit, mode, posted, responded, awarded = r
        
        o_city, o_state, o_zip = parse_loc(orig_str)
        d_city, d_state, d_zip = parse_loc(dest_str)
        
        orig_fmt = f"{o_city}, {o_state}" if o_state else o_city
        dest_fmt = f"{d_city}, {d_state}" if d_state else d_city
        
        if not orig_fmt or not dest_fmt:
            continue
            
        lane_key = f"{orig_fmt} \u2192 {dest_fmt}"
        state_lane_key = f"{o_state} \u2192 {d_state}" if (o_state and d_state) else "Unknown"

        try:
            miles = float(miles_str.replace(',', '')) if miles_str else 0.0
        except:
            miles = 0.0

        try:
            lbs = float(lbs_str.replace(',', '')) if lbs_str else 0.0
        except:
            lbs = 0.0

        is_responded = 1 if (response and response != 'No Response') or responded else 0
        is_awarded = 1 if award == 'Yes' or awarded else 0

        routes_counter[lane_key] += 1
        state_routes_counter[state_lane_key] += 1
        origin_cities[orig_fmt] += 1
        dest_cities[dest_fmt] += 1
        if o_state: origin_states[o_state] += 1
        if d_state: dest_states[d_state] += 1

        rd = route_details[lane_key]
        rd['shipment_count'] += 1
        rd['total_miles'] += miles
        rd['total_lbs'] += lbs
        rd['response_count'] += is_responded
        rd['award_count'] += is_awarded
        rd['origin_city'] = orig_fmt
        rd['dest_city'] = dest_fmt
        rd['origin_state'] = o_state
        rd['dest_state'] = d_state

        records.append({
            'id': shipment_id,
            'call_date': call_date,
            'orig': orig_fmt,
            'dest': dest_fmt,
            'orig_state': o_state,
            'dest_state': d_state,
            'miles': miles,
            'lbs': lbs,
            'mode': mode,
            'response': response,
            'award': award
        })

    lanes_list = []
    for lane_key, rd in route_details.items():
        o_coords = geo_cache.get(rd['origin_city'], [39.8283, -98.5795])
        d_coords = geo_cache.get(rd['dest_city'], [39.8283, -98.5795])
        
        avg_miles = round(rd['total_miles'] / rd['shipment_count'], 1) if rd['shipment_count'] else 0
        avg_lbs = round(rd['total_lbs'] / rd['shipment_count'], 1) if rd['shipment_count'] else 0
        
        lanes_list.append({
            'lane': lane_key,
            'origin': rd['origin_city'],
            'dest': rd['dest_city'],
            'origin_state': rd['origin_state'],
            'dest_state': rd['dest_state'],
            'origin_coords': o_coords,
            'dest_coords': d_coords,
            'count': rd['shipment_count'],
            'total_lbs': rd['total_lbs'],
            'avg_lbs': avg_lbs,
            'total_miles': rd['total_miles'],
            'avg_miles': avg_miles,
            'response_rate': round(rd['response_count'] / rd['shipment_count'] * 100, 1),
            'award_rate': round(rd['award_count'] / rd['shipment_count'] * 100, 1)
        })

    lanes_list.sort(key=lambda x: x['count'], reverse=True)

    state_matrix = []
    for s_lane, count in state_routes_counter.items():
        if " \u2192 " in s_lane:
            so, sd = s_lane.split(" \u2192 ")
            state_matrix.append({'from': so, 'to': sd, 'count': count})

    output_data = {
        'summary': {
            'total_shipments': len(records),
            'total_lanes': len(lanes_list),
            'total_origin_hubs': len(origin_cities),
            'total_dest_hubs': len(dest_cities),
            'busiest_lane': lanes_list[0]['lane'] if lanes_list else '',
            'busiest_lane_count': lanes_list[0]['count'] if lanes_list else 0
        },
        'top_lanes': lanes_list,
        'origin_hubs': [{'city': k, 'count': v, 'coords': geo_cache.get(k, [39.8, -98.5])} for k, v in origin_cities.most_common(50)],
        'dest_hubs': [{'city': k, 'count': v, 'coords': geo_cache.get(k, [39.8, -98.5])} for k, v in dest_cities.most_common(50)],
        'state_matrix': state_matrix,
        'shipments': records
    }

    with open('route_data.json', 'w') as f:
        json.dump(output_data, f, indent=2)

    print("Successfully updated route_data.json!")

if __name__ == '__main__':
    main()
