"""
scan_service.py — Unified scan pipeline orchestrator.

Combines YOLO object detection + conditional face recognition into
a single per-frame call.  This replaces the old dual-loop architecture
where scene narration and face polling ran independently.

Flow:
  1. Run YOLO via yolo_service.detect_with_positions()
       → spatial labels  ("bike on left, person ahead")
       → hazard flag
  2. If YOLO detected a 'person' class:
       → Run face_service.process_frame() on the same frame
       → Merge recognised names into the spatial labels
         e.g. "bike on left, Aman ahead"
  3. Return unified ScanResult dict to the router.
"""

from services import yolo_service, face_service


def unified_scan(base64_frame: str) -> dict:
    """
    One-shot scan for a single camera frame.

    Returns:
        {
            "labels": str,              # short spatial summary
            "hazard": bool,
            "hazard_type": str | None,
            "person_detected": bool,
            "faces": list[dict],        # face results (only if person detected)
        }
    """

    # ── Step 1: YOLO detection ─────────────────────────────────────────────
    yolo_result = yolo_service.detect_with_positions(base64_frame)

    labels = yolo_result["labels"]
    hazard = yolo_result["hazard"]
    hazard_type = yolo_result["hazard_type"]
    person_detected = yolo_result["person_detected"]
    detections = yolo_result["detections"]

    face_results: list[dict] = []

    # ── Step 2: Conditional face recognition ───────────────────────────────
    if person_detected:
        raw_faces = face_service.process_frame(base64_frame)

        for r in raw_faces:
            face_results.append({
                "name": r["name"],
                "known": r["known"],
                "encoding_hash": r["encoding_hash"],
                "position": r["position"],
                "should_announce": r["should_announce"],
                "should_enroll_prompt": r["should_enroll_prompt"],
            })

        # ── Merge face names into spatial labels ───────────────────────────
        # Replace generic "person <zone>" with actual name if recognised
        labels = _merge_face_labels(labels, raw_faces, detections)

    return {
        "labels": labels,
        "hazard": hazard,
        "hazard_type": hazard_type,
        "person_detected": person_detected,
        "faces": face_results,
    }


def _merge_face_labels(labels: str, faces: list[dict], detections: list[dict]) -> str:
    """
    Replace 'person ahead' with 'Aman ahead' for known+announced faces.
    Unknown faces keep 'person <zone>'.
    """
    if not faces:
        return labels

    # Find person detections to map face positions to YOLO zones
    person_dets = [d for d in detections if d["class"] == "person"]

    for face in faces:
        if not face["known"] or not face["name"]:
            continue

        # Find which person detection this face overlaps with
        face_pos = face["position"]  # {top, right, bottom, left}
        face_cx = (face_pos["left"] + face_pos["right"]) / 2

        # Find the closest person bounding box by center-x distance
        best_zone = None
        best_dist = float("inf")
        for pd in person_dets:
            pd_cx = (pd["box"]["x1"] + pd["box"]["x2"]) / 2
            dist = abs(face_cx - pd_cx)
            if dist < best_dist:
                best_dist = dist
                # Determine zone from the person detection box
                # We need frame width — estimate from the detection
                # Use the same zone logic as yolo_service
                best_zone = _face_zone(face_cx, person_dets, detections)

        if best_zone:
            # Replace "person <zone>" with "Name <zone>"
            old = f"person {best_zone}"
            new = f"{face['name']} {best_zone}"
            if old in labels:
                labels = labels.replace(old, new, 1)

    return labels


def _face_zone(face_cx: float, person_dets: list[dict], all_dets: list[dict]) -> str | None:
    """Determine the spatial zone for a face based on frame geometry."""
    # Estimate frame width from the max x2 across all detections
    if not all_dets:
        return None

    max_x = max(d["box"]["x2"] for d in all_dets)
    # Frame width is at least max_x, but likely a bit more.
    # Use a reasonable estimate: if max_x < 640, assume 640. Otherwise max_x * 1.05
    frame_w = max(max_x * 1.1, 640)

    third = frame_w / 3
    if face_cx < third:
        return "on left"
    elif face_cx < 2 * third:
        return "ahead"
    else:
        return "on right"
