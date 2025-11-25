"""
Simple GPU Training Script - Only Valid YOLO Parameters
Guaranteed to work without parameter errors

Usage:
    python scripts/train_simple_gpu.py
"""

import sys
from pathlib import Path
import torch

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ultralytics import YOLO
from backend.utils.logger import logger


def main():
    """Simple, reliable GPU training"""

    logger.info("=" * 80)
    logger.info("SIMPLE GPU TRAINING - Construction PPE Detection")
    logger.info("=" * 80)

    # Check GPU
    if not torch.cuda.is_available():
        logger.error("GPU not available!")
        sys.exit(1)

    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
    logger.info(f"GPU: {gpu_name}")
    logger.info(f"VRAM: {gpu_memory:.2f} GB")
    logger.info("")

    # Dataset
    dataset_path = "data/datasets/construction_final/dataset.yaml"
    if not Path(dataset_path).exists():
        logger.error(f"Dataset not found: {dataset_path}")
        sys.exit(1)

    # Configuration - FAST and RELIABLE
    logger.info("Configuration:")
    logger.info("  Model: YOLOv8s (fast, good accuracy)")
    logger.info("  Image size: 416 (balanced speed/accuracy)")
    logger.info("  Batch: 12 (optimized for 4GB VRAM)")
    logger.info("  Epochs: 80 (with early stopping)")
    logger.info("  Patience: 12 (stop if no improvement)")
    logger.info("")

    # Load model
    logger.info("Loading YOLOv8s model...")
    model = YOLO("yolov8s.pt")

    # Training args - ONLY VALID PARAMETERS
    training_args = {
        # Basic
        "data": dataset_path,
        "epochs": 80,
        "batch": 12,
        "imgsz": 416,
        "device": 0,
        "workers": 4,

        # Save
        "project": "runs/train",
        "name": "construction_simple_gpu",
        "save": True,
        "save_period": 10,
        "patience": 12,

        # Learning rate
        "lr0": 0.01,
        "lrf": 0.01,
        "momentum": 0.937,
        "weight_decay": 0.0005,

        # Warmup
        "warmup_epochs": 3,
        "warmup_momentum": 0.8,
        "warmup_bias_lr": 0.1,

        # Loss weights
        "box": 7.5,
        "cls": 0.5,
        "dfl": 1.5,

        # Augmentation
        "hsv_h": 0.015,
        "hsv_s": 0.7,
        "hsv_v": 0.4,
        "degrees": 10.0,
        "translate": 0.1,
        "scale": 0.5,
        "shear": 5.0,
        "perspective": 0.0001,
        "flipud": 0.0,
        "fliplr": 0.5,
        "mosaic": 1.0,
        "mixup": 0.1,
        "copy_paste": 0.1,

        # Validation
        "val": True,
        "plots": True,
        "save_json": True,

        # GPU optimizations
        "amp": True,
        "cache": False,
        "optimizer": "auto",
        "verbose": True,
        "seed": 42,
    }

    logger.info("=" * 80)
    logger.info("Starting training...")
    logger.info("Expected time: 1-2 hours")
    logger.info("Target: mAP@0.5 > 0.75")
    logger.info("=" * 80)
    logger.info("")

    try:
        # Train
        results = model.train(**training_args)

        logger.info("")
        logger.info("=" * 80)
        logger.info("TRAINING COMPLETED!")
        logger.info("=" * 80)

        # Validate
        best_model_path = results.save_dir / "weights" / "best.pt"
        logger.info(f"Best model: {best_model_path}")
        logger.info("")

        logger.info("Validating best model...")
        best_model = YOLO(str(best_model_path))
        val_results = best_model.val(data=dataset_path)

        logger.info("")
        logger.info("=" * 80)
        logger.info("FINAL METRICS")
        logger.info("=" * 80)
        logger.info(f"mAP@0.5:      {val_results.box.map50:.4f}")
        logger.info(f"mAP@0.5:0.95: {val_results.box.map:.4f}")
        logger.info(f"Precision:    {val_results.box.mp:.4f}")
        logger.info(f"Recall:       {val_results.box.mr:.4f}")
        logger.info("=" * 80)

        # Check target
        if val_results.box.map50 >= 0.75:
            logger.info("")
            logger.info("SUCCESS! mAP@0.5 >= 0.75")
        else:
            logger.info("")
            logger.info(f"Current mAP@0.5: {val_results.box.map50:.4f}, Target: 0.75")

        logger.info("")
        logger.info("=" * 80)
        logger.info("NEXT STEPS")
        logger.info("=" * 80)
        logger.info("Test on webcam:")
        logger.info(f"  python scripts/test_webcam.py --model {best_model_path}")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
