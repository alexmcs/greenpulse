"""PDF certificate generation with QR code — IPCC Tier 1 certified."""
import qrcode
import io
from uuid import UUID
from app.core.config import get_settings

# PDF generation via WeasyPrint
# Template is rendered to HTML then converted to PDF


CERTIFICATE_HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }}
    .header {{ text-align: center; margin-bottom: 30px; }}
    .logo {{ font-size: 28px; font-weight: bold; color: #1DB954; }}
    .title {{ font-size: 20px; margin-top: 10px; }}
    .field {{ margin: 12px 0; }}
    .label {{ font-weight: bold; color: #555; }}
    .qr {{ text-align: center; margin-top: 30px; }}
    .methodology {{ font-size: 11px; color: #888; margin-top: 20px; text-align: center; }}
    .cert-id {{ font-size: 10px; color: #aaa; text-align: center; margin-top: 5px; }}
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🌱 GreenPulse</div>
    <div class="title">Сертификат верификации посадки дерева</div>
  </div>
  <div class="field"><span class="label">Владелец:</span> {display_name}</div>
  <div class="field"><span class="label">Вид растения:</span> {species_latin} ({species_common_ru})</div>
  <div class="field"><span class="label">GPS координаты:</span> {lat}, {lng}</div>
  <div class="field"><span class="label">Дата верификации:</span> {issued_at}</div>
  <div class="field"><span class="label">CO₂ поглощение:</span> {co2_kg_year} кг/год</div>
  <div class="qr"><img src="data:image/png;base64,{qr_base64}" width="150" height="150"/></div>
  <div class="methodology">Расчёт выполнен по методологии IPCC Tier 1, версия 1.0</div>
  <div class="cert-id">Сертификат ID: {certificate_id}</div>
</body>
</html>
"""


def generate_qr_code(url: str) -> bytes:
    """Generate QR code PNG bytes for the given URL."""
    qr = qrcode.make(url)
    buffer = io.BytesIO()
    qr.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_certificate_pdf(
    certificate_id: UUID,
    display_name: str,
    species_latin: str,
    species_common_ru: str,
    lat: float,
    lng: float,
    issued_at: str,
    co2_kg_year: float,
) -> bytes:
    """
    Render HTML certificate and convert to PDF via WeasyPrint.
    Returns PDF bytes.
    """
    import base64
    from weasyprint import HTML

    settings = get_settings()
    qr_url = f"{settings.CERTIFICATE_BASE_URL}/{certificate_id}"
    qr_bytes = generate_qr_code(qr_url)
    qr_base64 = base64.b64encode(qr_bytes).decode()

    html_content = CERTIFICATE_HTML_TEMPLATE.format(
        display_name=display_name,
        species_latin=species_latin,
        species_common_ru=species_common_ru,
        lat=round(lat, 4),
        lng=round(lng, 4),
        issued_at=issued_at,
        co2_kg_year=co2_kg_year,
        qr_base64=qr_base64,
        certificate_id=certificate_id,
    )
    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes
