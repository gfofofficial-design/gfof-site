# Federation page QR codes

November 27, 2026 · GFOF token page on TebFun

The **Show GFOF QR code** disclosure sits below the current token links and contract address. A camera scan opens `https://tebfun.xyz/token/Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV`. The destination matches the homepage's current trading link and is visible next to the code.

Generate the code as a high-contrast PNG with four quiet modules on all sides. The disclosure works without JavaScript and starts collapsed on every screen size. The homepage uses a new image cache key when the destination changes.

Use `python3 scripts/generate-federation-qr.py` with ReportLab and Pillow to regenerate the QR assets. `--check` compares the published asset with the source destination. Verify the asset with an independent QR decoder and compare the decoded URL with the visible link. Check keyboard access and narrow layout in the hosted page.
