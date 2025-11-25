"""
Progressive Training Script - Two-Stage Fine-tuning
Stage 1: Freeze backbone, train head only (fast)
Stage 2: Unfreeze, increase image size (better accuracy)

Based on ChatGPT recommendations and literature:
- Freeze layers for faster training (1.7-2x speedup)
- Progressive resizing for better accuracy
- Literature: arXiv:2509.05490, MosaicML Composer

Usage:
    python scripts/train_progressive.py --data data/datasets/construction_subset/dataset.yaml
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ultralytics import YOLO
from backend.utils.logger import logger


def train_stage1(model_path: str, data_path: str, output_dir: Path, args):
    """
    Stage 1: Freeze backbone, train head only (fast)
    
    Args:
        model_path: Path to pre-trained model
        data_path: Path to dataset.yaml
        output_dir: Output directory for stage 1
        args: Command line arguments
    """
    logger.info("=" * 60)
    logger.info("STAGE 1: Head-Only Fine-tuning (Fast)")
    logger.info("=" * 60)
    logger.info("Strategy: Freeze backbone, train only head")
    logger.info("Expected: 1.7-2x faster than full fine-tuning")
    logger.info("")
    
    model = YOLO(model_path)
    
    # Freeze backbone layers (first N layers: model.0 to model.N-1)
    freeze_count = args.freeze_stage1 or 10
    logger.info(f"Freezing first {freeze_count} backbone layers (model.0 to model.{freeze_count-1})...")
    
    frozen_params = 0
    trainable_params = 0
    
    for name, param in model.model.named_parameters():
        # Freeze backbone layers (first N layers: model.0, model.1, ..., model.N-1)
        # Extract layer number from name (e.g., "model.5" -> 5)
        try:
            layer_num = int(name.split('.')[1]) if '.' in name else -1
            if layer_num >= 0 and layer_num < freeze_count:
                param.requires_grad = False
                frozen_params += param.numel()
            else:
                trainable_params += param.numel()
        except (ValueError, IndexError):
            # If we can't parse layer number, don't freeze (likely head layers)
            trainable_params += param.numel()
    
    logger.info(f"Frozen parameters: {frozen_params:,}")
    logger.info(f"Trainable parameters: {trainable_params:,}")
    logger.info("")
    
    # Stage 1 training args
    training_args = {
        "data": data_path,
        "epochs": args.epochs_stage1 or 10,
        "batch": args.batch,
        "imgsz": args.imgsz_stage1 or 320,
        "device": args.device,
        "workers": args.workers,
        "project": str(output_dir.parent),
        "name": output_dir.name,
        "patience": args.patience_stage1 or 5,
        "save": True,
        "save_period": 5,
        
        # Learning rate (slightly higher for head-only)
        "lr0": args.lr0 or 0.01,
        "lrf": 0.1,
        "momentum": 0.937,
        "weight_decay": 0.0005,
        
        # Warmup
        "warmup_epochs": 2,  # Shorter warmup for head-only
        "warmup_momentum": 0.8,
        "warmup_bias_lr": 0.1,
        
        # Loss weights
        "box": 7.5,
        "cls": 0.5,
        "dfl": 1.5,
        
        # Data augmentation (lighter for stage 1)
        "hsv_h": 0.015,
        "hsv_s": 0.7,
        "hsv_v": 0.4,
        "degrees": 0.0,
        "translate": 0.1,
        "scale": 0.5,
        "flipud": 0.0,
        "fliplr": 0.5,
        "mosaic": 0.0,  # No mosaic for speed
        "mixup": 0.0,
        
        # Validation
        "val": True,
        "plots": False,  # No plots for speed
        
        # CPU optimizations
        "amp": False if args.device == "cpu" else True,
        "cache": False,
    }
    
    logger.info("Starting Stage 1 training...")
    logger.info(f"  Image size: {training_args['imgsz']}")
    logger.info(f"  Epochs: {training_args['epochs']}")
    logger.info(f"  Batch size: {training_args['batch']}")
    logger.info(f"  Freeze: {freeze_count} layers")
    logger.info("")
    
    results = model.train(**training_args)
    
    logger.info("=" * 60)
    logger.info("Stage 1 completed!")
    logger.info(f"Best model: {results.save_dir / 'weights' / 'best.pt'}")
    logger.info("=" * 60)
    
    return results.save_dir / "weights" / "last.pt"


def train_stage2(model_path: str, data_path: str, output_dir: Path, args):
    """
    Stage 2: Unfreeze backbone, increase image size (better accuracy)
    
    Args:
        model_path: Path to stage 1 model (last.pt)
        data_path: Path to dataset.yaml
        output_dir: Output directory for stage 2
        args: Command line arguments
    """
    logger.info("")
    logger.info("=" * 60)
    logger.info("STAGE 2: Full Fine-tuning (Better Accuracy)")
    logger.info("=" * 60)
    logger.info("Strategy: Unfreeze backbone, increase image size")
    logger.info("Expected: +10 mAP points improvement")
    logger.info("")
    
    model = YOLO(model_path)
    
    # Unfreeze all layers
    logger.info("Unfreezing all layers...")
    for param in model.model.parameters():
        param.requires_grad = True
    
    trainable_params = sum(p.numel() for p in model.model.parameters() if p.requires_grad)
    logger.info(f"All parameters trainable: {trainable_params:,}")
    logger.info("")
    
    # Stage 2 training args
    training_args = {
        "data": data_path,
        "epochs": args.epochs_stage2 or 10,
        "batch": args.batch,
        "imgsz": args.imgsz_stage2 or 416,  # Larger image size
        "device": args.device,
        "workers": args.workers,
        "project": str(output_dir.parent),
        "name": output_dir.name,
        "patience": args.patience_stage2 or 5,
        "save": True,
        "save_period": 5,
        
        # Learning rate (lower for fine-tuning)
        "lr0": (args.lr0 or 0.01) * 0.5,  # Half of stage 1
        "lrf": 0.1,
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
        
        # Data augmentation (more aggressive)
        "hsv_h": 0.015,
        "hsv_s": 0.7,
        "hsv_v": 0.4,
        "degrees": 0.0,
        "translate": 0.1,
        "scale": 0.5,
        "flipud": 0.0,
        "fliplr": 0.5,
        "mosaic": 0.5,  # Enable mosaic for better accuracy
        "mixup": 0.0,
        
        # Validation
        "val": True,
        "plots": True,  # Enable plots for stage 2
        
        # CPU optimizations
        "amp": False if args.device == "cpu" else True,
        "cache": False,
    }
    
    logger.info("Starting Stage 2 training...")
    logger.info(f"  Image size: {training_args['imgsz']}")
    logger.info(f"  Epochs: {training_args['epochs']}")
    logger.info(f"  Batch size: {training_args['batch']}")
    logger.info(f"  Learning rate: {training_args['lr0']} (reduced from stage 1)")
    logger.info("")
    
    results = model.train(**training_args)
    
    logger.info("=" * 60)
    logger.info("Stage 2 completed!")
    logger.info(f"Best model: {results.save_dir / 'weights' / 'best.pt'}")
    logger.info("=" * 60)
    
    return results.save_dir / "weights" / "best.pt"


def main():
    parser = argparse.ArgumentParser(
        description="Progressive Training: Two-stage fine-tuning for faster training and better accuracy"
    )
    
    parser.add_argument(
        "--data",
        type=str,
        required=True,
        help="Path to dataset.yaml file"
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default="yolov8n.pt",
        help="Pre-trained model (default: yolov8n.pt)"
    )
    
    # Stage 1 parameters
    parser.add_argument(
        "--freeze-stage1",
        type=int,
        default=10,
        help="Number of backbone layers to freeze in stage 1 (default: 10)"
    )
    
    parser.add_argument(
        "--epochs-stage1",
        type=int,
        default=10,
        help="Number of epochs for stage 1 (default: 10)"
    )
    
    parser.add_argument(
        "--imgsz-stage1",
        type=int,
        default=320,
        help="Image size for stage 1 (default: 320)"
    )
    
    parser.add_argument(
        "--patience-stage1",
        type=int,
        default=5,
        help="Early stopping patience for stage 1 (default: 5)"
    )
    
    # Stage 2 parameters
    parser.add_argument(
        "--epochs-stage2",
        type=int,
        default=10,
        help="Number of epochs for stage 2 (default: 10)"
    )
    
    parser.add_argument(
        "--imgsz-stage2",
        type=int,
        default=416,
        help="Image size for stage 2 (default: 416)"
    )
    
    parser.add_argument(
        "--patience-stage2",
        type=int,
        default=5,
        help="Early stopping patience for stage 2 (default: 5)"
    )
    
    # Common parameters
    parser.add_argument(
        "--batch",
        type=int,
        default=4,
        help="Batch size (default: 4)"
    )
    
    parser.add_argument(
        "--workers",
        type=int,
        default=2,
        help="Number of data loading workers (default: 2)"
    )
    
    parser.add_argument(
        "--device",
        type=str,
        default="cpu",
        help="Device ('cpu' or '0' for GPU)"
    )
    
    parser.add_argument(
        "--lr0",
        type=float,
        default=0.01,
        help="Initial learning rate (default: 0.01)"
    )
    
    parser.add_argument(
        "--project",
        type=str,
        default="runs/train",
        help="Project directory (default: runs/train)"
    )
    
    parser.add_argument(
        "--name",
        type=str,
        default="ppe_progressive",
        help="Experiment name (default: ppe_progressive)"
    )
    
    args = parser.parse_args()
    
    # Validate dataset path
    dataset_path = Path(args.data)
    if not dataset_path.exists():
        logger.error(f"Dataset file not found: {dataset_path}")
        sys.exit(1)
    
    logger.info("=" * 80)
    logger.info("PROGRESSIVE TRAINING - Two-Stage Fine-tuning")
    logger.info("=" * 80)
    logger.info("Based on ChatGPT recommendations and literature")
    logger.info("Expected: 1.7-2x faster training, +10 mAP improvement")
    logger.info("")
    logger.info(f"Dataset: {dataset_path}")
    logger.info(f"Pre-trained model: {args.model}")
    logger.info("")
    
    # Stage 1 output directory
    stage1_dir = Path(args.project) / f"{args.name}_stage1"
    
    # Stage 1: Head-only training
    stage1_model = train_stage1(
        model_path=args.model,
        data_path=str(dataset_path),
        output_dir=stage1_dir,
        args=args
    )
    
    # Stage 2 output directory
    stage2_dir = Path(args.project) / f"{args.name}_stage2"
    
    # Stage 2: Full fine-tuning
    final_model = train_stage2(
        model_path=str(stage1_model),
        data_path=str(dataset_path),
        output_dir=stage2_dir,
        args=args
    )
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("PROGRESSIVE TRAINING COMPLETED!")
    logger.info("=" * 80)
    logger.info(f"Final best model: {final_model}")
    logger.info("")
    logger.info("Next steps:")
    logger.info("  1. Evaluate model: python scripts/validate_model.py")
    logger.info("  2. Export to ONNX: python scripts/export_model_onnx.py")
    logger.info("  3. Benchmark inference: python scripts/benchmark_inference.py")


if __name__ == "__main__":
    main()

