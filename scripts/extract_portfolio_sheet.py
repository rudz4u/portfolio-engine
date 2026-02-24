#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import re
import json

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / 'Docs' / 'Investment Management.xlsx'
OUT_JSON = ROOT / 'Docs' / 'parsed_portfolio.json'

def get_shared_strings(z):
    try:
        data = z.read('xl/sharedStrings.xml')
    except KeyError:
        return []
    root = ET.fromstring(data)
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    strings = []
    for si in root.findall('ns:si', ns):
        # si may have t or r
        t = si.find('ns:t', ns)
        if t is not None:
            strings.append(t.text or '')
        else:
            # concatenate r/text
            parts = [rt.find('ns:t', ns).text or '' for rt in si.findall('ns:r', ns)]
            strings.append(''.join(parts))
    return strings

def sheet_name_map(z):
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.get('Id'): r.get('Target') for r in rels.findall('Relationship')}
    mapping = {}
    for s in wb.findall('ns:sheets/ns:sheet', ns):
        name = s.get('name')
        rid = s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = rel_map.get(rid)
        if target:
            mapping[name] = 'xl/' + target
    return mapping

def col_letter_to_index(col):
    # A -> 1, B -> 2, AA -> 27
    exp = 0
    val = 0
    for ch in col[::-1]:
        val += (ord(ch) - ord('A') + 1) * (26 ** exp)
        exp += 1
    return val

def parse_sheet(z, sheet_file, shared_strings):
    data = z.read(sheet_file)
    root = ET.fromstring(data)
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows = []
    for r in root.findall('.//ns:row', ns):
        row_idx = int(r.get('r'))
        row_cells = {}
        for c in r.findall('ns:c', ns):
            ref = c.get('r')  # like A1
            m = re.match(r'([A-Z]+)([0-9]+)', ref)
            if not m:
                continue
            col = m.group(1)
            # determine value
            v = None
            t = c.get('t')
            if t == 's':
                # shared string
                v_elem = c.find('ns:v', ns)
                if v_elem is not None and v_elem.text is not None:
                    idx = int(v_elem.text)
                    v = shared_strings[idx] if idx < len(shared_strings) else ''
            else:
                v_elem = c.find('ns:v', ns)
                if v_elem is not None and v_elem.text is not None:
                    v = v_elem.text
                else:
                    # inlineStr
                    is_elem = c.find('ns:is/ns:t', ns)
                    if is_elem is not None:
                        v = is_elem.text
            row_cells[col] = v
        rows.append({'r': row_idx, 'cells': row_cells})
    return rows

def rows_to_table(rows):
    # find header row (assume row with r==1)
    header_row = None
    for r in rows:
        if r['r'] == 1:
            header_row = r
            break
    if not header_row:
        # pick first
        header_row = rows[0]
    headers = {}
    for col, val in header_row['cells'].items():
        headers[col] = (val or '').strip()

    table = []
    for r in rows:
        if r['r'] == header_row['r']:
            continue
        rowobj = {}
        for col, header in headers.items():
            rowobj[header] = r['cells'].get(col)
        table.append(rowobj)
    return table

def main():
    if not XLSX_PATH.exists():
        print('XLSX not found:', XLSX_PATH)
        return
    z = zipfile.ZipFile(str(XLSX_PATH))
    shared_strings = get_shared_strings(z)
    mapping = sheet_name_map(z)
    out = {}
    for name, file in mapping.items():
        rows = parse_sheet(z, file, shared_strings)
        table = rows_to_table(rows)
        out[name] = table
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print('Wrote', OUT_JSON)

if __name__ == '__main__':
    main()
