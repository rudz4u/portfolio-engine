#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / 'Docs' / 'Investment Management.xlsx'
OUT_FILE = ROOT / 'Docs' / 'XLSX-Formulas.md'

def find_sheet_name(sheet_file, z):
    # Attempt to find sheet name mapping from workbook.xml
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    for s in wb.findall('ns:sheets/ns:sheet', ns):
        rid = s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        # map rid to target via rels
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        for r in rels.findall('Relationship'):
            if r.get('Id') == rid:
                target = r.get('Target')
                if target.endswith(sheet_file.split('/')[-1]):
                    return s.get('name')
    return sheet_file

def main():
    if not XLSX_PATH.exists():
        print('XLSX file not found:', XLSX_PATH)
        return

    z = zipfile.ZipFile(str(XLSX_PATH))
    entries = [f for f in z.namelist() if f.startswith('xl/worksheets/') and f.endswith('.xml')]
    lines = [f'# XLSX Formulas — {XLSX_PATH.name}\n']
    if not entries:
        lines.append('No worksheet XML files found.')
    for entry in entries:
        data = z.read(entry)
        root = ET.fromstring(data)
        ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        f_elems = root.findall('.//ns:f', ns)
        sheet_name = find_sheet_name(entry, z)
        lines.append(f'## Sheet: {sheet_name} ({entry})')
        lines.append(f'- Formulas found: {len(f_elems)}')
        sample = []
        for f in f_elems[:10]:
            txt = f.text or ''
            sample.append(f'- `{txt}`')
        if sample:
            lines.append('\nSample formulas:')
            lines.extend(sample)
        lines.append('\n')

    with open(OUT_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print('Wrote', OUT_FILE)

if __name__ == '__main__':
    main()
