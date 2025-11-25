"""
Real-time Webcam PPE Detection Demo
Tests the trained model with live webcam feed

Usage:
    python scripts/test_webcam.py --model runs/train/ppe_progressive_chatgpt_stage2/weights/best.pt
"""

import argparse
import sys
from pathlib import Path
import cv2
import time

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ultralytics import YOLO
from backend.utils.logger import logger


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Real-time Webcam PPE Detection")

    parser.add_argument(
        "--model",
        type=str,
        default="runs/train/ppe_progressive_chatgpt_stage2/weights/best.pt",
        help="Path to trained model"
    )

    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold (0.0-1.0)"
    )

    parser.add_argument(
        "--device",
        type=str,
        default="0",
        help="Device (0 for GPU, 'cpu' for CPU)"
    )

    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Camera index (default: 0)"
    )

    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="Camera width"
    )

    parser.add_argument(
        "--height",
        type=int,
        default=480,
        help="Camera height"
    )

    return parser.parse_args()


def draw_detections(frame, results, class_names):
    """
    Draw bounding boxes and labels on frame

    Args:
        frame: OpenCV frame
        results: YOLO detection results
        class_names: List of class names

    Returns:
        Annotated frame
    """
    for result in results:
        boxes = result.boxes

        for box in boxes:
            # Get box coordinates
            x1, y1, x2, y2 = box.xyxy[0].cpu().numpy().astype(int)
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            class_name = class_names[cls]

            # Color based on class
            if class_name == "person":
                color = (255, 255, 0)  # Cyan for person
            elif class_name == "hard_hat":
                color = (0, 255, 0)    # Green for hard_hat
            elif class_name == "safety_vest":
                color = (0, 165, 255)  # Orange for safety_vest
            else:
                color = (255, 255, 255)  # White for unknown

            # Draw bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Draw label background
            label = f"{class_name} {conf:.2f}"
            (label_w, label_h), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(frame, (x1, y1 - label_h - 10), (x1 + label_w, y1), color, -1)

            # Draw label text
            cv2.putText(frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    return frame


def check_compliance(results, class_names):
    """
    Check PPE compliance (person must wear hard_hat and safety_vest)

    Args:
        results: YOLO detection results
        class_names: List of class names

    Returns:
        Tuple of (has_person, has_hard_hat, has_safety_vest, is_compliant)
    """
    has_person = False
    has_hard_hat = False
    has_safety_vest = False

    for result in results:
        boxes = result.boxes
        for box in boxes:
            cls = int(box.cls[0])
            class_name = class_names[cls]

            if class_name == "person":
                has_person = True
            elif class_name == "hard_hat":
                has_hard_hat = True
            elif class_name == "safety_vest":
                has_safety_vest = True

    # Compliant if person detected AND both hard_hat and safety_vest detected
    is_compliant = has_person and has_hard_hat and has_safety_vest

    return has_person, has_hard_hat, has_safety_vest, is_compliant


def draw_compliance_status(frame, has_person, has_hard_hat, has_safety_vest, is_compliant):
    """Draw compliance status on frame"""
    h, w = frame.shape[:2]

    # Status panel
    panel_height = 120
    panel = frame[0:panel_height, 0:w].copy()
    panel[:] = (0, 0, 0)  # Black background
    cv2.addWeighted(panel, 0.7, frame[0:panel_height, 0:w], 0.3, 0, frame[0:panel_height, 0:w])

    # Overall status
    if not has_person:
        status_text = "NO PERSON DETECTED"
        status_color = (128, 128, 128)  # Gray
    elif is_compliant:
        status_text = "COMPLIANT"
        status_color = (0, 255, 0)  # Green
    else:
        status_text = "VIOLATION"
        status_color = (0, 0, 255)  # Red

    cv2.putText(frame, status_text, (10, 30), cv2.FONT_HERSHEY_BOLD, 1.0, status_color, 2)

    # Individual checks
    y_offset = 60
    checks = [
        ("Person", has_person),
        ("Hard Hat", has_hard_hat),
        ("Safety Vest", has_safety_vest)
    ]

    for check_name, detected in checks:
        color = (0, 255, 0) if detected else (0, 0, 255)
        symbol = "✓" if detected else "✗"
        text = f"{symbol} {check_name}"
        cv2.putText(frame, text, (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        y_offset += 25

    return frame


def main():
    """Main function"""
    args = parse_args()

    logger.info("=" * 60)
    logger.info("Real-time Webcam PPE Detection Demo")
    logger.info("=" * 60)

    # Check model exists
    model_path = Path(args.model)
    if not model_path.exists():
        logger.error(f"Model not found: {model_path}")
        logger.info("Available models:")
        for model_file in Path("runs/train").rglob("best.pt"):
            logger.info(f"  - {model_file}")
        sys.exit(1)

    logger.info(f"Model: {model_path}")
    logger.info(f"Device: {args.device}")
    logger.info(f"Confidence threshold: {args.conf}")
    logger.info(f"Camera: {args.camera}")

    # Load model
    logger.info("Loading model...")
    model = YOLO(str(model_path))
    class_names = model.names
    logger.info(f"Classes: {class_names}")

    # Check device
    import torch
    if args.device == "0" and not torch.cuda.is_available():
        logger.warning("GPU requested but CUDA not available, using CPU")
        args.device = "cpu"

    logger.info(f"Using device: {args.device}")

    # Open webcam
    logger.info("Opening webcam...")
    cap = cv2.VideoCapture(args.camera)

    if not cap.isOpened():
        logger.error("Failed to open webcam")
        sys.exit(1)

    # Set camera resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    logger.info("")
    logger.info("=" * 60)
    logger.info("DEMO STARTED")
    logger.info("=" * 60)
    logger.info("Controls:")
    logger.info("  - Press 'q' to quit")
    logger.info("  - Press 's' to save screenshot")
    logger.info("=" * 60)
    logger.info("")

    frame_count = 0
    fps_start_time = time.time()
    fps = 0

    try:
        while True:
            # Read frame
            ret, frame = cap.read()
            if not ret:
                logger.error("Failed to read frame")
                break

            # Run detection
            results = model(frame, conf=args.conf, device=args.device, verbose=False)

            # Check compliance
            has_person, has_hard_hat, has_safety_vest, is_compliant = check_compliance(results, class_names)

            # Draw detections
            frame = draw_detections(frame, results, class_names)

            # Draw compliance status
            frame = draw_compliance_status(frame, has_person, has_hard_hat, has_safety_vest, is_compliant)

            # Calculate FPS
            frame_count += 1
            if frame_count % 30 == 0:
                fps_end_time = time.time()
                fps = 30 / (fps_end_time - fps_start_time)
                fps_start_time = fps_end_time

            # Draw FPS
            cv2.putText(frame, f"FPS: {fps:.1f}", (frame.shape[1] - 150, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

            # Show frame
            cv2.imshow("PPE Detection Demo - Press 'q' to quit", frame)

            # Handle key press
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('s'):
                # Save screenshot
                screenshot_path = f"screenshot_{int(time.time())}.jpg"
                cv2.imwrite(screenshot_path, frame)
                logger.info(f"Screenshot saved: {screenshot_path}")

    except KeyboardInterrupt:
        logger.info("Interrupted by user")

    finally:
        # Cleanup
        cap.release()
        cv2.destroyAllWindows()
        logger.info("Demo stopped")


if __name__ == "__main__":
    main()
