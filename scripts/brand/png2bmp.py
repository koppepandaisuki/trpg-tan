"""PNG(8bit RGB/RGBA, 非インターレース)→ 32bit BMP(BITMAPINFOHEADER, 下から上, BI_RGB)。
NSIS のインストーラー画像用。既存の header.bmp / sidebar.bmp と同じ形式で書く。"""
import struct, sys, zlib
src, dst = sys.argv[1], sys.argv[2]
data = open(src, "rb").read()
pos = 8; idat = b""
while pos < len(data):
    ln, = struct.unpack(">I", data[pos:pos + 4]); typ = data[pos + 4:pos + 8]; body = data[pos + 8:pos + 8 + ln]; pos += 12 + ln
    if typ == b"IHDR": w, h, bd, ct, _, _, il = struct.unpack(">IIBBBBB", body)
    elif typ == b"IDAT": idat += body
assert bd == 8 and il == 0 and ct in (2, 6), (bd, ct, il)
bpp = 3 if ct == 2 else 4
raw = zlib.decompress(idat); stride = w * bpp
prev = bytearray(stride); rows = []; i = 0
for y in range(h):
    f = raw[i]; i += 1; line = bytearray(raw[i:i + stride]); i += stride
    for x in range(stride):
        a = line[x - bpp] if x >= bpp else 0; b = prev[x]; c = prev[x - bpp] if x >= bpp else 0
        if f == 1: line[x] = (line[x] + a) & 255
        elif f == 2: line[x] = (line[x] + b) & 255
        elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
        elif f == 4:
            p = a + b - c; pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
            line[x] = (line[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
    rows.append(bytes(line)); prev = line
pix = bytearray()
for row in reversed(rows):  # 下の行から
    for x in range(w):
        r, g, b_ = row[x * bpp], row[x * bpp + 1], row[x * bpp + 2]
        pix += bytes((b_, g, r, 255))  # BGRA、不透明
info = struct.pack("<IiiHHIIiiII", 40, w, h, 1, 32, 0, len(pix), 3780, 3780, 0, 0)
head = struct.pack("<2sIHHI", b"BM", 14 + 40 + len(pix), 0, 0, 54)
open(dst, "wb").write(head + info + pix)
print(dst, w, h)
