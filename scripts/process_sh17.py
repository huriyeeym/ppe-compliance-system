"""
SH17 Dataset Processing Script
Filters SH17 dataset for construction domain (person, helmet, safety-vest only)

Usage:
    python scripts/process_sh17.py
"""

import shutil
from pathlib import Path
import sys
import random

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger


def get_construction_class_mapping():
    """
    Map SH17 classes to construction domain classes
    
    SH17 Classes:
    0: person → 0: person
    10: helmet → 1: hard_hat
    16: safety-vest → 2: safety_vest
    
    Returns:
        Dictionary mapping SH17 class IDs to construction class IDs
    """
    return {
        0: 0,   # person → person
        10: 1,  # helmet → hard_hat
        16: 2,  # safety-vest → safety_vest
    }


def filter_sh17_labels(
    source_labels_dir: Path,
    target_labels_dir: Path,
    class_mapping: dict
):
    """
    Filter SH17 labels to only include construction classes
    
    Args:
        source_labels_dir: SH17 labels directory
        target_labels_dir: Target labels directory
        class_mapping: SH17 class ID → construction class ID mapping
    """
    logger.info(f"Filtering SH17 labels from {source_labels_dir}")
    
    label_files = list(source_labels_dir.glob("*.txt"))
    logger.info(f"Found {len(label_files)} label files")
    
    filtered_count = 0
    skipped_count = 0
    
    for label_file in label_files:
        try:
            with open(label_file, 'r') as f:
                lines = f.readlines()
            
            filtered_lines = []
            for line in lines:
                parts = line.strip().split()
                if not parts:
                    continue
                
                sh17_class_id = int(parts[0])
                
                # Only keep construction classes
                if sh17_class_id in class_mapping:
                    construction_class_id = class_mapping[sh17_class_id]
                    # Update class ID
                    parts[0] = str(construction_class_id)
                    filtered_lines.append(' '.join(parts) + '\n')
            
            # Only save if there are valid annotations
            if filtered_lines:
                target_file = target_labels_dir / label_file.name
                with open(target_file, 'w') as f:
                    f.writelines(filtered_lines)
                filtered_count += 1
            else:
                skipped_count += 1
                
        except Exception as e:
            logger.warning(f"Error processing {label_file.name}: {e}")
            skipped_count += 1
    
    logger.info(f"Filtered {filtered_count} label files")
    logger.info(f"Skipped {skipped_count} label files (no construction classes)")
    return filtered_count


def copy_images_with_labels(
    source_images_dir: Path,
    source_labels_dir: Path,
    target_images_dir: Path,
    target_labels_dir: Path
):
    """
    Copy images that have corresponding filtered labels
    
    Args:
        source_images_dir: Source images directory
        source_labels_dir: Source labels directory (filtered)
        target_images_dir: Target images directory
        target_labels_dir: Target labels directory
    """
    logger.info(f"Copying images from {source_images_dir}")
    
    # Get all label files
    label_files = list(target_labels_dir.glob("*.txt"))
    logger.info(f"Found {len(label_files)} filtered label files")
    
    copied_count = 0
    
    for label_file in label_files:
        # Find corresponding image file
        image_name = label_file.stem
        # Try different image extensions
        for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
            image_file = source_images_dir / f"{image_name}{ext}"
            if image_file.exists():
                target_image = target_images_dir / image_file.name
                shutil.copy2(image_file, target_image)
                copied_count += 1
                break
    
    logger.info(f"Copied {copied_count} images")
    return copied_count


def split_train_val(
    images_dir: Path,
    labels_dir: Path,
    train_ratio: float = 0.8
):
    """
    Split dataset into train and validation sets
    
    Args:
        images_dir: Images directory
        labels_dir: Labels directory
        train_ratio: Ratio of training data (default: 0.8 = 80%)
    """
    logger.info(f"Splitting dataset (train: {train_ratio*100}%, val: {(1-train_ratio)*100}%)")
    
    # Get all image files
    image_files = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg")) + list(images_dir.glob("*.png"))
    image_files = [f for f in image_files if f.suffix.lower() in ['.jpg', '.jpeg', '.png']]
    
    # Shuffle
    random.seed(42)  # For reproducibility
    random.shuffle(image_files)
    
    # Split
    split_idx = int(len(image_files) * train_ratio)
    train_images = image_files[:split_idx]
    val_images = image_files[split_idx:]
    
    logger.info(f"Train: {len(train_images)} images")
    logger.info(f"Val: {len(val_images)} images")
    
    # Create train/val directories
    train_images_dir = images_dir.parent / "train"
    val_images_dir = images_dir.parent / "val"
    train_labels_dir = labels_dir.parent / "train"
    val_labels_dir = labels_dir.parent / "val"
    
    train_images_dir.mkdir(exist_ok=True)
    val_images_dir.mkdir(exist_ok=True)
    train_labels_dir.mkdir(exist_ok=True)
    val_labels_dir.mkdir(exist_ok=True)
    
    # Move train files
    for img_file in train_images:
        label_file = labels_dir / f"{img_file.stem}.txt"
        if label_file.exists():
            shutil.move(str(img_file), str(train_images_dir / img_file.name))
            shutil.move(str(label_file), str(train_labels_dir / label_file.name))
    
    # Move val files
    for img_file in val_images:
        label_file = labels_dir / f"{img_file.stem}.txt"
        if label_file.exists():
            shutil.move(str(img_file), str(val_images_dir / img_file.name))
            shutil.move(str(label_file), str(val_labels_dir / label_file.name))
    
    logger.info("Train/Val split completed")


def process_sh17_dataset():
    """
    Process SH17 dataset for construction domain
    """
    logger.info("=" * 60)
    logger.info("SH17 Dataset Processing - Construction Domain")
    logger.info("=" * 60)
    
    sh17_dir = project_root / "data" / "datasets" / "sh17"
    construction_dir = project_root / "data" / "datasets" / "construction"
    
    # Check if SH17 dataset exists
    if not sh17_dir.exists():
        logger.error(f"SH17 dataset not found at {sh17_dir}")
        logger.info("Please download SH17 dataset from Kaggle:")
        logger.info("  https://www.kaggle.com/datasets/mugheesahmad/sh17-dataset-for-ppe-detection")
        logger.info(f"  Extract to: {sh17_dir}")
        return False
    
    # Check if images and labels directories exist
    # SH17 structure may vary, check common locations
    possible_image_dirs = [
        sh17_dir / "images",
        sh17_dir / "train" / "images",
        sh17_dir / "data" / "images",
    ]
    
    possible_label_dirs = [
        sh17_dir / "labels",
        sh17_dir / "train" / "labels",
        sh17_dir / "data" / "labels",
    ]
    
    images_dir = None
    labels_dir = None
    
    for img_dir in possible_image_dirs:
        if img_dir.exists() and any(img_dir.glob("*.jpg")) or any(img_dir.glob("*.jpeg")):
            images_dir = img_dir
            break
    
    for lbl_dir in possible_label_dirs:
        if lbl_dir.exists() and any(lbl_dir.glob("*.txt")):
            labels_dir = lbl_dir
            break
    
    if not images_dir or not labels_dir:
        logger.error("SH17 images or labels directory not found")
        logger.info("Expected structure:")
        logger.info("  sh17/images/  (or sh17/train/images/)")
        logger.info("  sh17/labels/  (or sh17/train/labels/)")
        logger.info("")
        logger.info("Please download SH17 dataset from Kaggle:")
        logger.info("  https://www.kaggle.com/datasets/mugheesahmad/sh17-dataset-for-ppe-detection")
        return False
    
    logger.info(f"Found images: {images_dir}")
    logger.info(f"Found labels: {labels_dir}")
    
    # Create temporary processing directory
    temp_dir = construction_dir / "temp_sh17"
    temp_images_dir = temp_dir / "images"
    temp_labels_dir = temp_dir / "labels"
    temp_images_dir.mkdir(parents=True, exist_ok=True)
    temp_labels_dir.mkdir(parents=True, exist_ok=True)
    
    # Class mapping
    class_mapping = get_construction_class_mapping()
    logger.info(f"Class mapping: {class_mapping}")
    
    # Filter labels
    filtered_count = filter_sh17_labels(labels_dir, temp_labels_dir, class_mapping)
    
    if filtered_count == 0:
        logger.error("No valid labels found after filtering")
        return False
    
    # Copy images
    copied_count = copy_images_with_labels(
        images_dir, temp_labels_dir, temp_images_dir, temp_labels_dir
    )
    
    if copied_count == 0:
        logger.error("No images copied")
        return False
    
    # Split train/val
    split_train_val(temp_images_dir, temp_labels_dir, train_ratio=0.8)
    
    # Move to final location
    train_images_final = construction_dir / "images" / "train"
    val_images_final = construction_dir / "images" / "val"
    train_labels_final = construction_dir / "labels" / "train"
    val_labels_final = construction_dir / "labels" / "val"
    
    # Copy train files
    for img_file in (temp_dir / "train").glob("*.jpg"):
        shutil.copy2(img_file, train_images_final / img_file.name)
    for lbl_file in (temp_dir / "train").glob("*.txt"):
        shutil.copy2(lbl_file, train_labels_final / lbl_file.name)
    
    # Copy val files
    for img_file in (temp_dir / "val").glob("*.jpg"):
        shutil.copy2(img_file, val_images_final / img_file.name)
    for lbl_file in (temp_dir / "val").glob("*.txt"):
        shutil.copy2(lbl_file, val_labels_final / lbl_file.name)
    
    # Cleanup
    shutil.rmtree(temp_dir)
    
    logger.info("=" * 60)
    logger.info("SH17 processing complete!")
    logger.info("=" * 60)
    
    return True


if __name__ == "__main__":
    process_sh17_dataset()

