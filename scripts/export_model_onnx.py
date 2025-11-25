"""
Export YOLOv8 model to ONNX format for faster inference
ONNX Runtime provides 2-3x speedup on CPU compared to PyTorch

Usage:
    python scripts/export_model_onnx.py --model runs/train/ppe_cpu_fast/weights/best.pt
"""

import argparse
import sys
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from ultralytics import YOLO
from backend.utils.logger import logger


def export_to_onnx(model_path: str, imgsz: int = 416, half: bool = False, int8: bool = False):
    """
    Export YOLOv8 model to ONNX format
    
    Args:
        model_path: Path to .pt model file
        imgsz: Image size for export (416 for CPU optimization)
        half: Use FP16 precision (GPU only)
        int8: Use INT8 quantization (CPU/GPU, requires calibration data)
    """
    logger.info("=" * 60)
    logger.info("YOLOv8 Model ONNX Export")
    logger.info("=" * 60)
    
    # Validate model path
    model_file = Path(model_path)
    if not model_file.exists():
        logger.error(f"Model file not found: {model_file}")
        logger.info("Please train a model first or provide valid path")
        sys.exit(1)
    
    logger.info(f"Loading model: {model_file}")
    model = YOLO(str(model_file))
    
    # Export options
    export_kwargs = {
        "format": "onnx",
        "imgsz": imgsz,
        "optimize": True,  # ONNX optimization
        "simplify": True,  # Simplify ONNX graph
        "dynamic": False,  # Static shape (faster)
    }
    
    if half:
        export_kwargs["half"] = True
        logger.info("Using FP16 precision (GPU recommended)")
    
    if int8:
        export_kwargs["int8"] = True
        logger.info("Using INT8 quantization (2-4x speedup)")
    
    logger.info(f"Exporting to ONNX format...")
    logger.info(f"  Image size: {imgsz}")
    logger.info(f"  Optimize: True")
    logger.info(f"  Simplify: True")
    
    try:
        # Export model
        exported_path = model.export(**export_kwargs)
        
        logger.info("=" * 60)
        logger.info("✅ ONNX export completed successfully!")
        logger.info("=" * 60)
        logger.info(f"Exported model: {exported_path}")
        logger.info("")
        logger.info("Next steps:")
        logger.info("  1. Test ONNX model: python scripts/test_onnx_inference.py")
        logger.info("  2. Update detector to use ONNX: backend/ml_engine/detector.py")
        logger.info("  3. Benchmark performance: python scripts/benchmark_inference.py")
        
        return exported_path
        
    except Exception as e:
        logger.error(f"ONNX export failed: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(description="Export YOLOv8 model to ONNX")
    
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        help="Path to .pt model file"
    )
    
    parser.add_argument(
        "--imgsz",
        type=int,
        default=416,
        help="Image size for export (default: 416, CPU optimized)"
    )
    
    parser.add_argument(
        "--half",
        action="store_true",
        help="Use FP16 precision (GPU only)"
    )
    
    parser.add_argument(
        "--int8",
        action="store_true",
        help="Use INT8 quantization (2-4x speedup, requires calibration)"
    )
    
    args = parser.parse_args()
    
    export_to_onnx(
        model_path=args.model,
        imgsz=args.imgsz,
        half=args.half,
        int8=args.int8
    )


if __name__ == "__main__":
    main()

