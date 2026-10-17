"""Create canonical schedule JSON from the two printable PDFs."""
from __future__ import annotations
import json, re
from collections import defaultdict
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[1]
CLASS_PDF = ROOT / "115-1班級課表含週六(0921實施版).pdf"
TEACHER_PDF = ROOT / "115-1教師課表含週六(0921實施版).pdf"
OUT = ROOT / "data" / "schedules.json"
WEB_OUT = ROOT / "data" / "schedules.js"
DAYS = ["一", "二", "三", "四", "五"]

def compact(value: str | None) -> str:
    return re.sub(r"\s+", "", value or "")

def page_text(page) -> str:
    return "\n".join((page.extract_text() or "").splitlines())

def running_class(class_name: str, subject: str) -> bool:
    running_math_classes = ("高二知足", "高二感恩", "高二善解", "高三知足", "高三感恩", "高三善解")
    return ((class_name in running_math_classes and "數學" in subject) or
            (class_name.startswith("高二") and "彈性學習B" in subject) or
            (class_name.startswith("高一") and "多元選修" in subject) or
            False)

MANUAL_COURSES = {
    "綜合活動B-林童承軍勳": ("綜合活動B-童軍", "林承勳"),
    "綜合活動C-洪輔嘉導穗": ("綜合活動C-輔導", "洪嘉穗"),
    "綜合活動C-楊輔芳導玲": ("綜合活動C-輔導", "楊芳玲"),
    "綜合活動B-賴童昀軍締": ("綜合活動B-童軍", "賴昀締"),
    "綜合活動C-鄭輔莞導柔": ("綜合活動C-輔導", "鄭莞柔"),
}
FLEX_B_ASSIGNMENTS = {
    "張善治": "高二合心", "陳平瑋": "高二包容", "黃琮瑄": "高二感恩",
    "翁子喬": "高二善解", "陳泓緻": "高二和氣", "郭盈瑜": "高二知足",
}
MULTI_ELECTIVE_ROOMS = {
    "蔡宜珊": "高一知足", "顏雨詩": "高一善解", "曾愛達": "國中部分組教室",
    "張宏州": "高一合心", "林宏鋕": "高一合心", "黃丞皞": "高一包容",
    "林怡君": "高一包容", "王斐亭": "數學科專科教室", "郭盈瑜": "數學科專科教室",
    "黃秀玲": "電腦教室一", "賈旻曄": "社會科專科教室", "陳柏伶": "社會科專科教室",
    "吳巧伶": "音樂教室",
}

def public_class_code(name: str) -> str:
    grade = {"一":"1", "二":"2", "三":"3"}.get(name[1], "")
    class_number = {"知足":"01", "感恩":"02", "善解":"03", "包容":"04", "合心":"05", "和氣":"06", "互愛":"07", "協力":"08", "數理":"09"}
    return ("J" if name.startswith("國") else "S") + grade + class_number.get(name[2:], "")

def read_classes(pdf) -> list[dict]:
    schedules = []
    for page_no, page in enumerate(pdf.pages, 1):
        header = re.search(r"班級：(.+?)導師\s*:\s*(.+)", page_text(page))
        if not header:
            continue
        name, homeroom = map(compact, header.groups())
        number = re.search(r"編號\s*：\s*(\d+)", page_text(page))
        rows = []
        for source in (page.extract_table() or [])[1:]:
            if len(source) >= 4:
                rows.append({"period":{"name":compact(source[1]),"time":compact(source[2]).replace("︴","-")},"raw":[compact(x) for x in source[3:8]]})
        schedules.append({"id":f"class-{page_no:02d}","code":number.group(1) if number else "","publicCode":public_class_code(name),"name":name,"homeroomTeacher":homeroom,"sourcePage":page_no,"rows":rows})
    return schedules

def read_teacher_links(pdf, classes: list[dict]):
    class_names = sorted((x["name"] for x in classes), key=len, reverse=True)
    id_for = {x["name"]:x["id"] for x in classes}
    records, links, elective_slots, group_slots = {}, defaultdict(list), defaultdict(list), defaultdict(list)
    for page_no, page in enumerate(pdf.pages, 1):
        heading = re.search(r"教師：(.+)", page_text(page))
        if not heading:
            continue
        teacher = compact(heading.group(1))
        code = re.search(r"編號\s*:\s*(\d+)", page_text(page))
        records[teacher] = {"id": code.group(1) if code else f"T{page_no:03d}", "name": teacher}
        for row, source in enumerate((page.extract_table() or [])[1:]):
            for day, raw in enumerate(source[3:8] if len(source) >= 4 else []):
                value = compact(raw)
                if teacher in MULTI_ELECTIVE_ROOMS and "多元選修" in value:
                    elective_slots[teacher].append({"day":day,"row":row,"subject":"多元選修","note":f"上課地點：{MULTI_ELECTIVE_ROOMS[teacher]}","linkable":False})
                matched_classes = [x for x in class_names if x in value]
                if value and not matched_classes and not any(subject in value for subject in ("多元選修", "彈性學習A", "彈性學習B")):
                    subject = re.sub(r"(?:國|高)[一二三][A-Z]?$", "", value)
                    group_slots[teacher].append({"day":day,"row":row,"subject":subject,"grouped":True,"linkable":False,"sourcePage":page_no})
                for class_name in matched_classes:
                    links[(id_for[class_name], day, row)].append({"teacher":teacher,"subject":value.replace(class_name,""),"page":page_no})
    return sorted(records.values(), key=lambda item: int(item["id"]) if item["id"].isdigit() else 9999), links, elective_slots, group_slots

def main():
    with pdfplumber.open(CLASS_PDF) as class_pdf:
        classes = read_classes(class_pdf); class_pages = len(class_pdf.pages)
    with pdfplumber.open(TEACHER_PDF) as teacher_pdf:
        teachers, links, elective_slots, group_slots = read_teacher_links(teacher_pdf, classes); teacher_pages = len(teacher_pdf.pages)
    index = {item["name"]:[] for item in teachers}; unmatched = []
    for schedule in classes:
        for row_no, row in enumerate(schedule["rows"]):
            cells = []
            for day, raw in enumerate((row.pop("raw") + [""] * 5)[:5]):
                matches = list(links.get((schedule["id"],day,row_no),[]))
                manual = MANUAL_COURSES.get(raw)
                if not matches and manual:
                    subject, manual_teacher = manual
                    matches = [{"teacher":manual_teacher,"subject":subject,"page":0}]
                subject = matches[0]["subject"] if matches else raw
                cell = {"subject":subject,"teachers":[{"name":x["teacher"],"sourcePage":x["page"]} for x in matches],"runningClass":running_class(schedule["name"],subject)}
                if raw and not matches: unmatched.append({"class":schedule["name"],"day":DAYS[day],"period":row["period"]["name"],"text":raw})
                for x in matches: index[x["teacher"]].append({"classId":schedule["id"],"className":schedule["name"],"day":day,"row":row_no,"subject":x["subject"]})
                cells.append(cell)
            row["cells"] = cells
    class_map = {item["name"]: item for item in classes}
    for sessions in index.values():
        sessions[:] = [item for item in sessions if item["subject"] != "彈性學習B" and not (item["subject"] == "彈性學習A" and item["className"].startswith("高二"))]
    # These are centrally assigned, not links back to a classroom schedule.
    for teacher_name, room in FLEX_B_ASSIGNMENTS.items():
        index.setdefault(teacher_name, []).append({"className":room,"day":2,"row":3,"subject":"彈性學習B","note":f"上課地點：{room}","linkable":False})
    # Every 高二導師 teaches 彈性學習 A in their own classroom, Wednesday period 4.
    for schedule in (item for item in classes if item["name"].startswith("高二")):
        index.setdefault(schedule["homeroomTeacher"], []).append({"classId":schedule["id"],"className":schedule["name"],"day":2,"row":4,"subject":"彈性學習A","note":f"上課地點：{schedule['name']}","linkable":True})
    for teacher_name, sessions in elective_slots.items():
        index.setdefault(teacher_name, []).extend(sessions)
    for teacher_name, sessions in group_slots.items():
        for session in sessions:
            if not any(item["day"] == session["day"] and item["row"] == session["row"] for item in index[teacher_name]):
                index[teacher_name].append(session)
    payload = {"meta":{"school":"臺南慈濟高中","term":"115 學年度第 1 學期","effectiveDates":"115.08.31 - 116.01.20","days":DAYS,"classPdfPages":class_pages,"teacherPdfPages":teacher_pages},"classes":classes,"teachers":[{**item,"sessions":index[item["name"]]} for item in teachers],"qualityReport":{"unmatchedClassCells":unmatched}}
    OUT.parent.mkdir(exist_ok=True)
    serialized = json.dumps(payload,ensure_ascii=False,indent=2)
    OUT.write_text(serialized,encoding="utf-8")
    WEB_OUT.write_text("window.SCHEDULE_DATA = " + serialized + ";\n",encoding="utf-8")
    print(f"classes={len(classes)} teachers={len(teachers)} linked={sum(map(len,index.values()))} unmatched={len(unmatched)}")

if __name__ == "__main__": main()
