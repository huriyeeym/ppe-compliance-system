"""
YOLOv8 Model Training Script
Trains PPE detection model using Ultralytics YOLOv8

Usage:
    python scripts/train_model.py --data data/datasets/combined/dataset.yaml --epochs 100
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
    parser = argparse.ArgumentParser(description="Train YOLOv8 PPE detection model")
    
    parser.add_argument(
        "--data",
        type=str,
        default="data/datasets/combined/dataset.yaml",
        help="Path to dataset.yaml file"
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8n.pt",
        help="Pre-trained model (yolov8n.pt, yolov8s.pt, yolov8m.pt, yolov8l.pt, yolov8x.pt)"
    )
    
    parser.add_argument(
        "--epochs",
        type=int,
        default=20,  # CPU için ultra optimize: 30 -> 20 (early stopping ile yeterli)
        help="Number of training epochs (default: 20, early stopping will stop earlier if no improvement)"
    )
    
    parser.add_argument(
        "--batch",
        type=int,
        default=4,  # CPU için ultra optimize: 8 -> 4 (daha hızlı, daha az memory)
        help="Batch size (CPU için 4 önerilir, GPU için 16-32)"
    )
    
    parser.add_argument(
        "--imgsz",
        type=int,
        default=320,  # CPU için ultra optimize: 416 -> 320 (1.7x ek hızlanma)
        help="Image size (320, 416, 640, 800, 1024). CPU için 320 önerilir (en hızlı)."
    )
    
    parser.add_argument(
        "--device",
        type=str,
        default="cpu",
        help="Device ('cpu' for CPU, '0' for GPU, 'auto' for auto-detect)"
    )
    
    parser.add_argument(
        "--workers",
        type=int,
        default=2,  # CPU için ultra optimize: 4 -> 2 (overhead azaltma)
        help="Number of data loading workers (CPU için 2 önerilir, çok yavaşsa)"
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
        default="ppe_detection",
        help="Experiment name"
    )
    
    parser.add_argument(
        "--patience",
        type=int,
        default=10,  # CPU için ultra optimize: 15 -> 10 (daha hızlı durma)
        help="Early stopping patience (epochs without improvement, default: 10)"
    )
    
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save training checkpoints"
    )
    
    parser.add_argument(
        "--save-period",
        type=int,
        default=10,
        help="Save checkpoint every N epochs"
    )
    
    return parser.parse_args()


def train_model(args):
    """
    Train YOLOv8 model
    
    Args:
        args: Parsed command line arguments
    """
    logger.info("=" * 60)
    logger.info("YOLOv8 PPE Detection Model Training")
    logger.info("=" * 60)
    
    # Validate dataset path
    dataset_path = Path(args.data)
    if not dataset_path.exists():
        logger.error(f"Dataset file not found: {dataset_path}")
        logger.info("Please run: python scripts/prepare_dataset.py first")
        sys.exit(1)
    
    # Auto-detect device if 'auto' is specified
    if args.device == "auto":
        import torch
        if torch.cuda.is_available():
            args.device = "0"
            logger.info("GPU detected, using GPU")
        else:
            args.device = "cpu"
            logger.info("No GPU detected, using CPU")
    
    # CPU için otomatik optimizasyonlar
    is_cpu = args.device == "cpu"
    if is_cpu:
        logger.info("=" * 60)
        logger.info("CPU MODE - Agresif Hız Optimizasyonları Aktif")
        logger.info("=" * 60)
        # Image size optimizasyonu (agresif: 416+ ise 320'ye düşür)
        if args.imgsz >= 416:
            logger.info(f"Image size: {args.imgsz} -> 320 (CPU ultra optimizasyonu)")
            args.imgsz = 320
        # Batch size optimizasyonu (agresif: 8+ ise 4'e düşür)
        if args.batch >= 8:
            logger.info(f"Batch size: {args.batch} -> 4 (CPU ultra optimizasyonu)")
            args.batch = 4
        # Workers optimizasyonu (agresif: 4+ ise 2'ye düşür)
        if args.workers >= 4:
            logger.info(f"Workers: {args.workers} -> 2 (CPU ultra optimizasyonu)")
            args.workers = 2
        # Epoch optimizasyonu (agresif: 30+ ise 20'ye düşür)
        if args.epochs >= 30:
            logger.info(f"Epochs: {args.epochs} -> 20 (CPU ultra optimizasyonu)")
            args.epochs = 20
        # Patience optimizasyonu (agresif: 15+ ise 10'a düşür)
        if args.patience >= 15:
            logger.info(f"Patience: {args.patience} -> 10 (CPU ultra optimizasyonu)")
            args.patience = 10
        logger.info("=" * 60)
    
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Model: {args.model}")
    logger.info(f"Epochs: {args.epochs}")
    logger.info(f"Batch size: {args.batch}")
    logger.info(f"Image size: {args.imgsz}")
    logger.info(f"Device: {args.device}")
    logger.info(f"Workers: {args.workers}")
    
    # Load pre-trained model
    logger.info(f"Loading pre-trained model: {args.model}")
    model = YOLO(args.model)
    
    # Training hyperparameters (best practices from research)
    training_args = {
        "data": str(dataset_path),
        "epochs": args.epochs,
        "batch": args.batch,
        "imgsz": args.imgsz,
        "device": args.device,
        "workers": args.workers,
        "project": args.project,
        "name": args.name,
        "patience": args.patience,
        "save": args.save,
        "save_period": args.save_period,
        
        # Learning rate
        "lr0": 0.01,              # Initial learning rate
        "lrf": 0.1,               # Final learning rate (lr0 * lrf)
        "momentum": 0.937,        # SGD momentum
        "weight_decay": 0.0005,   # L2 regularization
        
        # Warmup
        "warmup_epochs": 3,
        "warmup_momentum": 0.8,
        "warmup_bias_lr": 0.1,
        
        # Loss weights
        "box": 7.5,               # Box loss gain
        "cls": 0.5,               # Class loss gain
        "dfl": 1.5,               # DFL loss gain
        
        # Data augmentation
        "hsv_h": 0.015,           # HSV-Hue augmentation
        "hsv_s": 0.7,             # HSV-Saturation augmentation
        "hsv_v": 0.4,             # HSV-Value augmentation
        "degrees": 0.0,           # Rotation augmentation
        "translate": 0.1,         # Translation augmentation
        "scale": 0.5,            # Scale augmentation
        "flipud": 0.0,           # Vertical flip
        "fliplr": 0.5,           # Horizontal flip
        "mosaic": 0.0 if is_cpu else 1.0,  # CPU için mosaic kapat (maksimum hız kazancı)
        "mixup": 0.0,            # Mixup augmentation
        
        # Validation
        "val": True,              # Validate during training
        "plots": False if is_cpu else True,  # CPU için plots kapalı (hız kazancı)
        
        # CPU için özel optimizasyonlar
        "amp": False if is_cpu else True,  # CPU'da AMP kapalı (zaten çalışmaz)
        "cache": False,          # RAM tasarrufu için cache kapalı
    }

    logger.info("Starting training...")
    logger.info("Training arguments:")
    for key, value in training_args.items():
        logger.info(f"  {key}: {value}")
    
    # Train model
    try:
        results = model.train(**training_args)
        
        logger.info("=" * 60)
        logger.info("Training completed successfully!")
        logger.info("=" * 60)
        
        # Print results
        logger.info("Training Results:")
        logger.info(f"  Best mAP@0.5: {results.results_dict.get('metrics/mAP50(B)', 'N/A')}")
        logger.info(f"  Best mAP@0.5:0.95: {results.results_dict.get('metrics/mAP50-95(B)', 'N/A')}")
        logger.info(f"  Best model: {results.save_dir / 'weights' / 'best.pt'}")
        
        # Save model to project models directory
        best_model_path = results.save_dir / "weights" / "best.pt"
        target_model_path = settings.models_dir / "construction_manufacturing_v1.pt"
        
        if best_model_path.exists():
            import shutil
            shutil.copy2(best_model_path, target_model_path)
            logger.info(f"Model saved to: {target_model_path}")
        
        logger.info("=" * 60)
        logger.info("Next steps:")
        logger.info("  1. Review training metrics: tensorboard --logdir runs/train")
        logger.info("  2. Validate model: python scripts/validate_model.py")
        logger.info("  3. Test on real video: python scripts/test_detection.py")
        
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise


def main():
    """Main training function"""
    args = parse_args()
    train_model(args)


if __name__ == "__main__":
    main()

