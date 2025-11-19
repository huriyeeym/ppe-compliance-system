"""
Dataset Preparation Script
Downloads and prepares SHEL5K + SH17 datasets for YOLOv8 training

Usage:
    python scripts/prepare_dataset.py
"""

import os
import shutil
import yaml
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger
from backend.config import settings


def create_directory_structure():
    """Create dataset directory structure"""
    logger.info("Creating dataset directory structure...")
    
    base_dir = project_root / "data" / "datasets"
    combined_dir = base_dir / "combined"
    
    dirs = [
        base_dir / "shel5k",
        base_dir / "sh17",
        combined_dir / "images" / "train",
        combined_dir / "images" / "val",
        combined_dir / "labels" / "train",
        combined_dir / "labels" / "val",
    ]
    
    for dir_path in dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
        logger.debug(f"Created directory: {dir_path}")
    
    logger.info("Directory structure created")
    return combined_dir


def create_dataset_yaml(combined_dir: Path, classes: list):
    """
    Create YOLOv8 dataset.yaml file
    
    Args:
        combined_dir: Path to combined dataset directory
        classes: List of class names
    """
    logger.info("Creating dataset.yaml...")
    
    dataset_config = {
        "path": str(combined_dir.absolute()),
        "train": "images/train",
        "val": "images/val",
        "names": {i: name for i, name in enumerate(classes)},
        "nc": len(classes),
    }
    
    yaml_path = combined_dir / "dataset.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(dataset_config, f, default_flow_style=False)
    
    logger.info(f"Dataset config saved to: {yaml_path}")
    logger.info(f"Classes: {classes}")
    
    return yaml_path


def download_shel5k(download_dir: Path):
    """
    Download SHEL5K dataset
    
    Note: This is a placeholder. Actual download depends on dataset source.
    Options:
    1. RoboFlow Universe (requires API key)
    2. Original paper repository
    3. Manual download
    
    Args:
        download_dir: Directory to download dataset
    """
    logger.info("Downloading SHEL5K dataset...")
    logger.warning("SHEL5K download not implemented yet")
    logger.info("Please download manually from:")
    logger.info("  - RoboFlow Universe: https://universe.roboflow.com/")
    logger.info("  - Original paper repository")
    logger.info(f"  - Save to: {download_dir}")
    
    # TODO: Implement actual download
    # Option 1: RoboFlow API
    # Option 2: wget/curl from URL
    # Option 3: Manual download instructions


def download_sh17(download_dir: Path):
    """
    Download SH17 dataset
    
    Note: This is a placeholder. Actual download depends on dataset source.
    
    Args:
        download_dir: Directory to download dataset
    """
    logger.info("Downloading SH17 dataset...")
    logger.warning("SH17 download not implemented yet")
    logger.info("Please download manually from:")
    logger.info("  - GitHub repository")
    logger.info("  - Original paper")
    logger.info(f"  - Save to: {download_dir}")
    
    # TODO: Implement actual download


def convert_to_yolo_format(source_dir: Path, target_dir: Path, split: str = "train"):
    """
    Convert dataset to YOLOv8 format
    
    Expected source format:
    - images/ (JPEG files)
    - annotations/ (XML/JSON/COCO format)
    
    Target format:
    - images/train/ or images/val/
    - labels/train/ or labels/val/ (TXT files: class x y w h)
    
    Args:
        source_dir: Source dataset directory
        target_dir: Target combined dataset directory
        split: "train" or "val"
    """
    logger.info(f"Converting {split} split to YOLOv8 format...")
    logger.warning("Format conversion not implemented yet")
    logger.info("This function should:")
    logger.info("  1. Read source annotations (XML/JSON/COCO)")
    logger.info("  2. Convert to YOLOv8 format (normalized x y w h)")
    logger.info("  3. Copy images to target/images/{split}/")
    logger.info("  4. Save labels to target/labels/{split}/")
    
    # TODO: Implement format conversion
    # - Parse source annotations
    # - Convert bounding boxes to normalized format
    # - Map class names to indices
    # - Save TXT files


def combine_datasets(shel5k_dir: Path, sh17_dir: Path, combined_dir: Path):
    """
    Combine SHEL5K and SH17 datasets
    
    Args:
        shel5k_dir: SHEL5K dataset directory
        sh17_dir: SH17 dataset directory
        combined_dir: Combined dataset directory
    """
    logger.info("Combining datasets...")
    logger.warning("Dataset combination not implemented yet")
    logger.info("This function should:")
    logger.info("  1. Merge images from both datasets")
    logger.info("  2. Merge labels (ensure class mapping is consistent)")
    logger.info("  3. Split train/val (80/20 or 70/30)")
    logger.info("  4. Handle class name conflicts")
    
    # TODO: Implement dataset combination
    # - Merge images
    # - Merge labels
    # - Handle class mapping
    # - Train/val split


def main():
    """Main dataset preparation function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Prepare dataset for YOLOv8 training")
    parser.add_argument(
        "--domain",
        type=str,
        default="construction",
        choices=["construction", "manufacturing", "combined"],
        help="Domain to prepare dataset for"
    )
    args = parser.parse_args()
    
    logger.info("=" * 60)
    logger.info(f"Dataset Preparation - {args.domain.upper()} Domain")
    logger.info("=" * 60)
    
    # Create directory structure
    if args.domain == "construction":
        combined_dir = project_root / "data" / "datasets" / "construction"
    elif args.domain == "manufacturing":
        combined_dir = project_root / "data" / "datasets" / "manufacturing"
    else:
        combined_dir = project_root / "data" / "datasets" / "combined"
    
    combined_dir.mkdir(parents=True, exist_ok=True)
    (combined_dir / "images" / "train").mkdir(parents=True, exist_ok=True)
    (combined_dir / "images" / "val").mkdir(parents=True, exist_ok=True)
    (combined_dir / "labels" / "train").mkdir(parents=True, exist_ok=True)
    (combined_dir / "labels" / "val").mkdir(parents=True, exist_ok=True)
    
    # Define classes based on domain
    if args.domain == "construction":
        # Sadece inşaat sınıfları (3 sınıf)
        classes = [
            "person",
            "hard_hat",      # Baret/Kask
            "safety_vest",   # Reflektor Yelek
        ]
        logger.info("Focus: Construction domain only (3 classes)")
    elif args.domain == "manufacturing":
        # Üretim sınıfları
        classes = [
            "person",
            "safety_glasses",
            "gloves",
            "face_mask",
            "ear_protection",
            "protective_clothing",
        ]
        logger.info("Focus: Manufacturing domain")
    else:
        # Combined (tüm sınıflar)
        classes = [
            "person",
            "hard_hat",
            "safety_vest",
            "safety_glasses",
            "gloves",
            "safety_boots",
            "face_mask",
            "ear_protection",
            "protective_clothing",
        ]
        logger.info("Focus: Combined (all domains)")
    
    # Create dataset.yaml
    yaml_path = create_dataset_yaml(combined_dir, classes)
    
    # Download datasets (placeholder)
    shel5k_dir = project_root / "data" / "datasets" / "shel5k"
    sh17_dir = project_root / "data" / "datasets" / "sh17"
    
    download_shel5k(shel5k_dir)
    download_sh17(sh17_dir)
    
    # Convert to YOLOv8 format (placeholder)
    # convert_to_yolo_format(shel5k_dir, combined_dir, "train")
    # convert_to_yolo_format(sh17_dir, combined_dir, "train")
    
    # Combine datasets (placeholder)
    # combine_datasets(shel5k_dir, sh17_dir, combined_dir)
    
    logger.info("=" * 60)
    logger.info("Dataset preparation complete!")
    logger.info("=" * 60)
    logger.info(f"Dataset directory: {combined_dir}")
    logger.info(f"Classes ({len(classes)}): {', '.join(classes)}")
    logger.info("Next steps:")
    logger.info("  1. Download datasets manually (SHEL5K, SH17, etc.)")
    logger.info("  2. Convert to YOLOv8 format")
    logger.info("  3. Add your custom test images (reflektor yelek + kask)")
    logger.info(f"  4. Run: python scripts/train_model.py --data {combined_dir}/dataset.yaml")


if __name__ == "__main__":
    main()

