"""
Create subset from existing dataset for iterative training
Creates a smaller dataset (2,000-3,000 images) for initial training

Usage:
    python scripts/create_subset.py --source data/datasets/construction --target data/datasets/construction_subset --size 2500
"""

import argparse
import shutil
import random
from pathlib import Path
import sys
from typing import List, Tuple
import yaml

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger


class DatasetSubsetCreator:
    """
    Create subset from existing dataset for iterative training
    """
    
    def __init__(self, source_dir: Path, target_dir: Path, size: int = 2500):
        """
        Initialize subset creator
        
        Args:
            source_dir: Source dataset directory
            target_dir: Target subset directory
            size: Number of images to include in subset
        """
        self.source_dir = Path(source_dir)
        self.target_dir = Path(target_dir)
        self.size = size
        
        # Classes (construction domain)
        self.classes = {
            "person": 0,
            "hard_hat": 1,
            "safety_vest": 2,
        }
    
    def get_all_images(self) -> List[Path]:
        """
        Get all images from source dataset
        
        Returns:
            List of image paths
        """
        train_images_dir = self.source_dir / "images" / "train"
        val_images_dir = self.source_dir / "images" / "val"
        
        image_files = []
        
        # Get train images
        if train_images_dir.exists():
            for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
                image_files.extend(list(train_images_dir.glob(f"*{ext}")))
        
        # Get val images
        if val_images_dir.exists():
            for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
                image_files.extend(list(val_images_dir.glob(f"*{ext}")))
        
        return image_files
    
    def create_subset(self, train_ratio: float = 0.8) -> Tuple[int, int]:
        """
        Create subset from source dataset
        
        Args:
            train_ratio: Ratio of train images (default: 0.8)
            
        Returns:
            Tuple of (train_count, val_count) images in subset
        """
        logger.info("=" * 60)
        logger.info("Creating Dataset Subset")
        logger.info("=" * 60)
        logger.info(f"Source: {self.source_dir}")
        logger.info(f"Target: {self.target_dir}")
        logger.info(f"Size: {self.size} images")
        logger.info("")
        
        # Get all images
        all_images = self.get_all_images()
        logger.info(f"Found {len(all_images)} images in source dataset")
        
        if len(all_images) < self.size:
            logger.warning(f"Source dataset has only {len(all_images)} images, using all")
            self.size = len(all_images)
        
        # Random sample
        random.seed(42)  # Reproducible
        selected_images = random.sample(all_images, self.size)
        logger.info(f"Selected {len(selected_images)} images for subset")
        
        # Split train/val
        random.shuffle(selected_images)
        split_idx = int(len(selected_images) * train_ratio)
        train_images = selected_images[:split_idx]
        val_images = selected_images[split_idx:]
        
        logger.info(f"Train: {len(train_images)} images")
        logger.info(f"Val: {len(val_images)} images")
        
        # Create target directories
        train_images_dir = self.target_dir / "images" / "train"
        val_images_dir = self.target_dir / "images" / "val"
        train_labels_dir = self.target_dir / "labels" / "train"
        val_labels_dir = self.target_dir / "labels" / "val"
        
        for dir_path in [train_images_dir, val_images_dir, train_labels_dir, val_labels_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
        
        # Copy train images and labels
        train_count = 0
        for img_file in train_images:
            try:
                # Copy image
                target_image = train_images_dir / img_file.name
                shutil.copy2(img_file, target_image)
                
                # Copy label
                label_file = self.source_dir / "labels" / "train" / f"{img_file.stem}.txt"
                if not label_file.exists():
                    # Try val labels
                    label_file = self.source_dir / "labels" / "val" / f"{img_file.stem}.txt"
                
                if label_file.exists():
                    target_label = train_labels_dir / label_file.name
                    shutil.copy2(label_file, target_label)
                    train_count += 1
                else:
                    logger.warning(f"Label not found for {img_file.name}")
                    
            except Exception as e:
                logger.error(f"Error copying {img_file.name}: {e}")
        
        # Copy val images and labels
        val_count = 0
        for img_file in val_images:
            try:
                # Copy image
                target_image = val_images_dir / img_file.name
                shutil.copy2(img_file, target_image)
                
                # Copy label
                label_file = self.source_dir / "labels" / "train" / f"{img_file.stem}.txt"
                if not label_file.exists():
                    # Try val labels
                    label_file = self.source_dir / "labels" / "val" / f"{img_file.stem}.txt"
                
                if label_file.exists():
                    target_label = val_labels_dir / label_file.name
                    shutil.copy2(label_file, target_label)
                    val_count += 1
                else:
                    logger.warning(f"Label not found for {img_file.name}")
                    
            except Exception as e:
                logger.error(f"Error copying {img_file.name}: {e}")
        
        logger.info("")
        logger.info(f"[OK] Subset created: {train_count} train, {val_count} val")
        
        return train_count, val_count
    
    def create_dataset_yaml(self):
        """
        Create dataset.yaml file for YOLOv8
        """
        yaml_path = self.target_dir / "dataset.yaml"
        
        # Get absolute paths
        train_path = (self.target_dir / "images" / "train").absolute()
        val_path = (self.target_dir / "images" / "val").absolute()
        
        dataset_config = {
            "path": str(self.target_dir.absolute()),
            "train": str(train_path),
            "val": str(val_path),
            "nc": len(self.classes),
            "names": list(self.classes.keys()),
        }
        
        with open(yaml_path, 'w') as f:
            yaml.dump(dataset_config, f, default_flow_style=False, sort_keys=False)
        
        logger.info(f"[OK] dataset.yaml created: {yaml_path}")
        return yaml_path


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description="Create subset from existing dataset for iterative training"
    )
    parser.add_argument(
        "--source",
        type=str,
        required=True,
        help="Source dataset directory"
    )
    parser.add_argument(
        "--target",
        type=str,
        required=True,
        help="Target subset directory"
    )
    parser.add_argument(
        "--size",
        type=int,
        default=2500,
        help="Number of images in subset (default: 2500)"
    )
    parser.add_argument(
        "--train-ratio",
        type=float,
        default=0.8,
        help="Train/Val split ratio (default: 0.8)"
    )
    
    args = parser.parse_args()
    
    creator = DatasetSubsetCreator(
        source_dir=args.source,
        target_dir=args.target,
        size=args.size
    )
    
    train_count, val_count = creator.create_subset(train_ratio=args.train_ratio)
    creator.create_dataset_yaml()
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("Subset Creation Complete!")
    logger.info("=" * 60)
    logger.info(f"Train Images: {train_count}")
    logger.info(f"Val Images: {val_count}")
    logger.info(f"Total: {train_count + val_count}")
    logger.info("")
    logger.info("Next step:")
    logger.info(f"  python scripts/train_model.py --data {creator.target_dir}/dataset.yaml --epochs 100")


if __name__ == "__main__":
    main()

