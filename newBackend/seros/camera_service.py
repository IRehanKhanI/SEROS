import base64
import logging
import os
import threading
import time
from io import BytesIO

from PIL import Image

logger = logging.getLogger("seros.camera")

_service_thread = None
_running = False
_camera_enabled = True
_last_detect_call = 0.0
_active_cap = None


def mark_external_detection():
    """Call when an external client (browser or mobile) sends a frame to /api/detect/."""
    global _last_detect_call
    _last_detect_call = time.time()


def is_camera_enabled() -> bool:
    global _camera_enabled
    return _camera_enabled


def set_camera_enabled(enabled: bool):
    global _camera_enabled, _active_cap
    _camera_enabled = bool(enabled)
    logger.info("SEROS Camera enabled set to %s", _camera_enabled)
    if not _camera_enabled and _active_cap is not None:
        try:
            _active_cap.release()
        except Exception:
            pass
        _active_cap = None


def start_camera_service():
    """Start background camera capture loop (runs every 3 seconds)."""
    global _service_thread, _running
    if _running:
        return
    _running = True
    _service_thread = threading.Thread(target=_camera_loop, daemon=True, name="seros-camera-worker")
    _service_thread.start()
    logger.info("Background SEROS camera worker started (3-second capture loop).")


def stop_camera_service():
    global _running, _active_cap
    _running = False
    if _active_cap is not None:
        try:
            _active_cap.release()
        except Exception:
            pass
        _active_cap = None


def _camera_loop():
    global _active_cap
    import cv2
    from .models import Section
    from .views import process_image_and_record

    fail_count = 0

    while _running:
        try:
            # If camera is globally turned off by user on website, pause and release
            if not _camera_enabled:
                if _active_cap is not None:
                    try:
                        _active_cap.release()
                    except Exception:
                        pass
                    _active_cap = None
                time.sleep(1.0)
                continue

            # If an external client (browser or mobile) is already sending frames via /api/detect/
            # in the last 20 seconds, yield camera control completely to avoid webcam lock/conflicts.
            if time.time() - _last_detect_call < 20.0:
                if _active_cap is not None:
                    try:
                        _active_cap.release()
                    except Exception:
                        pass
                    _active_cap = None
                time.sleep(1.5)
                continue

            if _active_cap is None or not _active_cap.isOpened():
                _active_cap = cv2.VideoCapture(0, cv2.CAP_DSHOW if os.name == 'nt' else cv2.CAP_ANY)
                if not _active_cap.isOpened():
                    fail_count += 1
                    if fail_count % 5 == 1:
                        logger.warning("Webcam 0 could not be opened by background worker (may be in use by browser).")
                    time.sleep(8.0)
                    continue

            ret, frame = _active_cap.read()
            if not ret or frame is None:
                fail_count += 1
                if _active_cap is not None:
                    _active_cap.release()
                    _active_cap = None
                time.sleep(3.0)
                continue

            fail_count = 0
            # Convert OpenCV BGR to PIL RGB
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_image = Image.fromarray(rgb_frame)

            # Get default section (usually section 1)
            section = Section.objects.first()
            if section and _camera_enabled:
                process_image_and_record(pil_image, section_id=section.id)

        except Exception as exc:
            logger.error("Error in camera loop: %s", exc)
            if _active_cap is not None:
                try:
                    _active_cap.release()
                except Exception:
                    pass
                _active_cap = None

        time.sleep(3.0)

    if _active_cap is not None:
        try:
            _active_cap.release()
        except Exception:
            pass
        _active_cap = None
