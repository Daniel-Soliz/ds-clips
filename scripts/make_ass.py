import json
import sys

output_path, style_name, words_json = sys.argv[1:4]
words = json.loads(words_json)

styles = {
    "neon": {"font": "DejaVu Sans", "size": 64, "primary": "&H00FFFFFF", "secondary": "&H0000FFAA", "outline": "&H00101010", "outline_w": 5},
    "clean": {"font": "Liberation Sans", "size": 56, "primary": "&H00FFFFFF", "secondary": "&H00FFFFFF", "outline": "&H00101010", "outline_w": 3},
    "pop": {"font": "DejaVu Sans", "size": 68, "primary": "&H0000FFFF", "secondary": "&H0000A5FF", "outline": "&H00000000", "outline_w": 6},
    "cinema": {"font": "Liberation Serif", "size": 50, "primary": "&H00FFFFFF", "secondary": "&H00DDDDDD", "outline": "&H00151515", "outline_w": 3},
    "minimal": {"font": "DejaVu Sans", "size": 48, "primary": "&H00FFFFFF", "secondary": "&H00B8FF7A", "outline": "&H00000000", "outline_w": 2},
}
style = styles.get(style_name, styles["neon"])

def ass_time(seconds):
    seconds = max(0.0, float(seconds))
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h}:{m:02d}:{s:05.2f}"

header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,{style["font"]},{style["size"]},{style["primary"]},{style["secondary"]},{style["outline"]},&H80000000,-1,0,0,0,100,100,0,0,1,{style["outline_w"]},1,2,45,45,170,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""

groups = []
current = []
for word in words:
    if not word.get("word"):
        continue
    current.append(word)
    duration = current[-1]["end"] - current[0]["start"]
    if len(current) >= 4 or duration >= 2.4:
        groups.append(current)
        current = []
if current:
    groups.append(current)

lines = []
for group in groups:
    start = group[0]["start"]
    end = group[-1]["end"] + 0.18
    parts = []
    for word in group:
        cs = max(1, int(round((word["end"] - word["start"]) * 100)))
        safe = str(word["word"]).replace("{", "(").replace("}", ")")
        parts.append("{\\k" + str(cs) + "}" + safe)
    text = " ".join(parts)
    lines.append("Dialogue: 0," + ass_time(start) + "," + ass_time(end) + ",Default,,0,0,0,," + text)

with open(output_path, "w", encoding="utf-8-sig") as f:
    f.write(header + "\n".join(lines) + "\n")
