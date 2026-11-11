"""Draw the 2D IM geometry template. Stdlib only."""
from __future__ import annotations

import struct
import zlib
from pathlib import Path

SIZE = 2048
FAR0, FAR1 = SIZE // 4, SIZE * 3 // 4  # 512, 1536
CX = SIZE // 2

# image y-down. lights on ceiling trapezoid (y=0..512), u=0.5
# GL v 0.93 / 0.86 / 0.79 → y = (1-v)*SIZE
LIGHTS = [
    ("near", int((1 - 0.93) * SIZE)),  # 143, 近窗
    ("mid", int((1 - 0.86) * SIZE)),   # 287
    ("far", int((1 - 0.79) * SIZE)),   # 430, 靠远墙
]


def mix(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] * (1 - t) + b[i] * t) for i in range(3))  # type: ignore[return-value]


def main() -> None:
    px = [[(24, 24, 28) for _ in range(SIZE)] for _ in range(SIZE)]

    def setp(x: int, y: int, c: tuple[int, int, int]) -> None:
        if 0 <= x < SIZE and 0 <= y < SIZE:
            px[y][x] = c

    def line(x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int], w: int = 3) -> None:
        dx, dy = abs(x1 - x0), abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx - dy
        x, y = x0, y0
        while True:
            for ox in range(-w, w + 1):
                for oy in range(-w, w + 1):
                    if ox * ox + oy * oy <= w * w:
                        setp(x + ox, y + oy, c)
            if x == x1 and y == y1:
                break
            e2 = 2 * err
            if e2 > -dy:
                err -= dy
                x += sx
            if e2 < dx:
                err += dx
                y += sy

    def rect(x0: int, y0: int, x1: int, y1: int, c: tuple[int, int, int], w: int = 4) -> None:
        line(x0, y0, x1, y0, c, w)
        line(x1, y0, x1, y1, c, w)
        line(x1, y1, x0, y1, c, w)
        line(x0, y1, x0, y0, c, w)

    def disk(cx: int, cy: int, r: int, c: tuple[int, int, int]) -> None:
        for y in range(cy - r, cy + r + 1):
            for x in range(cx - r, cx + r + 1):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    setp(x, y, c)

    # 25% grid
    grid = (48, 48, 56)
    for i in range(1, 4):
        p = i * SIZE // 4
        line(p, 0, p, SIZE - 1, grid, 1)
        line(0, p, SIZE - 1, p, grid, 1)

    # fill far-wall square faintly
    fill = (42, 48, 58)
    for y in range(FAR0, FAR1):
        for x in range(FAR0, FAR1):
            px[y][x] = fill

    # ceiling / floor / wall tints
    ceil_c, floor_c, wall_c = (36, 40, 52), (40, 36, 32), (34, 38, 44)
    for y in range(SIZE):
        for x in range(SIZE):
            if FAR0 <= x < FAR1 and FAR0 <= y < FAR1:
                continue
            # which trapezoid: compare against rays from far corners to image corners
            # ceiling: above the top edge of far wall, between the two top rays
            in_ceil = y < FAR0
            in_floor = y >= FAR1
            if in_ceil:
                px[y][x] = mix(px[y][x], ceil_c, 0.85)
            elif in_floor:
                px[y][x] = mix(px[y][x], floor_c, 0.85)
            else:
                px[y][x] = mix(px[y][x], wall_c, 0.7)

    yellow = (232, 196, 72)
    cyan = (88, 196, 220)
    white = (236, 236, 240)
    red = (220, 80, 80)

    # rays: far-wall corners → image corners
    line(FAR0, FAR0, 0, 0, cyan, 4)
    line(FAR1, FAR0, SIZE - 1, 0, cyan, 4)
    line(FAR0, FAR1, 0, SIZE - 1, cyan, 4)
    line(FAR1, FAR1, SIZE - 1, SIZE - 1, cyan, 4)

    rect(FAR0, FAR0, FAR1 - 1, FAR1 - 1, white, 5)

    # center axis (lights live on this line, ceiling only)
    line(CX, 0, CX, FAR0, yellow, 2)

    for _, ly in LIGHTS:
        disk(CX, ly, 28, yellow)
        disk(CX, ly, 12, (24, 24, 28))

    # crosshair at far-wall center (vanishing point)
    line(CX - 40, CX, CX + 40, CX, red, 3)
    line(CX, CX - 40, CX, CX + 40, red, 3)

    raw = b"".join(b"\x00" + bytes(ch for p in row for ch in p) for row in px)

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", SIZE, SIZE, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    out = Path(__file__).with_name("template-2d.png")
    out.write_bytes(png)
    print("wrote", out, "bytes", len(png))


if __name__ == "__main__":
    main()
