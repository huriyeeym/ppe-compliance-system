"""
Quick Model Evaluation Script
Validates model and shows metrics

Usage:
    python scripts/quick_eval.py --model runs/train/ppe_progressive_chatgpt_stage2/weights/best.pt
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ultralytics import YOLO
from backend.utils.logger import logger


def main():
    parser = argparse.ArgumentParser(description="Quick Model Evaluation")
    parser.add_argument("--model", type=str, required=True, help="Path to model (.pt file)")
    parser.add_argument("--data", type=str, default="data/datasets/construction_final/dataset.yaml", help="Dataset YAML")
    args = parser.parse_args()

    model_path = Path(args.model)
    if not model_path.exists():
        logger.error(f"Model not found: {model_path}")
        sys.exit(1)

    logger.info("=" * 60)
    logger.info("QUICK MODEL EVALUATION")
    logger.info("=" * 60)
    logger.info(f"Model: {model_path}")
    logger.info(f"Dataset: {args.data}")
    logger.info("")

    # Load model
    model = YOLO(str(model_path))

    # Run validation
    logger.info("Running validation...")
    results = model.val(data=args.data)

    # Print results
    logger.info("")
    logger.info("=" * 60)
    logger.info("RESULTS")
    logger.info("=" * 60)
    logger.info(f"mAP@0.5:      {results.box.map50:.4f}  {'✅ GOOD' if results.box.map50 >= 0.80 else '⚠️  LOW' if results.box.map50 >= 0.60 else '❌ POOR'}")
    logger.info(f"mAP@0.5:0.95: {results.box.map:.4f}")
    logger.info(f"Precision:    {results.box.mp:.4f}")
    logger.info(f"Recall:       {results.box.mr:.4f}")
    logger.info("=" * 60)

    # Per-class metrics
    logger.info("")
    logger.info("Per-class metrics:")
    class_names = model.names
    for i, name in class_names.items():
        if i < len(results.box.maps):
            map50 = results.box.maps[i]
            logger.info(f"  {name:15s}: mAP@0.5 = {map50:.4f}")

    logger.info("=" * 60)


if __name__ == "__main__":
    main()
