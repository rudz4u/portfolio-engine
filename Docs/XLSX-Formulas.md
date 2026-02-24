# XLSX Formulas — Investment Management.xlsx

## Sheet: xl/worksheets/sheet1.xml (xl/worksheets/sheet1.xml)
- Formulas found: 1

Sample formulas:
- `IFERROR(__xludf.DUMMYFUNCTION("IMPORTXML(""https://www.google.com/finance/quote/INDIA_VIX:INDEXNSE?hl=en"", ""//div[@class='YMlKec fxKbKc']"")
"),14.54)`


## Sheet: xl/worksheets/sheet2.xml (xl/worksheets/sheet2.xml)
- Formulas found: 1004

Sample formulas:
- `IFERROR(__xludf.DUMMYFUNCTION("GOOGLEFINANCE(C2)"),961.4)`
- `H2*F2`
- `G2*F2`
- `J2-I2`
- `K2/I2`
- ` (I2 + (M2 * G2)) / (F2 + M2)`
- `G2-N2`
- `O2*F2+M2`
- ` (P2 / (N2 * (F2 + M2)))`
- `IF(Q2 > L2, "Yes", "No")
`


## Sheet: xl/worksheets/sheet3.xml (xl/worksheets/sheet3.xml)
- Formulas found: 148

Sample formulas:
- `Portfolio!C2`
- `TODAY()-1095`
- `Today()`
- `Portfolio!C3`
- ``
- ``
- `Portfolio!C4`
- ``
- ``
- `Portfolio!C5`


## Sheet: xl/worksheets/sheet4.xml (xl/worksheets/sheet4.xml)
- Formulas found: 760

Sample formulas:
- `IFERROR(__xludf.DUMMYFUNCTION("SPARKLINE(INDEX(GOOGLEFINANCE(C2,""price"",workday(today(),-$E$1),today()),,2),{""charttype"",""column"";""color"",""green""})"),"")`
- `IFERROR(__xludf.DUMMYFUNCTION("GOOGLEFINANCE(C2,""price"")"),961.4)`
- `IFERROR(__xludf.DUMMYFUNCTION("GOOGLEFINANCE(C2,""change"")"),-8.95)`
- `IFERROR(__xludf.DUMMYFUNCTION("GOOGLEFINANCE(C2,""changepct"")/100"),-0.0092)`
- `IFERROR(__xludf.DUMMYFUNCTION("INDEX(GOOGLEFINANCE(C2,""price"",workday(today(),-I$1)),2,2)"),1016.8)`
- `IFERROR(__xludf.DUMMYFUNCTION("INDEX(GOOGLEFINANCE($C2,""price"",workday(today(),-J$1)),2,2)"),978.3)`
- `IFERROR(__xludf.DUMMYFUNCTION("$F2/(INDEX(GOOGLEFINANCE($C2,""price"",workday(today(),-K$1)),2,2))-1"),-0.05448465774980327)`
- `IFERROR(__xludf.DUMMYFUNCTION("$F2/(INDEX(GOOGLEFINANCE($C2,""price"",workday(today(),-L$1)),2,2))-1"),-0.017274864560973047)`
- `IFERROR(__xludf.DUMMYFUNCTION("GOOGLEFINANCE(C2,""marketcap"")"),1.583594085214E12)`
- `IFERROR(__xludf.DUMMYFUNCTION("IFERROR(GOOGLEFINANCE(C2,""PE""),""-"")"),111.62)`


## Sheet: xl/worksheets/sheet5.xml (xl/worksheets/sheet5.xml)
- Formulas found: 0


## Sheet: xl/worksheets/sheet6.xml (xl/worksheets/sheet6.xml)
- Formulas found: 2

Sample formulas:
- `SUM(B2:B7)`
- `SUM(E2:E13)`

