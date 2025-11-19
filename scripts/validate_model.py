"""
Model Validation Script
Validates trained YOLOv8 model on test dataset

Usage:
    python scripts/validate_model.py --weights data/models/construction_manufacturing_v1.pt
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ultralytics import YOLO
from backend.utils.logger import logger
from backend.config import settings


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="Validate YOLOv8 PPE detection model")
    
    parser.add_argument(
        "--weights",
        type=str,
        default="data/models/construction_manufacturing_v1.pt",
        help="Path to trained model weights"
    )
    
    parser.add_argument(
        "--data",
        type=str,
        default="data/datasets/combined/dataset.yaml",
        help="Path to dataset.yaml file"
    )
    
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Image size for validation"
    )
    
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="Confidence threshold"
    )
    
    parser.add_argument(
        "--iou",
        type=float,
        default=0.45,
        help="IoU threshold for NMS"
    )
    
    parser.add_argument(
        "--device",
        type=str,
        default="0",
        help="Device (0 for GPU, 'cpu' for CPU)"
    )
    
    return parser.parse_args()


def validate_model(args):
    """
    Validate trained model
    
    Args:
        args: Parsed command line arguments
    """
    logger.info("=" * 60)
    logger.info("YOLOv8 PPE Detection Model Validation")
    logger.info("=" * 60)
    
    # Validate model path
    model_path = Path(args.weights)
    if not model_path.exists():
        logger.error(f"Model file not found: {model_path}")
        sys.exit(1)
    
    # Validate dataset path
    dataset_path = Path(args.data)
    if not dataset_path.exists():
        logger.error(f"Dataset file not found: {dataset_path}")
        sys.exit(1)
    
    logger.info(f"Model: {model_path}")
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Image size: {args.imgsz}")
    logger.info(f"Confidence threshold: {args.conf}")
    logger.info(f"IoU threshold: {args.iou}")
    logger.info(f"Device: {args.device}")
    
    # Load model
    logger.info("Loading model...")
    model = YOLO(str(model_path))
    
    # Validate
    logger.info("Running validation...")
    try:
        results = model.val(
            data=str(dataset_path),
            imgsz=args.imgsz,
            conf=args.conf,
            iou=args.iou,
            device=args.device,
            plots=True,
        )
        
        logger.info("=" * 60)
        logger.info("Validation completed!")
        logger.info("=" * 60)
        
        # Print metrics
        logger.info("Validation Metrics:")
        logger.info(f"  mAP@0.5: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
        logger.info(f"  mAP@0.5:0.95: {results.results_dict.get('metrics/mAP50-95(B)', 'N/A')}")
        logger.info(f"  Precision: {results.results_dict.get('metrics/precision(B)', 'N/A')}")
        logger.info(f"  Recall: {results.results_dict.get('metrics/recall(B)', 'N/A')}")
        
        # Per-class metrics
        logger.info("\nPer-Class Metrics:")
        for class_name, class_idx in model.names.items():
            logger.info(f"  {class_name}:")
            logger.info(f"    Precision: {results.results_dict.get(f'metrics/precision(B)/class_{class_idx}', 'N/A')}")
            logger.info(f"    Recall: {results.results_dict.get(f'metrics/recall(B)/class_{class_idx}', 'N/A')}")
        
        logger.info("=" * 60)
        logger.info("Validation plots saved to: runs/val/")
        
    except Exception as e:
        logger.error(f"Validation failed: {e}")
        raise


def main():
    """Main validation function"""
    args = parse_args()
    validate_model(args)


if __name__ == "__main__":
    main()

