# Federation page QR codes

November 27, 2026 · Official GFOF homepage section

Add an optional **Show GFOF QR code** disclosure below the current token links and contract address. A camera scan opens `https://galacticfederation.co/#official-gfof`, where the Federation publishes the current mint, TebFun link, and Solscan link. Display the full destination next to the code so readers can open or verify it directly.

Generate the code as a high-contrast PNG with four quiet modules on all sides. The disclosure works without JavaScript and starts collapsed on every screen size. Ship the image as a first-party static asset.

Use `python3 scripts/generate-federation-qr.py` with ReportLab and Pillow to regenerate the QR assets. `--check` compares the published asset with the source destination. Verify the asset with an independent QR decoder and compare the decoded URL with the visible link. Check keyboard access and narrow layout in the hosted page.
