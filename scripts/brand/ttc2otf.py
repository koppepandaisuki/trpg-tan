"""TTC(フォントコレクション)から 1 書体を取り出して単体の OTF/TTF にする(標準ライブラリのみ)。"""
import struct, sys
src, idx, out = sys.argv[1], int(sys.argv[2]), sys.argv[3]
b = open(src, "rb").read()
assert b[:4] == b"ttcf"
n = struct.unpack(">I", b[8:12])[0]
offs = struct.unpack(">%dI" % n, b[12:12 + 4 * n])
o = offs[idx]
ver = b[o:o + 4]
num = struct.unpack(">H", b[o + 4:o + 6])[0]
recs = []
for i in range(num):
    tag, cs, off, ln = struct.unpack(">4sIII", b[o + 12 + 16 * i:o + 28 + 16 * i])
    recs.append((tag, cs, off, ln))
def name_of(recs):
    for tag, cs, off, ln in recs:
        if tag == b"name":
            fmt, count, so = struct.unpack(">HHH", b[off:off + 6])
            for k in range(count):
                pid, eid, lid, nid, l, no = struct.unpack(">HHHHHH", b[off + 6 + 12 * k:off + 18 + 12 * k])
                if nid == 4 and pid == 3 and lid == 0x409:
                    return b[off + so + no:off + so + no + l].decode("utf-16-be")
print("fonts in collection:", n, "| picked:", name_of(recs))
es = max(k for k in range(16) if 2 ** k <= num)
hdr = ver + struct.pack(">HHHH", num, 2 ** es * 16, es, num * 16 - 2 ** es * 16)
pos = 12 + 16 * num
data = b""
table_recs = b""
for tag, cs, off, ln in sorted(recs):
    chunk = b[off:off + ln]
    table_recs += struct.pack(">4sIII", tag, cs, pos + len(data), ln)
    data += chunk + b"\0" * ((4 - ln % 4) % 4)
open(out, "wb").write(hdr + table_recs + data)
print("wrote", out, len(hdr + table_recs + data), "bytes")
