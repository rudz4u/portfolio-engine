#!/usr/bin/env python3
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
XLSX_PATH = ROOT / 'Docs' / 'Investment Management.xlsx'
OUT_SUMMARY = ROOT / 'Docs' / 'parsed_xlsx_summary_no_deps.md'

def get_sheet_files(z):
    # workbook.xml lists sheets and their relationship ids
    wb = ET.fromstring(z.read('xl/workbook.xml'))
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    sheets = []
    for s in wb.findall('ns:sheets/ns:sheet', ns):
        name = s.get('name')
        rid = s.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        sheets.append((name, rid))
    # map rId to sheet file from workbook rels
    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {}
    for r in rels.findall('Relationship'):
        rid = r.get('Id')
        target = r.get('Target')
        rel_map[rid] = 'xl/' + target
    return [(name, rel_map.get(rid)) for name, rid in sheets]

def analyze_sheet(z, sheet_file):
    data = z.read(sheet_file)
    root = ET.fromstring(data)
    ns = {'ns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    rows = root.findall('ns:sheetData/ns:row', ns)
    row_count = len(rows)
    col_count = 0
    formula_count = 0
    sample_formulas = []
    for r in rows:
        cells = r.findall('ns:c', ns)
        col_count = max(col_count, len(cells))
        for c in cells:
            f = c.find('ns:f', ns)
            if f is not None:
                formula_count += 1
                if len(sample_formulas) < 5:
                    sample_formulas.append(f.text)
    return row_count, col_count, formula_count, sample_formulas

def main():
    z = zipfile.ZipFile(str(XLSX_PATH))
    sheets = get_sheet_files(z)
    lines = [f'# Parsed XLSX (no deps): {XLSX_PATH.name}\n']
    lines.append('Sheets found:')
    for name, file in sheets:
        if not file:
            lines.append(f'- {name}: (no file mapping)')
            continue
        row_count, col_count, formula_count, sample_formulas = analyze_sheet(z, file)
        lines.append(f'- {name}: {row_count} data rows, approx {col_count} columns')
        lines.append(f'  - formulas found: {formula_count}')
        if sample_formulas:
            lines.append('  - sample formulas:')
            for f in sample_formulas:
                lines.append(f'    - `{f}`')

    with open(OUT_SUMMARY, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))

    print(f'Wrote {OUT_SUMMARY}')

if __name__ == '__main__':
    main()
