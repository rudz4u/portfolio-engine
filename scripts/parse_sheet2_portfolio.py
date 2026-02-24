#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / 'Docs' / 'Investment Management.xlsx'
OUT_JSON = ROOT / 'Docs/parsed_portfolio.json'

def get_shared_strings(z):
    try:
        data = z.read('xl/sharedStrings.xml')
    except KeyError:
        return []
    root = ET.fromstring(data)
    strings = []
    for si in root.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
        t = si.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
        if t is not None:
            strings.append(t.text or '')
        else:
            parts = [rt.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t').text or '' for rt in si.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}r')]
            strings.append(''.join(parts))
    return strings

def parse_sheet2(z, shared_strings):
    file = 'xl/worksheets/sheet2.xml'
    data = z.read(file)
    root = ET.fromstring(data)
    ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
    rows = []
    for r in root.findall('.//{}row'.format(ns)):
        rid = int(r.get('r'))
        cells = {}
        for c in r.findall('{}c'.format(ns)):
            ref = c.get('r')
            t = c.get('t')
            v = None
            if t == 's':
                v_elem = c.find('{}v'.format(ns))
                if v_elem is not None and v_elem.text:
                    idx = int(v_elem.text)
                    v = shared_strings[idx] if idx < len(shared_strings) else ''
            else:
                v_elem = c.find('{}v'.format(ns))
                if v_elem is not None and v_elem.text:
                    v = v_elem.text
                else:
                    is_elem = c.find('{}is/{}t'.format(ns, ns))
                    if is_elem is not None and is_elem.text:
                        v = is_elem.text
            # map column letter
            col = ''.join([ch for ch in ref if ch.isalpha()])
            cells[col] = v
        rows.append({'r': rid, 'cells': cells})
    return rows

def rows_to_table(rows):
    header = None
    for r in rows:
        if r['r'] == 1:
            header = r
            break
    if not header:
        header = rows[0]
    headers = {col: (val or '').strip() for col, val in header['cells'].items()}
    table = []
    for r in rows:
        if r['r'] == header['r']:
            continue
        rowobj = {}
        for col, h in headers.items():
            rowobj[h] = r['cells'].get(col)
        table.append(rowobj)
    return table

def main():
    if not XLSX_PATH.exists():
        print('XLSX missing')
        return
    z = zipfile.ZipFile(str(XLSX_PATH))
    shared = get_shared_strings(z)
    rows = parse_sheet2(z, shared)
    table = rows_to_table(rows)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump({'Portfolio': table}, f, indent=2, ensure_ascii=False)
    print('Wrote', OUT_JSON)

if __name__ == '__main__':
    main()
