"""Utilities to dispatch emergency alerts via Twilio when an SOS is triggered."""

import logging
from html import escape
from typing import Any, Dict, Iterable, List, Optional

try:  # pragma: no cover - optional dependency loaded lazily
    from twilio.base.exceptions import TwilioException  # type: ignore[attr-defined]
    from twilio.rest import Client  # type: ignore[attr-defined]
except ImportError as exc:  # pragma: no cover
    TwilioException = Exception  # type: ignore[assignment]
    Client = None  # type: ignore[assignment]
    _IMPORT_ERROR = exc
else:
    _IMPORT_ERROR = None

from config import Config

logger = logging.getLogger(__name__)


def _parse_recipient_list(raw: Any) -> List[str]:
    """Normalise recipient definitions into a flat list of numbers."""
    recipients: List[str] = []

    if raw is None:
        return recipients

    if isinstance(raw, (list, tuple, set)):
        iterable: Iterable[Any] = raw
    else:
        iterable = str(raw).split(",")

    for item in iterable:
        if not item:
            continue
        if isinstance(item, dict):
            number = item.get("number") or item.get("to")
        else:
            number = str(item)
        if number:
            cleaned = number.strip()
            if cleaned:
                recipients.append(cleaned)
    return recipients


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _build_map_link(lat: Optional[float], lon: Optional[float]) -> Optional[str]:
    if lat is None or lon is None:
        return None
    return f"https://www.google.com/maps/search/?api=1&query={lat:.6f},{lon:.6f}"


class EmergencyAlertService:
    """Encapsulates Twilio interactions for emergency escalation."""

    _client: Optional[Any] = None

    @classmethod
    def _get_client(cls):
        if _IMPORT_ERROR is not None or Client is None:
            raise ValueError("Twilio dependency not installed. Please add 'twilio' to backend requirements.")
        if not Config.TWILIO_ACCOUNT_SID or not Config.TWILIO_AUTH_TOKEN:
            raise ValueError("Twilio credentials are not configured")
        if cls._client is None:
            cls._client = Client(Config.TWILIO_ACCOUNT_SID, Config.TWILIO_AUTH_TOKEN)
        return cls._client

    @classmethod
    def dispatch_alerts(
        cls,
        *,
        name: str,
        location_label: Optional[str],
        home_coordinates: Optional[Dict[str, Any]] = None,
        device_coordinates: Optional[Dict[str, Any]] = None,
        contacts: Optional[Dict[str, Any]] = None,
        additional_message: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Send voice, SMS, and WhatsApp alerts. Returns metadata about each attempt."""

        sms_targets = _parse_recipient_list(contacts.get("sms") if contacts else None)
        whatsapp_targets = _parse_recipient_list(contacts.get("whatsapp") if contacts else None)
        voice_targets = _parse_recipient_list(contacts.get("voice") if contacts else None)

        if not sms_targets:
            sms_targets = _parse_recipient_list(Config.TWILIO_ALERT_SMS_TO)
        if not whatsapp_targets:
            whatsapp_targets = _parse_recipient_list(Config.TWILIO_ALERT_WHATSAPP_TO)
        if not voice_targets:
            voice_targets = _parse_recipient_list(Config.TWILIO_ALERT_CALL_TO)

        if not any([sms_targets, whatsapp_targets, voice_targets]):
            raise ValueError("No emergency recipients configured. Set TWILIO_ALERT_* environment variables.")

        home_lat = _safe_float((home_coordinates or {}).get("lat"))
        home_lon = _safe_float((home_coordinates or {}).get("lon"))
        device_lat = _safe_float((device_coordinates or {}).get("lat"))
        device_lon = _safe_float((device_coordinates or {}).get("lon"))

        map_link = _build_map_link(device_lat or home_lat, device_lon or home_lon)

        base_lines = [
            f"SOS alert for {name or 'an unknown traveller'}",
            f"Reported location: {location_label or 'Not provided'}",
        ]

        if home_lat is not None and home_lon is not None:
            base_lines.append(f"Registered coordinates: {home_lat:.5f}, {home_lon:.5f}")
        if device_lat is not None and device_lon is not None:
            base_lines.append(f"Live GPS fix: {device_lat:.5f}, {device_lon:.5f}")
        if map_link:
            base_lines.append(f"Map: {map_link}")
        if additional_message:
            base_lines.append(additional_message)

        sms_body = ". ".join(base_lines) + ". Please respond immediately."

        whatsapp_lines = ["*HeritEdge SOS Alert*"] + base_lines + ["Please call back immediately and dispatch help."]
        whatsapp_body = "\n".join(whatsapp_lines)

        traveller_name = name or "an unidentified traveller"

        voice_segments = [
            "Alert. This is the HeritEdge emergency desk calling.",
            f"Traveller {traveller_name} has pressed the SOS button.",
        ]

        if location_label:
            voice_segments.append(f"Their reported location is {location_label}.")
        else:
            voice_segments.append("No descriptive location was provided.")

        if home_lat is not None and home_lon is not None:
            voice_segments.append(
                f"Registered coordinates are latitude {home_lat:.5f} and longitude {home_lon:.5f}."
            )
        if device_lat is not None and device_lon is not None:
            voice_segments.append(
                f"Live GPS fix reads latitude {device_lat:.5f} and longitude {device_lon:.5f}."
            )
        if map_link:
            voice_segments.append("A WhatsApp message with a live Google Maps link has been sent to this number.")

        voice_segments.extend([
            "Please return the call immediately and dispatch assistance.",
            "Repeating the emergency information now.",
        ])

        voice_message = " ".join(voice_segments[:-1])  # Exclude the repeat prompt from the first pass

        voice_twiml = (
            "<Response>"
            "<Pause length='1'/>"
            f"<Say voice='alice' language='en-IN'>{escape(voice_message)}</Say>"
            "<Pause length='1.5'/>"
            f"<Say voice='alice' language='en-IN'>{escape('Repeating the emergency information now.')}</Say>"
            "<Pause length='0.5'/>"
            f"<Say voice='alice' language='en-IN'>{escape(voice_message)}</Say>"
            "</Response>"
        )

        client = cls._get_client()

        results: Dict[str, Any] = {"voice": [], "sms": [], "whatsapp": [], "errors": [], "map_link": map_link}

        # Voice call first, as requested
        if voice_targets:
            if not Config.TWILIO_VOICE_FROM_NUMBER:
                results["errors"].append({
                    "channel": "voice",
                    "error": "TWILIO_VOICE_FROM_NUMBER is not configured",
                })
            else:
                for number in voice_targets:
                    try:
                        call = client.calls.create(
                            to=number,
                            from_=Config.TWILIO_VOICE_FROM_NUMBER,
                            twiml=voice_twiml,
                        )
                        results["voice"].append({"to": number, "sid": call.sid})
                    except TwilioException as exc:
                        logger.error("Twilio voice call failed for %s: %s", number, exc)
                        results["errors"].append({"channel": "voice", "to": number, "error": str(exc)})

        # SMS alerts
        if sms_targets:
            if not Config.TWILIO_SMS_FROM_NUMBER:
                results["errors"].append({
                    "channel": "sms",
                    "error": "TWILIO_SMS_FROM_NUMBER is not configured",
                })
            else:
                for number in sms_targets:
                    try:
                        message = client.messages.create(
                            body=sms_body,
                            from_=Config.TWILIO_SMS_FROM_NUMBER,
                            to=number,
                        )
                        results["sms"].append({"to": number, "sid": message.sid})
                    except TwilioException as exc:
                        logger.error("Twilio SMS failed for %s: %s", number, exc)
                        results["errors"].append({"channel": "sms", "to": number, "error": str(exc)})

        # WhatsApp alerts
        if whatsapp_targets:
            if not Config.TWILIO_WHATSAPP_FROM_NUMBER:
                results["errors"].append({
                    "channel": "whatsapp",
                    "error": "TWILIO_WHATSAPP_FROM_NUMBER is not configured",
                })
            else:
                for number in whatsapp_targets:
                    try:
                        formatted_to = number if number.startswith("whatsapp:") else f"whatsapp:{number}"
                        message = client.messages.create(
                            body=whatsapp_body,
                            from_=Config.TWILIO_WHATSAPP_FROM_NUMBER,
                            to=formatted_to,
                        )
                        results["whatsapp"].append({"to": formatted_to, "sid": message.sid})
                    except TwilioException as exc:
                        logger.error("Twilio WhatsApp failed for %s: %s", number, exc)
                        results["errors"].append({"channel": "whatsapp", "to": number, "error": str(exc)})

        if not any([results["voice"], results["sms"], results["whatsapp"]]):
            # If nothing succeeded, surface the first error
            error_message = (
                results["errors"][0]["error"]
                if results["errors"]
                else "Emergency alert dispatch failed with no additional details"
            )
            raise RuntimeError(error_message)

        logger.info(
            "Emergency SOS dispatched: voice=%s sms=%s whatsapp=%s",
            len(results["voice"]),
            len(results["sms"]),
            len(results["whatsapp"]),
        )

        return results
