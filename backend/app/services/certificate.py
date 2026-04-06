"""
PDF certificate generation with embedded QR code.

Stack:
  - qrcode[pil]  — QR code PNG generation
  - WeasyPrint   — HTML → PDF conversion
  - Pillow       — PNG → base64 embedding

Certificate contains:
  • GreenPulse logo + tagline
  • Owner name
  • Species (Latin + Russian)
  • GPS (rounded to 4 decimals ≈ 11m — GDPR)
  • Verification date
  • CO₂: X кг/год (min–max range)
  • QR code → https://greenpulse.app/verify/{certificate_id}
  • Methodology footnote: IPCC Tier 1 v1.0
  • Unique Certificate ID
"""
import base64
import io
import logging
from datetime import datetime
from uuid import UUID

import qrcode
from qrcode.image.pil import PilImage

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# ------------------------------------------------------------------ HTML template

_CERTIFICATE_HTML = """<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <style>
    @page {{
      size: A4;
      margin: 0;
    }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Arial', sans-serif;
      background: #f9fff9;
      color: #1a2a1a;
      width: 210mm;
      min-height: 297mm;
      padding: 20mm 22mm;
    }}

    /* Header */
    .header {{
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 3px solid #1DB954;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }}
    .logo-block .logo {{ font-size: 26px; font-weight: bold; color: #1DB954; }}
    .logo-block .tagline {{ font-size: 11px; color: #5A7A5A; margin-top: 2px; }}
    .cert-number {{ font-size: 10px; color: #aaa; text-align: right; }}

    /* Title */
    .title {{
      text-align: center;
      font-size: 20px;
      font-weight: bold;
      color: #0D4020;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin: 18px 0 24px;
    }}

    /* Fields */
    .fields-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px 28px;
      margin-bottom: 28px;
    }}
    .field {{ border-left: 3px solid #1DB954; padding-left: 10px; }}
    .field .label {{ font-size: 10px; color: #5A7A5A; text-transform: uppercase; letter-spacing: 0.5px; }}
    .field .value {{ font-size: 14px; font-weight: bold; color: #1a2a1a; margin-top: 2px; }}
    .field .sub {{ font-size: 11px; color: #7a9a7a; }}

    /* CO₂ highlight */
    .co2-block {{
      background: #e8f5e9;
      border: 2px solid #1DB954;
      border-radius: 8px;
      padding: 14px 20px;
      text-align: center;
      margin-bottom: 28px;
    }}
    .co2-block .co2-value {{ font-size: 32px; font-weight: bold; color: #0D4020; }}
    .co2-block .co2-label {{ font-size: 12px; color: #5A7A5A; margin-top: 4px; }}
    .co2-block .co2-range {{ font-size: 10px; color: #7a9a7a; margin-top: 2px; }}

    /* QR */
    .qr-section {{
      display: flex;
      align-items: center;
      gap: 24px;
      border-top: 1px solid #d0e8d0;
      padding-top: 20px;
      margin-bottom: 24px;
    }}
    .qr-section img {{ width: 110px; height: 110px; }}
    .qr-text .qr-title {{ font-size: 13px; font-weight: bold; color: #0D4020; }}
    .qr-text .qr-url {{ font-size: 10px; color: #5A7A5A; margin-top: 4px; word-break: break-all; }}

    /* Footer */
    .footer {{
      font-size: 9px;
      color: #aaa;
      border-top: 1px solid #d0e8d0;
      padding-top: 10px;
      text-align: center;
      line-height: 1.6;
    }}
    .footer a {{ color: #1DB954; }}
  </style>
</head>
<body>

  <div class="header">
    <div class="logo-block">
      <div class="logo">🌱 GreenPulse</div>
      <div class="tagline">Верификация посадки деревьев · greenpulse.app</div>
    </div>
    <div class="cert-number">
      Сертификат<br>
      <strong>{certificate_id_short}</strong>
    </div>
  </div>

  <div class="title">Сертификат верификации посадки дерева</div>

  <div class="fields-grid">
    <div class="field">
      <div class="label">Владелец</div>
      <div class="value">{display_name}</div>
    </div>
    <div class="field">
      <div class="label">Дата верификации</div>
      <div class="value">{issued_at_date}</div>
      <div class="sub">{issued_at_time} UTC</div>
    </div>
    <div class="field">
      <div class="label">Вид растения</div>
      <div class="value">{species_latin}</div>
      <div class="sub">{species_common_ru}</div>
    </div>
    <div class="field">
      <div class="label">GPS координаты</div>
      <div class="value">{lat}°N, {lng}°E</div>
      <div class="sub">Точность ≈ 11 м (GDPR)</div>
    </div>
  </div>

  <div class="co2-block">
    <div class="co2-value">{co2_kg_year} кг CO₂ / год</div>
    <div class="co2-label">Поглощение углекислого газа по методологии IPCC Tier 1 v1.0</div>
    <div class="co2-range">Диапазон: {co2_min}–{co2_max} кг/год</div>
  </div>

  <div class="qr-section">
    <img src="data:image/png;base64,{qr_base64}" alt="QR verification code">
    <div class="qr-text">
      <div class="qr-title">Верификация сертификата</div>
      <div class="qr-url">{qr_url}</div>
      <div class="qr-url" style="margin-top:8px; color:#1a2a1a;">
        Отсканируйте QR-код или перейдите по ссылке, чтобы подтвердить<br>
        подлинность этого сертификата на сайте GreenPulse.
      </div>
    </div>
  </div>

  <div class="footer">
    Расчёт поглощения CO₂ выполнен по методологии IPCC Tier 1, версия 1.0 ·
    Сертификат ID: {certificate_id} ·
    Выдан: {issued_at_full} UTC ·
    <a href="https://greenpulse.app/privacy">Privacy Policy</a>
  </div>

</body>
</html>
"""


# ------------------------------------------------------------------ public API

def generate_qr_code(url: str) -> bytes:
    """Return QR code as PNG bytes."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=6,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img: PilImage = qr.make_image(fill_color="#0D4020", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def generate_certificate_pdf(
    certificate_id: UUID,
    display_name: str,
    species_latin: str,
    species_common_ru: str,
    lat: float,
    lng: float,
    issued_at: datetime,
    co2_kg_year: float,
    co2_min: float,
    co2_max: float,
) -> tuple[bytes, str]:
    """
    Render the HTML certificate and convert to PDF via WeasyPrint.
    Returns (pdf_bytes, qr_url).
    """
    from weasyprint import HTML  # deferred import — heavy startup

    settings = get_settings()
    qr_url = f"{settings.CERTIFICATE_BASE_URL}/{certificate_id}"
    qr_bytes = generate_qr_code(qr_url)
    qr_base64 = base64.b64encode(qr_bytes).decode()

    cert_id_str = str(certificate_id)

    html_content = _CERTIFICATE_HTML.format(
        certificate_id=cert_id_str,
        certificate_id_short=cert_id_str[:8].upper(),
        display_name=display_name or "GreenPulse User",
        species_latin=species_latin,
        species_common_ru=species_common_ru or "—",
        lat=f"{lat:.4f}",
        lng=f"{lng:.4f}",
        issued_at_date=issued_at.strftime("%d.%m.%Y"),
        issued_at_time=issued_at.strftime("%H:%M"),
        issued_at_full=issued_at.strftime("%d.%m.%Y %H:%M"),
        co2_kg_year=f"{co2_kg_year:.1f}",
        co2_min=f"{co2_min:.0f}",
        co2_max=f"{co2_max:.0f}",
        qr_base64=qr_base64,
        qr_url=qr_url,
    )

    pdf_bytes = HTML(string=html_content).write_pdf()
    logger.info("Certificate PDF generated: %s (%d bytes)", certificate_id, len(pdf_bytes))
    return pdf_bytes, qr_url
