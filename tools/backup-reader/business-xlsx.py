"""Write a read-only report from an allowlist, without Excel or extra dependencies."""
import json
import sys
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG = "http://schemas.openxmlformats.org/package/2006/relationships"
TYPES = "http://schemas.openxmlformats.org/package/2006/content-types"
XML = '<?xml version="1.0" encoding="UTF-8"?>'


def money(value, divisor=100):
    return None if value is None else Decimal(value) / divisor


def sheet_data(directory):
    def read(table):
        return json.loads((directory / (table + ".json")).read_text(encoding="utf-8"))

    contractors = read("contractors")
    vehicles = read("vehicles")
    names = {r["id"]: r["name"] for r in contractors}
    plates = {r["id"]: r["plate_number"] for r in vehicles}

    def status(row):
        return "ملغاة" if row.get("is_cancelled") else "مسجلة"

    yield ("الرحلات", ["التاريخ", "العربية", "المقاول", "المقاول المسؤول", "الوزن (طن)", "حساب المقاول (جنيه)", "حساب العربية (جنيه)", "الحالة"],
           [[r["trip_date"], plates[r["vehicle_id"]], names[r["counterparty_contractor_id"]],
             names[r["responsible_contractor_id"]], money(r["weight_milli_tonnes"], 1000),
             money(r["contractor_total_piastres"]), money(r["vehicle_total_piastres"]), status(r)]
            for r in sorted(read("trips"), key=lambda r: (r["trip_date"], r["id"]))])
    yield ("المدفوعات", ["التاريخ", "العربية", "المقاول المسؤول", "المبلغ (جنيه)", "رقم الإيصال", "الحالة"],
           [[r["payment_date"], plates[r["vehicle_id"]], names[r["responsible_contractor_id"]],
             money(r["amount_piastres"]), r.get("receipt_number"), status(r)]
            for r in sorted(read("payments"), key=lambda r: (r["payment_date"], r["id"]))])
    yield ("الأرصدة الافتتاحية", ["من تاريخ", "النوع", "المقاول", "العربية", "الرصيد (جنيه)", "الحالة"],
           [[r["start_date"], {"CONTRACTOR_WORK": "شغل المقاول", "VEHICLE_CASH": "حساب العربية"}[r["balance_type"]],
             names[r["contractor_id"]], plates.get(r.get("vehicle_id")), money(r["signed_piastres"]), status(r)]
            for r in sorted(read("opening_balances"), key=lambda r: (r["start_date"], r["id"]))])
    yield ("المقاولون", ["الاسم", "الحالة"],
           [[r["name"], "مؤرشف" if r["is_archived"] else "نشط"] for r in contractors])
    yield ("العربيات", ["رقم العربية", "الحالة"],
           [[r["plate_number"], "مؤرشفة" if r["is_archived"] else "نشطة"] for r in vehicles])


def cell(value):
    # Excel can only round-trip up to 15 significant digits. Preserve large amounts as text.
    if isinstance(value, Decimal) and len(value.normalize().as_tuple().digits) <= 15:
        return f'<c t="n"><v>{format(value, "f")}</v></c>'
    text = "" if value is None else str(value)
    text = "".join(ch for ch in text if ord(ch) >= 32 or ch in "\t\n\r")
    if len(text) > 32_767:
        raise ValueError("Text exceeds the Excel cell limit")
    # Never assign formulas, even if a plate or receipt begins with "=".
    return f'<c t="inlineStr"><is><t xml:space="preserve">{escape(text)}</t></is></c>'


def write_workbook(directory, output):
    data = list(sheet_data(directory))
    links = []
    declarations = []
    overrides = []
    with ZipFile(output, "x", ZIP_DEFLATED) as out:
        for i, (name, headers, rows) in enumerate(data, 1):
            if len(rows) >= 1_048_576:
                raise ValueError("Excel row limit exceeded")
            rel = f"rId{i}"
            links.append(f'<Relationship Id="{rel}" Type="{REL}/worksheet" Target="worksheets/sheet{i}.xml"/>')
            declarations.append(f'<sheet name="{name}" sheetId="{i}" r:id="{rel}"/>')
            overrides.append(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
            last = chr(64 + len(headers))
            xml = XML + f'<worksheet xmlns="{NS}"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="{len(headers)}" width="23" customWidth="1"/></cols><sheetData>'
            xml += "".join(f'<row r="{n}">' + "".join(cell(v) for v in line) + "</row>" for n, line in enumerate([headers, *rows], 1))
            xml += f'</sheetData><autoFilter ref="A1:{last}{len(rows)+1}"/></worksheet>'
            out.writestr(f"xl/worksheets/sheet{i}.xml", xml)
        out.writestr("xl/workbook.xml", XML + f'<workbook xmlns="{NS}" xmlns:r="{REL}"><sheets>{"".join(declarations)}</sheets></workbook>')
        out.writestr("xl/_rels/workbook.xml.rels", XML + f'<Relationships xmlns="{PKG}">{"".join(links)}</Relationships>')
        out.writestr("_rels/.rels", XML + f'<Relationships xmlns="{PKG}"><Relationship Id="rId1" Type="{REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        out.writestr("[Content_Types].xml", XML + f'<Types xmlns="{TYPES}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>{"".join(overrides)}</Types>')


if __name__ == "__main__":
    write_workbook(Path(sys.argv[1]), Path(sys.argv[2]))
