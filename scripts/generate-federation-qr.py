"""Generate the static QR assets for reviewed Federation destinations."""

from argparse import ArgumentParser
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.graphics.barcode.qrencoder import QRCode, QRErrorCorrectLevel


ROOT = Path(__file__).resolve().parents[1]
DESTINATIONS = {
    "assets/federation/gfof-official-qr.png": "https://tebfun.xyz/token/Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV",
}
MODULE_SIZE = 8
QUIET_MODULES = 4


def qr_png(destination):
    code = QRCode(None, QRErrorCorrectLevel.M)
    code.addData(destination)
    code.make()
    modules = code.getModuleCount()
    side = (modules + 2 * QUIET_MODULES) * MODULE_SIZE
    image = Image.new("1", (side, side), "white")
    draw = ImageDraw.Draw(image)
    for row in range(modules):
        for column in range(modules):
            if code.isDark(row, column):
                x = (column + QUIET_MODULES) * MODULE_SIZE
                y = (row + QUIET_MODULES) * MODULE_SIZE
                draw.rectangle((x, y, x + MODULE_SIZE - 1, y + MODULE_SIZE - 1), fill="black")
    output = BytesIO()
    image.save(output, "PNG", optimize=True)
    return output.getvalue()


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="compare the checked-in PNG files")
    args = parser.parse_args()
    for relative, destination in DESTINATIONS.items():
        path = ROOT / relative
        content = qr_png(destination)
        if args.check:
            if not path.is_file() or path.read_bytes() != content:
                raise SystemExit(f"QR asset needs regeneration: {relative}")
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
        print(f"{relative} → {destination}")


if __name__ == "__main__":
    main()
