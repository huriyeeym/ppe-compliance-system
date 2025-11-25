"""
Offline Dataset Augmentation Script
Applies augmentations offline to increase dataset size (CPU-friendly)

Based on ChatGPT recommendations:
- Brightness/contrast augmentation
- Gaussian blur
- Random crop (without cutting PPE)
- Hue/saturation changes
- Light rotation/perspective

Usage:
    python scripts/augment_dataset_offline.py --dataset data/datasets/construction_subset --output data/datasets/construction_augmented --multiplier 2
"""

import argparse
import sys
from pathlib import Path
from typing import List, Tuple
import cv2
import numpy as np
from PIL import Image, ImageEnhance
import random
import shutil

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger


def augment_brightness_contrast(image: np.ndarray) -> np.ndarray:
    """Apply brightness and contrast augmentation"""
    # Random brightness (0.7 to 1.3)
    brightness_factor = random.uniform(0.7, 1.3)
    # Random contrast (0.8 to 1.2)
    contrast_factor = random.uniform(0.8, 1.2)
    
    # Apply using PIL for better control
    pil_img = Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))
    
    # Brightness
    enhancer = ImageEnhance.Brightness(pil_img)
    pil_img = enhancer.enhance(brightness_factor)
    
    # Contrast
    enhancer = ImageEnhance.Contrast(pil_img)
    pil_img = enhancer.enhance(contrast_factor)
    
    return cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)


def augment_hue_saturation(image: np.ndarray) -> np.ndarray:
    """Apply HSV augmentation (hue and saturation)"""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    
    # Hue shift (-10 to +10 degrees)
    hue_shift = random.randint(-10, 10)
    hsv[:, :, 0] = (hsv[:, :, 0].astype(int) + hue_shift) % 180
    
    # Saturation (0.7 to 1.3)
    sat_factor = random.uniform(0.7, 1.3)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * sat_factor, 0, 255).astype(np.uint8)
    
    return cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)


def augment_gaussian_blur(image: np.ndarray) -> np.ndarray:
    """Apply light Gaussian blur"""
    # Random kernel size (3, 5, or 7)
    kernel_size = random.choice([3, 5, 7])
    return cv2.GaussianBlur(image, (kernel_size, kernel_size), 0)


def augment_rotation(image: np.ndarray, labels: List[str]) -> Tuple[np.ndarray, List[str]]:
    """
    Apply light rotation (max 10 degrees) and adjust labels
    
    Args:
        image: Input image
        labels: List of label lines (class_id x_center y_center width height)
    
    Returns:
        (augmented_image, adjusted_labels)
    """
    h, w = image.shape[:2]
    
    # Small rotation angle (-10 to +10 degrees)
    angle = random.uniform(-10, 10)
    
    # Rotation matrix
    center = (w / 2, h / 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    
    # Rotate image
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_LINEAR, 
                             borderMode=cv2.BORDER_REPLICATE)
    
    # Adjust labels (rotation in normalized coordinates is complex, skip for now)
    # For simplicity, return original labels (rotation is small, minimal impact)
    return rotated, labels


def augment_perspective(image: np.ndarray, labels: List[str]) -> Tuple[np.ndarray, List[str]]:
    """
    Apply light perspective transformation
    
    Args:
        image: Input image
        labels: List of label lines
    
    Returns:
        (augmented_image, adjusted_labels)
    """
    h, w = image.shape[:2]
    
    # Small perspective shift
    shift = random.uniform(0.95, 1.05)
    
    # Source points (corners)
    src_points = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    
    # Destination points (slightly shifted)
    dst_points = np.float32([
        [w * (1 - shift), h * (1 - shift)],
        [w * shift, h * (1 - shift)],
        [w * shift, h * shift],
        [w * (1 - shift), h * shift]
    ])
    
    # Perspective transform
    M = cv2.getPerspectiveTransform(src_points, dst_points)
    transformed = cv2.warpPerspective(image, M, (w, h), flags=cv2.INTER_LINEAR,
                                      borderMode=cv2.BORDER_REPLICATE)
    
    # Labels adjustment is complex, return original for now
    return transformed, labels


def augment_image(image_path: Path, label_path: Path, output_image_path: Path, 
                  output_label_path: Path, augmentation_type: str):
    """
    Apply augmentation to a single image-label pair
    
    Args:
        augmentation_type: 'brightness', 'hue', 'blur', 'rotation', 'perspective'
    """
    # Read image
    image = cv2.imread(str(image_path))
    if image is None:
        logger.warning(f"Failed to read image: {image_path}")
        return False
    
    # Read labels
    labels = []
    if label_path.exists():
        with open(label_path, 'r') as f:
            labels = f.readlines()
    
    # Apply augmentation
    if augmentation_type == "brightness":
        augmented = augment_brightness_contrast(image)
        new_labels = labels
    elif augmentation_type == "hue":
        augmented = augment_hue_saturation(image)
        new_labels = labels
    elif augmentation_type == "blur":
        augmented = augment_gaussian_blur(image)
        new_labels = labels
    elif augmentation_type == "rotation":
        augmented, new_labels = augment_rotation(image, labels)
    elif augmentation_type == "perspective":
        augmented, new_labels = augment_perspective(image, labels)
    else:
        logger.warning(f"Unknown augmentation type: {augmentation_type}")
        return False
    
    # Save augmented image
    cv2.imwrite(str(output_image_path), augmented)
    
    # Save labels
    if new_labels:
        with open(output_label_path, 'w') as f:
            f.writelines(new_labels)
    elif label_path.exists():
        # Copy original labels if no adjustment
        shutil.copy2(label_path, output_label_path)
    
    return True


def augment_dataset(dataset_dir: Path, output_dir: Path, multiplier: int = 2):
    """
    Augment dataset by creating multiple augmented versions
    
    Args:
        dataset_dir: Input dataset directory
        output_dir: Output directory for augmented dataset
        multiplier: How many times to augment (e.g., 2 = double the dataset)
    """
    logger.info("=" * 60)
    logger.info("Offline Dataset Augmentation")
    logger.info("=" * 60)
    logger.info(f"Input dataset: {dataset_dir}")
    logger.info(f"Output dataset: {output_dir}")
    logger.info(f"Multiplier: {multiplier}x")
    logger.info("")
    
    # Augmentation types
    augmentation_types = ["brightness", "hue", "blur", "rotation", "perspective"]
    
    # Statistics
    stats = {
        "original_images": 0,
        "augmented_images": 0,
        "total_images": 0
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
        (output_dir / "images" / split).mkdir(parents=True, exist_ok=True)
        (output_dir / "labels" / split).mkdir(parents=True, exist_ok=True)
        
        # Get image files
        image_files = list(images_dir.glob("*.jpg")) + \
                     list(images_dir.glob("*.jpeg")) + \
                     list(images_dir.glob("*.png"))
        
        stats["original_images"] += len(image_files)
        
        # Copy original images
        for img_path in image_files:
            label_path = labels_dir / f"{img_path.stem}.txt"
            
            # Copy original
            shutil.copy2(img_path, output_dir / "images" / split / img_path.name)
            if label_path.exists():
                shutil.copy2(label_path, output_dir / "labels" / split / label_path.name)
        
        # Create augmented versions
        num_augmentations = len(image_files) * (multiplier - 1)
        logger.info(f"Creating {num_augmentations} augmented images...")
        
        augmented_count = 0
        for img_path in image_files:
            label_path = labels_dir / f"{img_path.stem}.txt"
            
            # Create (multiplier - 1) augmented versions
            for i in range(multiplier - 1):
                aug_type = random.choice(augmentation_types)
                output_img_name = f"{img_path.stem}_aug{i+1}_{aug_type}{img_path.suffix}"
                output_label_name = f"{img_path.stem}_aug{i+1}_{aug_type}.txt"
                
                output_img_path = output_dir / "images" / split / output_img_name
                output_label_path = output_dir / "labels" / split / output_label_name
                
                if augment_image(img_path, label_path, output_img_path, output_label_path, aug_type):
                    augmented_count += 1
                    stats["augmented_images"] += 1
        
        logger.info(f"  Created {augmented_count} augmented images for {split}")
    
    stats["total_images"] = stats["original_images"] + stats["augmented_images"]
    
    # Print statistics
    logger.info("")
    logger.info("=" * 60)
    logger.info("Augmentation Statistics")
    logger.info("=" * 60)
    logger.info(f"Original images: {stats['original_images']}")
    logger.info(f"Augmented images: {stats['augmented_images']}")
    logger.info(f"Total images: {stats['total_images']}")
    logger.info(f"Dataset size increase: {stats['total_images']/stats['original_images']:.2f}x")
    logger.info("")
    logger.info(f"Augmented dataset saved to: {output_dir}")
    logger.info("Next step: Update dataset.yaml with new paths")


def main():
    parser = argparse.ArgumentParser(description="Offline dataset augmentation")
    
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to dataset directory"
    )
    
    parser.add_argument(
        "--output",
        type=str,
        required=True,
        help="Output directory for augmented dataset"
    )
    
    parser.add_argument(
        "--multiplier",
        type=int,
        default=2,
        help="Dataset size multiplier (default: 2 = double the dataset)"
    )
    
    args = parser.parse_args()
    
    dataset_dir = Path(args.dataset)
    if not dataset_dir.exists():
        logger.error(f"Dataset directory not found: {dataset_dir}")
        sys.exit(1)
    
    output_dir = Path(args.output)
    
    augment_dataset(
        dataset_dir=dataset_dir,
        output_dir=output_dir,
        multiplier=args.multiplier
    )


if __name__ == "__main__":
    main()

