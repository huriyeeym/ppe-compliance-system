"""
Dataset Cleaning Script
Removes bad images, incorrect labels, and improves dataset quality

Based on ChatGPT recommendations:
- Remove incorrect bounding boxes
- Remove incorrect labels
- Remove very blurry/irrelevant images
- Check for label drift in safety_vest/hard_hat

Usage:
    python scripts/clean_dataset.py --dataset data/datasets/construction_subset
"""

import argparse
import sys
from pathlib import Path
from typing import List, Tuple
import cv2
import numpy as np
from PIL import Image

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger


def calculate_image_quality(image_path: Path) -> Tuple[float, float]:
    """
    Calculate image quality metrics
    
    Returns:
        (blur_score, brightness_score)
        - blur_score: Lower is blurrier (Laplacian variance)
        - brightness_score: 0-1, optimal around 0.5
    """
    img = cv2.imread(str(image_path))
    if img is None:
        return 0.0, 0.0
    
    # Blur detection (Laplacian variance)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
    blur_score = laplacian_var
    
    # Brightness (normalized)
    brightness = np.mean(gray) / 255.0
    brightness_score = abs(brightness - 0.5)  # Distance from optimal
    
    return blur_score, brightness_score


def validate_label_file(label_path: Path, image_path: Path, class_names: List[str]) -> Tuple[bool, str]:
    """
    Validate label file
    
    Returns:
        (is_valid, error_message)
    """
    if not label_path.exists():
        return False, "Label file not found"
    
    try:
        img = cv2.imread(str(image_path))
        if img is None:
            return False, "Image file not found or corrupted"
        
        img_h, img_w = img.shape[:2]
        
        with open(label_path, 'r') as f:
            lines = f.readlines()
        
        for line_num, line in enumerate(lines, 1):
            parts = line.strip().split()
            if len(parts) != 5:
                return False, f"Line {line_num}: Invalid format (expected 5 values)"
            
            try:
                class_id = int(parts[0])
                x_center = float(parts[1])
                y_center = float(parts[2])
                width = float(parts[3])
                height = float(parts[4])
            except ValueError:
                return False, f"Line {line_num}: Invalid numeric values"
            
            # Check class ID
            if class_id < 0 or class_id >= len(class_names):
                return False, f"Line {line_num}: Invalid class_id {class_id}"
            
            # Check bounding box coordinates
            if not (0 <= x_center <= 1 and 0 <= y_center <= 1):
                return False, f"Line {line_num}: Center coordinates out of range"
            
            if not (0 < width <= 1 and 0 < height <= 1):
                return False, f"Line {line_num}: Box dimensions out of range"
            
            # Check if box is too small (likely error)
            box_area = width * height
            if box_area < 0.001:  # Less than 0.1% of image
                return False, f"Line {line_num}: Box too small (area={box_area:.4f})"
            
            # Check if box is outside image (with small margin)
            x1 = (x_center - width/2) * img_w
            y1 = (y_center - height/2) * img_h
            x2 = (x_center + width/2) * img_w
            y2 = (y_center + height/2) * img_h
            
            if x1 < -10 or y1 < -10 or x2 > img_w + 10 or y2 > img_h + 10:
                return False, f"Line {line_num}: Box significantly outside image"
        
        return True, ""
    
    except Exception as e:
        return False, f"Error reading label: {str(e)}"


def clean_dataset(dataset_dir: Path, output_dir: Path, min_blur_score: float = 50.0, 
                  max_brightness_deviation: float = 0.4, dry_run: bool = False):
    """
    Clean dataset by removing bad images and labels
    
    Args:
        dataset_dir: Input dataset directory
        output_dir: Output directory for cleaned dataset
        min_blur_score: Minimum Laplacian variance (lower = blurrier)
        max_brightness_deviation: Maximum deviation from optimal brightness (0.5)
        dry_run: If True, only report issues without removing files
    """
    logger.info("=" * 60)
    logger.info("Dataset Cleaning")
    logger.info("=" * 60)
    logger.info(f"Input dataset: {dataset_dir}")
    logger.info(f"Output dataset: {output_dir}")
    logger.info(f"Min blur score: {min_blur_score}")
    logger.info(f"Max brightness deviation: {max_brightness_deviation}")
    logger.info(f"Dry run: {dry_run}")
    logger.info("")
    
    # Class names (construction domain)
    class_names = ["person", "hard_hat", "safety_vest"]
    
    # Statistics
    stats = {
        "total_images": 0,
        "removed_blurry": 0,
        "removed_brightness": 0,
        "removed_invalid_label": 0,
        "removed_missing_label": 0,
        "kept": 0
    }
    
    # Process train and val splits
    for split in ["train", "val"]:
        images_dir = dataset_dir / "images" / split
        labels_dir = dataset_dir / "labels" / split
        
        if not images_dir.exists():
            logger.warning(f"Images directory not found: {images_dir}")
            continue
        
        logger.info(f"Processing {split} split...")
        
        # Create output directories
        if not dry_run:
            (output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
            (output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)
        
        # Process images
        image_files = list(images_dir.glob("*.jpg")) + \
                     list(images_dir.glob("*.jpeg")) + \
                     list(images_dir.glob("*.png"))
        
        for img_path in image_files:
            stats["total_images"] += 1
            
            # Find corresponding label file
            label_path = labels_dir / f"{img_path.stem}.txt"
            
            # Check if label exists
            if not label_path.exists():
                logger.warning(f"Missing label: {label_path.name}")
                stats["removed_missing_label"] += 1
                if not dry_run:
                    continue
                else:
                    logger.info(f"  Would remove: {img_path.name} (missing label)")
                    continue
            
            # Validate label
            is_valid, error_msg = validate_label_file(label_path, img_path, class_names)
            if not is_valid:
                logger.warning(f"Invalid label {label_path.name}: {error_msg}")
                stats["removed_invalid_label"] += 1
                if not dry_run:
                    continue
                else:
                    logger.info(f"  Would remove: {img_path.name} (invalid label)")
                    continue
            
            # Check image quality
            blur_score, brightness_deviation = calculate_image_quality(img_path)
            
            if blur_score < min_blur_score:
                logger.warning(f"Blurry image: {img_path.name} (score={blur_score:.2f})")
                stats["removed_blurry"] += 1
                if not dry_run:
                    continue
                else:
                    logger.info(f"  Would remove: {img_path.name} (blurry, score={blur_score:.2f})")
                    continue
            
            if brightness_deviation > max_brightness_deviation:
                logger.warning(f"Poor brightness: {img_path.name} (deviation={brightness_deviation:.3f})")
                stats["removed_brightness"] += 1
                if not dry_run:
                    continue
                else:
                    logger.info(f"  Would remove: {img_path.name} (brightness issue)")
                    continue
            
            # Image is good, copy to output
            stats["kept"] += 1
            if not dry_run:
                import shutil
                shutil.copy2(img_path, output_dir / "images" / split / img_path.name)
                shutil.copy2(label_path, output_dir / "labels" / split / label_path.name)
    
    # Print statistics
    logger.info("")
    logger.info("=" * 60)
    logger.info("Cleaning Statistics")
    logger.info("=" * 60)
    logger.info(f"Total images: {stats['total_images']}")
    logger.info(f"Kept: {stats['kept']} ({stats['kept']/stats['total_images']*100:.1f}%)")
    logger.info(f"Removed - Blurry: {stats['removed_blurry']}")
    logger.info(f"Removed - Brightness: {stats['removed_brightness']}")
    logger.info(f"Removed - Invalid label: {stats['removed_invalid_label']}")
    logger.info(f"Removed - Missing label: {stats['removed_missing_label']}")
    logger.info(f"Total removed: {stats['total_images'] - stats['kept']}")
    logger.info("")
    
    if dry_run:
        logger.info("DRY RUN: No files were actually removed")
        logger.info("Run without --dry-run to apply changes")
    else:
        logger.info(f"Cleaned dataset saved to: {output_dir}")
        logger.info("Next step: Update dataset.yaml with new paths")


def main():
    parser = argparse.ArgumentParser(description="Clean dataset by removing bad images and labels")
    
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to dataset directory (should contain images/ and labels/ folders)"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Output directory for cleaned dataset (default: {dataset}_cleaned)"
    )
    
    parser.add_argument(
        "--min-blur-score",
        type=float,
        default=50.0,
        help="Minimum blur score (Laplacian variance, default: 50.0)"
    )
    
    parser.add_argument(
        "--max-brightness-deviation",
        type=float,
        default=0.4,
        help="Maximum brightness deviation from optimal (default: 0.4)"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Only report issues without removing files"
    )
    
    args = parser.parse_args()
    
    dataset_dir = Path(args.dataset)
    if not dataset_dir.exists():
        logger.error(f"Dataset directory not found: {dataset_dir}")
        sys.exit(1)
    
    output_dir = Path(args.output) if args.output else dataset_dir.parent / f"{dataset_dir.name}_cleaned"
    
    clean_dataset(
        dataset_dir=dataset_dir,
        output_dir=output_dir,
        min_blur_score=args.min_blur_score,
        max_brightness_deviation=args.max_brightness_deviation,
        dry_run=args.dry_run
    )


if __name__ == "__main__":
    main()

