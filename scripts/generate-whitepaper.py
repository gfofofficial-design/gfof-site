from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

OUT = "whitepaper.pdf"
NAVY = colors.HexColor("#030716")
PANEL = colors.HexColor("#091329")
GOLD = colors.HexColor("#F0C040")
CYAN = colors.HexColor("#40C0FF")
GREEN = colors.HexColor("#3DFFA0")
TEXT = colors.HexColor("#E6EBFF")
MUTED = colors.HexColor("#A9B4D0")

styles = getSampleStyleSheet()
title = ParagraphStyle("Title", parent=styles["Title"], fontName="Helvetica-Bold", fontSize=29, leading=31, textColor=TEXT, alignment=TA_CENTER, spaceAfter=16)
h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=GOLD, spaceAfter=12)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=CYAN, spaceBefore=8, spaceAfter=5)
body = ParagraphStyle("Body", parent=styles["BodyText"], fontName="Helvetica", fontSize=9.4, leading=14, textColor=TEXT, spaceAfter=7)
small = ParagraphStyle("Small", parent=body, fontSize=7.8, leading=11, textColor=MUTED)
tag = ParagraphStyle("Tag", parent=small, alignment=TA_CENTER, textColor=GREEN, spaceAfter=12)

def footer(canvas, doc):
    canvas.saveState(); canvas.setFillColor(NAVY); canvas.rect(0,0,A4[0],A4[1],fill=1,stroke=0)
    canvas.setStrokeColor(colors.HexColor("#1D2A46")); canvas.line(18*mm,15*mm,A4[0]-18*mm,15*mm)
    canvas.setFont("Helvetica",7); canvas.setFillColor(MUTED)
    canvas.drawString(18*mm,10*mm,"GFOF WHITEPAPER v1.1 · 2026-09-02")
    canvas.drawRightString(A4[0]-18*mm,10*mm,str(doc.page))
    canvas.restoreState()

def section(name, heading, paragraphs, rows=None):
    story.extend([Paragraph(name, tag), Paragraph(heading, h1)])
    for p in paragraphs: story.append(Paragraph(p, body))
    if rows:
        table=Table(rows, colWidths=[38*mm,132*mm], hAlign="LEFT")
        table.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PANEL),("BOX",(0,0),(-1,-1),0.6,colors.HexColor("#1D2A46")),("INNERGRID",(0,0),(-1,-1),0.3,colors.HexColor("#1D2A46")),("TEXTCOLOR",(0,0),(-1,-1),TEXT),("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),("FONTNAME",(1,0),(-1,-1),"Helvetica"),("FONTSIZE",(0,0),(-1,-1),8),("LEADING",(0,0),(-1,-1),11),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),7),("RIGHTPADDING",(0,0),(-1,-1),7),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7)]))
        story.extend([Spacer(1,4*mm),table])
    story.append(PageBreak())

doc=SimpleDocTemplate(OUT,pagesize=A4,rightMargin=18*mm,leftMargin=18*mm,topMargin=19*mm,bottomMargin=19*mm,title="Galactic Federation of Finance Whitepaper v1.1",author="Galactic Federation of Finance")
story=[Spacer(1,35*mm),Paragraph("GF // FEDERATION OS",tag),Paragraph("FEDERATION<br/>WHITEPAPER",title),Paragraph("GFOF_WHITEPAPER_v1.1",tag),Spacer(1,8*mm),Paragraph("Research-first DeFi on Solana. Public specifications before code. Permanent corrections for every commitment.",ParagraphStyle("Lead",parent=body,fontSize=14,leading=20,alignment=TA_CENTER,textColor=MUTED)),Spacer(1,12*mm),Paragraph("CONTRACT ADDRESS",tag),Paragraph("2oQmHWoTZRmRLregHKjBSGJy3ueX3iRNzimy2iZCmoon",ParagraphStyle("CA",parent=small,alignment=TA_CENTER,textColor=GOLD)),Spacer(1,18*mm),Paragraph("This document is informational only. It is not financial, legal, or tax advice and makes no promise of returns or future value.",ParagraphStyle("Notice",parent=small,alignment=TA_CENTER)),PageBreak()]

section("SECTION 01", "Mission and operating discipline", ["The Federation exists to make financial research, public design, and accountable execution easier to inspect. Wealth-growth language refers to a member's own tools, knowledge, and decisions - never to token appreciation.","The operating order is fixed: publish research, specify mechanisms, invite criticism, implement, audit, then consider launch. The append-only corrections log controls whenever a summary and the public record disagree."], [["VERIFY","galacticfederation.co/corrections"],["SECURITY","galacticfederation.co/security"],["RESEARCH","galacticfederation.co/research"]])
section("SECTION 02", "Federation systems", ["Command is the public entry point. Dossier is the intelligence arm and is currently in MEASUREMENT REVIEW: detection is halted while the original convergence thesis is measured. FCC is the public experiment record; Epoch 2 remains BLOCKED and intake is not authorized.","The Federation Record accepts falsifiable, dated, sourced forecasts under published rules. Council governance is advisory; no treasury, repository, site, or token authority is represented as decentralized."], [["COMMAND","galacticfederation.co"],["DOSSIER","dossiertrack.co - MEASUREMENT REVIEW"],["FCC","fcc.galacticfederation.co - EPOCH 2 BLOCKED"],["ARCHIVE","galacticfederation.co/record"]])
section("SECTION 03", "Token and treasury", ["$GFOF is an SPL token on Solana with a fixed total supply of 1,000,000,000. The canonical contract address is printed on the cover and must be verified character-by-character.","Distribution is recorded as 77% community and liquidity, 10% rewards and reserve, and 13% developer allocation locked across four active Streamflow contracts. The Treasury page links every contract and independent explorer path.","The Moonshot bond target is $73K market capitalization. No date for reaching it is promised."], [["SUPPLY","1,000,000,000 $GFOF"],["LOCKED","130,000,000 - 13% - four active contracts"],["VERIFY","galacticfederation.co/treasury"]])
section("SECTION 04", "Governance boundaries", ["The Realms deployment is advisory and gated to the $GFOF mint. The locked 13% developer allocation cannot vote. Binding authority migration is post-bond work and requires explicit recorded action.","One token equals one advisory vote under the published configuration, but voting does not imply custody or execution authority. The project makes no broader decentralization claim."], [["SPEC","galacticfederation.co/governance-spec"],["CURRENT SCOPE","Advisory only"],["AUTHORITY","Not routed through the DAO"]])
section("SECTION 05", "Roadmap with receipts", ["The roadmap is a status map, not a calendar. Operational systems, active gates, specifications, research, and uncommitted work are separated. Dates appear only after a dated commitment is recorded.","Status can change faster than this document. The live roadmap and append-only corrections log are the current sources for gates, reviews, and completed work."], [["STATUS MAP","galacticfederation.co/roadmap"],["CONTROLLING RECORD","galacticfederation.co/corrections"],["NO IMPLIED LAUNCH","A specification is not a deployed product"]])
section("SECTION 06", "Specifications and research", ["Published design documents cover governance, borrower-protective liquidation, access boundaries, and the creator-fee mechanism. These documents describe constraints and intended mechanics; they do not prove implementation or authorize launch.","Post-quantum work is research only. No migration is planned and no quantum-security claim is made."], [["LIQUIDATION","galacticfederation.co/liquidation-spec"],["ACCESS","galacticfederation.co/access-spec"],["CREATOR FEES","galacticfederation.co/creator-fee-spec"],["POST-QUANTUM","galacticfederation.co/faq#quantum"]])
section("SECTION 07", "What is not committed", ["No staking specification exists. No APY, reward rate, lock tier, multiplier, or launch date is committed. The Founding Member NFT carries no promised boost, yield, governance weight, investment value, or access utility.","No lending launch date, exchange-listing date, return promise, price floor, passive-income claim, or price prediction is made. Holding $GFOF does not itself produce yield.","If a future system is proposed, its specification and risks must be published before code and audited before any launch claim."], [["STAKING","NOT COMMITTED"],["NFT UTILITY","NOT COMMITTED"],["RETURNS","NEVER PROMISED"],["SOURCE OF TRUTH","galacticfederation.co/corrections"]])
section("SECTION 08", "Verification and notices", ["Verify material claims independently. Use Solana explorers and Streamflow for locks, GitHub and the FCC record for published artifacts, and the corrections log for commitments and supersessions.","This document is informational only. Digital assets are volatile and can lose all value. Nothing here is an offer, solicitation, recommendation, or promise of performance. Consult your own legal, tax, and financial advisers.","Where this whitepaper and the live corrections log disagree, the live corrections log controls and the discrepancy is itself a loggable event."], [["SITE","galacticfederation.co"],["WHITEPAPER","galacticfederation.co/whitepaper.pdf"],["ROADMAP","galacticfederation.co/roadmap"],["SECURITY","security@galacticfederation.co"],["OFFICIAL X","@GFOF_Offcial"],["TELEGRAM","t.me/GFOF_SOL"]])

doc.build(story,onFirstPage=footer,onLaterPages=footer)
