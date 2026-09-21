import json
import sys
from faster_whisper import WhisperModel

audio_path, output_path, model_name, compute_type = sys.argv[1:5]

model = WhisperModel(model_name, device="cpu", compute_type=compute_type)
segments, info = model.transcribe(
    audio_path,
    beam_size=5,
    vad_filter=True,
    word_timestamps=True,
)

result = {
    "language": info.language or "pt",
    "duration": info.duration,
    "segments": [],
}

for segment in segments:
    words = []
    for word in segment.words or []:
        if word.start is None or word.end is None:
            continue
        words.append({
            "word": word.word.strip(),
            "start": float(word.start),
            "end": float(word.end),
        })
    result["segments"].append({
        "start": float(segment.start),
        "end": float(segment.end),
        "text": segment.text.strip(),
        "words": words,
    })

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False)
