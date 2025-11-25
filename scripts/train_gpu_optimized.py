"""
GPU-Optimized Training Script for Construction PPE Detection
Target: mAP@0.5 > 0.80 within 1-2 hours on RTX 3050 4GB

Key optimizations:
- YOLOv8m model (better accuracy than yolov8n)
- Batch size optimized for 4GB VRAM
- Mixed precision training (FP16)
- Aggressive augmentation
- Early stopping

Usage:
    python scripts/train_gpu_optimized.py --data data/datasets/construction_final/dataset.yaml
"""

import argparse
import sys
from pathlib import Path
import torch

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ultralytics import YOLO
from backend.utils.logger import logger


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description="GPU-Optimized PPE Detection Training")

    parser.add_argument(
        "--data",
        type=str,
        default="data/datasets/construction_final/dataset.yaml",
        help="Path to dataset.yaml file"
    )

    parser.add_argument(
        "--model",
        type=str,
        default="yolov8m.pt",
        help="Pre-trained model (yolov8n.pt, yolov8s.pt, yolov8m.pt, yolov8l.pt)"
    )

    parser.add_argument(
        "--epochs",
        type=int,
        default=100,
        help="Maximum number of epochs"
    )

    parser.add_argument(
        "--batch",
        type=int,
        default=16,
        help="Batch size (default: 16 for 4GB VRAM)"
    )

    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Image size (640 recommended for accuracy)"
    )

    parser.add_argument(
        "--patience",
        type=int,
        default=15,
        help="Early stopping patience"
    )

    parser.add_argument(
        "--project",
        type=str,
        default="runs/train",
        help="Project directory"
    )

    parser.add_argument(
        "--name",
        type=str,
        default="construction_gpu_optimized",
        help="Experiment name"
    )

    return parser.parse_args()


def main():
    """Main training function"""
    args = parse_args()

    logger.info("=" * 80)
    logger.info("GPU-OPTIMIZED TRAINING - Construction PPE Detection")
    logger.info("=" * 80)

    # Check GPU
    if not torch.cuda.is_available():
        logger.error("GPU not available! This script requires CUDA GPU.")
        logger.error("Please install PyTorch with CUDA support:")
        logger.error("  pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121")
        sys.exit(1)

    gpu_name = torch.cuda.get_device_name(0)
    gpu_memory = torch.cuda.get_device_properties(0).total_memory / 1024**3
    logger.info(f"GPU: {gpu_name}")
    logger.info(f"VRAM: {gpu_memory:.2f} GB")
    logger.info("")

    # Validate dataset
    dataset_path = Path(args.data)
    if not dataset_path.exists():
        logger.error(f"Dataset not found: {dataset_path}")
        sys.exit(1)

    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Model: {args.model}")
    logger.info(f"Epochs: {args.epochs} (early stopping: {args.patience})")
    logger.info(f"Batch size: {args.batch}")
    logger.info(f"Image size: {args.imgsz}")
    logger.info("")

    # Load model
    logger.info("Loading pre-trained model...")
    model = YOLO(args.model)

    # Training configuration (GPU-optimized)
    training_args = {
        "data": str(dataset_path),
        "epochs": args.epochs,
        "batch": args.batch,
        "imgsz": args.imgsz,
        "device": 0,  # GPU 0
        "workers": 4,  # Data loading workers
        "project": args.project,
        "name": args.name,
        "patience": args.patience,
        "save": True,
        "save_period": 10,

        # Learning rate (optimized for fine-tuning)
        "lr0": 0.01,              # Initial learning rate
        "lrf": 0.01,              # Final learning rate (lr0 * lrf)
        "momentum": 0.937,        # SGD momentum
        "weight_decay": 0.0005,   # L2 regularization

        # Warmup
        "warmup_epochs": 3,
        "warmup_momentum": 0.8,
        "warmup_bias_lr": 0.1,

        # Loss weights (balanced for construction PPE)
        "box": 7.5,               # Box loss gain
        "cls": 0.5,               # Class loss gain
        "dfl": 1.5,               # DFL loss gain

        # Data augmentation (aggressive for better generalization)
        "hsv_h": 0.015,           # HSV-Hue augmentation
        "hsv_s": 0.7,             # HSV-Saturation augmentation
        "hsv_v": 0.4,             # HSV-Value augmentation
        "degrees": 10.0,          # Rotation augmentation (±10 degrees)
        "translate": 0.1,         # Translation augmentation
        "scale": 0.5,             # Scale augmentation (0.5x - 1.5x)
        "shear": 5.0,             # Shear augmentation
        "perspective": 0.0001,    # Perspective augmentation
        "flipud": 0.0,            # Vertical flip (disabled for construction)
        "fliplr": 0.5,            # Horizontal flip
        "mosaic": 1.0,            # Mosaic augmentation (enabled)
        "mixup": 0.1,             # Mixup augmentation (10% chance)
        "copy_paste": 0.1,        # Copy-paste augmentation (10% chance)

        # Validation
        "val": True,              # Validate during training
        "plots": True,            # Save training plots
        "save_json": True,        # Save results as JSON

        # GPU optimizations
        "amp": True,              # Mixed precision (FP16) - faster training
        "cache": False,           # Don't cache images (save VRAM)
        "rect": False,            # Rectangular training (disabled for mosaic)
        "resume": False,          # Don't resume from previous training
        "exist_ok": False,        # Don't overwrite existing experiment
        "pretrained": True,       # Use pre-trained weights
        "optimizer": "auto",      # Auto-select optimizer (SGD or Adam)
        "verbose": True,          # Verbose output
        "seed": 42,               # Random seed for reproducibility
    }

    logger.info("=" * 80)
    logger.info("TRAINING CONFIGURATION")
    logger.info("=" * 80)
    logger.info("Hyperparameters:")
    for key, value in training_args.items():
        logger.info(f"  {key:20s}: {value}")
    logger.info("=" * 80)
    logger.info("")

    logger.info("Starting training...")
    logger.info("Expected time: 1-2 hours on RTX 3050")
    logger.info("Target: mAP@0.5 > 0.80")
    logger.info("")

    try:
        # Train model
        results = model.train(**training_args)

        logger.info("")
        logger.info("=" * 80)
        logger.info("TRAINING COMPLETED!")
        logger.info("=" * 80)

        # Get final metrics
        best_model_path = results.save_dir / "weights" / "best.pt"
        logger.info(f"Best model: {best_model_path}")
        logger.info("")

        # Validate best model
        logger.info("Validating best model...")
        best_model = YOLO(str(best_model_path))
        val_results = best_model.val(data=str(dataset_path))

        logger.info("")
        logger.info("=" * 80)
        logger.info("FINAL METRICS")
        logger.info("=" * 80)
        logger.info(f"mAP@0.5:      {val_results.box.map50:.4f}")
        logger.info(f"mAP@0.5:0.95: {val_results.box.map:.4f}")
        logger.info(f"Precision:    {val_results.box.mp:.4f}")
        logger.info(f"Recall:       {val_results.box.mr:.4f}")
        logger.info("=" * 80)

        # Check if target met
        if val_results.box.map50 >= 0.80:
            logger.info("")
            logger.info("🎉 TARGET ACHIEVED! mAP@0.5 >= 0.80")
            logger.info("")
        else:
            logger.info("")
            logger.info(f"⚠️  Target not met. Current mAP@0.5: {val_results.box.map50:.4f}, Target: 0.80")
            logger.info("Consider:")
            logger.info("  - Training longer (increase --epochs)")
            logger.info("  - Using larger model (YOLOv8l)")
            logger.info("  - Collecting more training data")
            logger.info("")

        logger.info("=" * 80)
        logger.info("NEXT STEPS")
        logger.info("=" * 80)
        logger.info("1. Test model on webcam:")
        logger.info(f"   python scripts/test_webcam.py --model {best_model_path}")
        logger.info("")
        logger.info("2. Export to ONNX (faster inference):")
        logger.info(f"   python scripts/export_model_onnx.py --model {best_model_path}")
        logger.info("")
        logger.info("3. Benchmark performance:")
        logger.info(f"   python scripts/benchmark_inference.py --model {best_model_path}")
        logger.info("=" * 80)

    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
