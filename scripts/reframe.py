import cv2
import sys

input_path, output_path = sys.argv[1:3]
cap = cv2.VideoCapture(input_path)
if not cap.isOpened():
    raise RuntimeError("Não foi possível abrir vídeo para reenquadramento")

fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

out_w, out_h = 720, 1280
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(output_path, fourcc, fps, (out_w, out_h))
if not writer.isOpened():
    raise RuntimeError("Não foi possível criar vídeo reenquadrado")

cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
smooth_x = src_w / 2
last_face_frame = -999
frame_index = 0

def blur_background(frame):
    bg = cv2.resize(frame, (out_w, out_h), interpolation=cv2.INTER_LINEAR)
    bg = cv2.GaussianBlur(bg, (0, 0), 35)
    scale = min(out_w / src_w, out_h / src_h)
    fw, fh = max(1, int(src_w * scale)), max(1, int(src_h * scale))
    fg = cv2.resize(frame, (fw, fh), interpolation=cv2.INTER_AREA)
    x = (out_w - fw) // 2
    y = (out_h - fh) // 2
    bg[y:y+fh, x:x+fw] = fg
    return bg

while True:
    ok, frame = cap.read()
    if not ok:
        break

    target_crop_w = int(src_h * 9 / 16)
    can_crop = target_crop_w <= src_w

    if can_crop and frame_index % 6 == 0:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        small = cv2.resize(gray, None, fx=0.5, fy=0.5)
        faces = cascade.detectMultiScale(small, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
        if len(faces):
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            face_center = (x + w / 2) * 2
            smooth_x = smooth_x * 0.82 + face_center * 0.18
            last_face_frame = frame_index

    if can_crop and frame_index - last_face_frame < fps * 2.5:
        half = target_crop_w / 2
        cx = max(half, min(src_w - half, smooth_x))
        left = int(cx - half)
        crop = frame[:, left:left + target_crop_w]
        out = cv2.resize(crop, (out_w, out_h), interpolation=cv2.INTER_AREA)
    elif can_crop and src_w / src_h > 0.8:
        left = max(0, (src_w - target_crop_w) // 2)
        crop = frame[:, left:left + target_crop_w]
        out = cv2.resize(crop, (out_w, out_h), interpolation=cv2.INTER_AREA)
    else:
        out = blur_background(frame)

    writer.write(out)
    frame_index += 1

cap.release()
writer.release()
