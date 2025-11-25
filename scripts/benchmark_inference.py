"""
Benchmark inference speed for different model formats and optimizations
Compares PyTorch, ONNX, and optimized inference

Usage:
    python scripts/benchmark_inference.py --model runs/train/ppe_cpu_fast/weights/best.pt
"""

import argparse
import sys
import time
from pathlib import Path
from typing import Dict, List

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import numpy as np
import cv2
from ultralytics import YOLO
from backend.utils.logger import logger

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    logger.warning("ONNX Runtime not available. Install with: pip install onnxruntime")


def generate_test_image(imgsz: int = 416) -> np.ndarray:
    """Generate a random test image"""
    return np.random.randint(0, 255, (imgsz, imgsz, 3), dtype=np.uint8)


def benchmark_pytorch(model_path: str, imgsz: int = 416, num_iterations: int = 100) -> Dict:
    """Benchmark PyTorch model inference"""
    logger.info("Benchmarking PyTorch model...")
    
    model = YOLO(model_path)
    
    # Warmup
    test_image = generate_test_image(imgsz)
    for _ in range(10):
        _ = model(test_image, verbose=False)
    
    # Benchmark
    times = []
    for i in range(num_iterations):
        test_image = generate_test_image(imgsz)
        start = time.time()
        _ = model(test_image, verbose=False)
        times.append(time.time() - start)
    
    avg_time = np.mean(times)
    std_time = np.std(times)
    fps = 1.0 / avg_time
    
    return {
        "format": "PyTorch",
        "avg_time_ms": avg_time * 1000,
        "std_time_ms": std_time * 1000,
        "fps": fps,
        "min_time_ms": np.min(times) * 1000,
        "max_time_ms": np.max(times) * 1000,
    }


def benchmark_onnx(onnx_path: str, imgsz: int = 416, num_iterations: int = 100) -> Dict:
    """Benchmark ONNX model inference"""
    if not ONNX_AVAILABLE:
        return {"format": "ONNX", "error": "ONNX Runtime not available"}
    
    logger.info("Benchmarking ONNX model...")
    
    # Create ONNX Runtime session
    session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
    
    # Get input shape
    input_name = session.get_inputs()[0].name
    input_shape = session.get_inputs()[0].shape
    
    # Warmup
    test_image = generate_test_image(imgsz)
    test_input = cv2.resize(test_image, (imgsz, imgsz))
    test_input = test_input.transpose(2, 0, 1)  # HWC to CHW
    test_input = test_input.astype(np.float32) / 255.0
    test_input = np.expand_dims(test_input, axis=0)  # Add batch dimension
    
    for _ in range(10):
        _ = session.run(None, {input_name: test_input})
    
    # Benchmark
    times = []
    for i in range(num_iterations):
        test_image = generate_test_image(imgsz)
        test_input = cv2.resize(test_image, (imgsz, imgsz))
        test_input = test_input.transpose(2, 0, 1)
        test_input = test_input.astype(np.float32) / 255.0
        test_input = np.expand_dims(test_input, axis=0)
        
        start = time.time()
        _ = session.run(None, {input_name: test_input})
        times.append(time.time() - start)
    
    avg_time = np.mean(times)
    std_time = np.std(times)
    fps = 1.0 / avg_time
    
    return {
        "format": "ONNX",
        "avg_time_ms": avg_time * 1000,
        "std_time_ms": std_time * 1000,
        "fps": fps,
        "min_time_ms": np.min(times) * 1000,
        "max_time_ms": np.max(times) * 1000,
    }


def benchmark_with_frame_skip(model_path: str, frame_skip: int = 2, imgsz: int = 416, num_iterations: int = 100) -> Dict:
    """Benchmark with frame skipping optimization"""
    logger.info(f"Benchmarking with frame skip={frame_skip}...")
    
    model = YOLO(model_path)
    
    # Warmup
    test_image = generate_test_image(imgsz)
    for _ in range(10):
        _ = model(test_image, verbose=False)
    
    # Benchmark with frame skipping
    times = []
    frame_count = 0
    
    for i in range(num_iterations):
        test_image = generate_test_image(imgsz)
        frame_count += 1
        
        if frame_count % frame_skip == 0:
            start = time.time()
            _ = model(test_image, verbose=False)
            times.append(time.time() - start)
        else:
            # Simulate frame skip (no processing)
            times.append(0.0)
    
    # Calculate effective time (only processed frames)
    processed_times = [t for t in times if t > 0]
    avg_time = np.mean(processed_times) / frame_skip  # Average per frame
    std_time = np.std(processed_times) / frame_skip
    fps = 1.0 / avg_time if avg_time > 0 else float('inf')
    
    return {
        "format": f"PyTorch (skip={frame_skip})",
        "avg_time_ms": avg_time * 1000,
        "std_time_ms": std_time * 1000,
        "fps": fps,
        "min_time_ms": np.min(processed_times) * 1000 / frame_skip,
        "max_time_ms": np.max(processed_times) * 1000 / frame_skip,
    }


def print_results(results: List[Dict]):
    """Print benchmark results in a table"""
    logger.info("")
    logger.info("=" * 80)
    logger.info("Benchmark Results")
    logger.info("=" * 80)
    logger.info("")
    
    # Header
    logger.info(f"{'Format':<25} {'Avg Time (ms)':<15} {'FPS':<10} {'Min (ms)':<12} {'Max (ms)':<12}")
    logger.info("-" * 80)
    
    # Results
    for result in results:
        if "error" in result:
            logger.info(f"{result['format']:<25} {'ERROR':<15}")
            continue
        
        logger.info(
            f"{result['format']:<25} "
            f"{result['avg_time_ms']:>8.2f} ± {result['std_time_ms']:>4.2f}  "
            f"{result['fps']:>6.1f}  "
            f"{result['min_time_ms']:>8.2f}  "
            f"{result['max_time_ms']:>8.2f}"
        )
    
    logger.info("")
    logger.info("=" * 80)
    
    # Speedup comparison
    if len(results) >= 2:
        baseline = results[0]
        if "error" not in baseline:
            logger.info("Speedup Comparison:")
            for result in results[1:]:
                if "error" not in result:
                    speedup = baseline['avg_time_ms'] / result['avg_time_ms']
                    logger.info(f"  {result['format']}: {speedup:.2f}x faster than {baseline['format']}")


def main():
    parser = argparse.ArgumentParser(description="Benchmark inference speed")
    
    parser.add_argument(
        "--model",
        type=str,
        required=True,
        help="Path to .pt model file"
    )
    
    parser.add_argument(
        "--onnx",
        type=str,
        default=None,
        help="Path to .onnx model file (optional, will export if not provided)"
    )
    
    parser.add_argument(
        "--imgsz",
        type=int,
        default=416,
        help="Image size for inference (default: 416)"
    )
    
    parser.add_argument(
        "--iterations",
        type=int,
        default=100,
        help="Number of iterations for benchmarking (default: 100)"
    )
    
    parser.add_argument(
        "--frame-skip",
        type=int,
        default=2,
        help="Frame skip value for optimization test (default: 2)"
    )
    
    args = parser.parse_args()
    
    # Validate model path
    model_path = Path(args.model)
    if not model_path.exists():
        logger.error(f"Model file not found: {model_path}")
        sys.exit(1)
    
    logger.info("=" * 80)
    logger.info("PPE Detection Inference Benchmark")
    logger.info("=" * 80)
    logger.info(f"Model: {model_path}")
    logger.info(f"Image size: {args.imgsz}")
    logger.info(f"Iterations: {args.iterations}")
    logger.info("")
    
    results = []
    
    # Benchmark PyTorch
    results.append(benchmark_pytorch(str(model_path), args.imgsz, args.iterations))
    
    # Benchmark ONNX
    onnx_path = args.onnx
    if onnx_path is None:
        # Try to find ONNX file
        onnx_path = model_path.parent / f"{model_path.stem}.onnx"
        if not onnx_path.exists():
            logger.warning(f"ONNX file not found: {onnx_path}")
            logger.info("Export ONNX first: python scripts/export_model_onnx.py --model {model_path}")
            onnx_path = None
    
    if onnx_path and Path(onnx_path).exists():
        results.append(benchmark_onnx(str(onnx_path), args.imgsz, args.iterations))
    
    # Benchmark with frame skip
    results.append(benchmark_with_frame_skip(str(model_path), args.frame_skip, args.imgsz, args.iterations))
    
    # Print results
    print_results(results)


if __name__ == "__main__":
    main()

