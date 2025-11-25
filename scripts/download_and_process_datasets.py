"""
Professional Dataset Download and Processing Pipeline
Handles SH17 and SHEL5K datasets with automatic download, validation, and processing

Usage:
    python scripts/download_and_process_datasets.py --domain construction
"""

import argparse
import shutil
import zipfile
from pathlib import Path
import sys
import random
from typing import Dict, List, Tuple
import yaml

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger


class DatasetProcessor:
    """
    Professional dataset processing pipeline
    Handles download, validation, format conversion, and merging
    """
    
    def __init__(self, domain: str = "construction"):
        """
        Initialize dataset processor
        
        Args:
            domain: Target domain (construction, manufacturing, combined)
        """
        self.domain = domain
        self.project_root = project_root
        self.datasets_dir = project_root / "data" / "datasets"
        self.target_dir = self.datasets_dir / domain
        
        # Class mappings for construction domain
        self.construction_classes = {
            "person": 0,
            "hard_hat": 1,
            "safety_vest": 2,
        }
        
        # SH17 class mapping (SH17 class ID → construction class ID)
        self.sh17_to_construction = {
            0: 0,   # person → person
            10: 1,  # helmet → hard_hat
            16: 2,  # safety-vest → safety_vest
        }
    
    def validate_dataset_structure(self, dataset_dir: Path, dataset_name: str) -> bool:
        """
        Validate dataset structure
        
        Args:
            dataset_dir: Dataset directory
            dataset_name: Dataset name (for logging)
            
        Returns:
            True if valid, False otherwise
        """
        logger.info(f"Validating {dataset_name} structure...")
        
        # Check for common structures
        possible_image_dirs = [
            dataset_dir / "images",
            dataset_dir / "train" / "images",
            dataset_dir / "data" / "images",
            dataset_dir / "train",
        ]
        
        possible_label_dirs = [
            dataset_dir / "labels",
            dataset_dir / "train" / "labels",
            dataset_dir / "data" / "labels",
        ]
        
        images_dir = None
        labels_dir = None
        
        for img_dir in possible_image_dirs:
            if img_dir.exists():
                # Check if has image files
                if any(img_dir.glob("*.jpg")) or any(img_dir.glob("*.jpeg")) or any(img_dir.glob("*.png")):
                    images_dir = img_dir
                    break
        
        for lbl_dir in possible_label_dirs:
            if lbl_dir.exists():
                # Check if has label files
                if any(lbl_dir.glob("*.txt")):
                    labels_dir = lbl_dir
                    break
        
        if images_dir and labels_dir:
            logger.info(f"[OK] {dataset_name} structure valid")
            logger.info(f"  Images: {images_dir}")
            logger.info(f"  Labels: {labels_dir}")
            return True
        else:
            logger.warning(f"[!] {dataset_name} structure not found")
            logger.info("Expected structure:")
            logger.info("  dataset/images/  (or dataset/train/images/)")
            logger.info("  dataset/labels/  (or dataset/train/labels/)")
            return False
    
    def download_sh17_kaggle(self) -> bool:
        """
        Download SH17 dataset from Kaggle using API
        
        Returns:
            True if successful, False otherwise
        """
        logger.info("Attempting to download SH17 from Kaggle...")
        
        try:
            import kaggle
        except ImportError:
            logger.warning("Kaggle API not installed")
            logger.info("Install with: pip install kaggle")
            logger.info("Setup: https://www.kaggle.com/docs/api")
            return False
        
        sh17_dir = self.datasets_dir / "sh17"
        sh17_dir.mkdir(parents=True, exist_ok=True)
        
        dataset_name = "mugheesahmad/sh17-dataset-for-ppe-detection"
        
        try:
            logger.info("Downloading from Kaggle (this may take a while)...")
            kaggle.api.dataset_download_files(
                dataset_name,
                path=str(sh17_dir),
                unzip=True
            )
            logger.info("[OK] SH17 downloaded from Kaggle")
            return True
        except Exception as e:
            logger.error(f"Kaggle download failed: {e}")
            logger.info("Alternative: Download manually from:")
            logger.info("  https://www.kaggle.com/datasets/mugheesahmad/sh17-dataset-for-ppe-detection")
            logger.info(f"  Extract to: {sh17_dir}")
            return False
    
    def process_sh17(self) -> Tuple[int, int]:
        """
        Process SH17 dataset for construction domain
        
        Returns:
            Tuple of (train_count, val_count) images processed
        """
        logger.info("Processing SH17 dataset...")
        
        sh17_dir = self.datasets_dir / "sh17"
        
        if not self.validate_dataset_structure(sh17_dir, "SH17"):
            return 0, 0
        
        # Find images and labels directories
        images_dir = None
        labels_dir = None
        
        for img_dir in [sh17_dir / "images", sh17_dir / "train" / "images", sh17_dir / "data" / "images"]:
            if img_dir.exists() and any(img_dir.glob("*.jpg")):
                images_dir = img_dir
                break
        
        for lbl_dir in [sh17_dir / "labels", sh17_dir / "train" / "labels", sh17_dir / "data" / "labels"]:
            if lbl_dir.exists() and any(lbl_dir.glob("*.txt")):
                labels_dir = lbl_dir
                break
        
        if not images_dir or not labels_dir:
            logger.error("SH17 images or labels not found")
            return 0, 0
        
        # Create temp directory
        temp_dir = self.target_dir / "temp_sh17"
        temp_images = temp_dir / "images"
        temp_labels = temp_dir / "labels"
        temp_images.mkdir(parents=True, exist_ok=True)
        temp_labels.mkdir(parents=True, exist_ok=True)
        
        # Filter labels
        label_files = list(labels_dir.glob("*.txt"))
        logger.info(f"Processing {len(label_files)} label files...")
        
        filtered_count = 0
        for label_file in label_files:
            try:
                with open(label_file, 'r') as f:
                    lines = f.readlines()
                
                filtered_lines = []
                for line in lines:
                    parts = line.strip().split()
                    if not parts:
                        continue
                    
                    sh17_class = int(parts[0])
                    if sh17_class in self.sh17_to_construction:
                        construction_class = self.sh17_to_construction[sh17_class]
                        parts[0] = str(construction_class)
                        filtered_lines.append(' '.join(parts) + '\n')
                
                if filtered_lines:
                    target_label = temp_labels / label_file.name
                    with open(target_label, 'w') as f:
                        f.writelines(filtered_lines)
                    filtered_count += 1
            except Exception as e:
                logger.warning(f"Error processing {label_file.name}: {e}")
        
        logger.info(f"Filtered {filtered_count} label files with construction classes")
        
        # Copy corresponding images
        copied_count = 0
        for label_file in temp_labels.glob("*.txt"):
            image_name = label_file.stem
            for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
                image_file = images_dir / f"{image_name}{ext}"
                if image_file.exists():
                    shutil.copy2(image_file, temp_images / image_file.name)
                    copied_count += 1
                    break
        
        logger.info(f"Copied {copied_count} images")
        
        # Split train/val
        random.seed(42)
        all_files = list(temp_images.glob("*.jpg")) + list(temp_images.glob("*.jpeg"))
        random.shuffle(all_files)
        
        split_idx = int(len(all_files) * 0.8)
        train_files = all_files[:split_idx]
        val_files = all_files[split_idx:]
        
        # Move to final location
        train_images_final = self.target_dir / "images" / "train"
        val_images_final = self.target_dir / "images" / "val"
        train_labels_final = self.target_dir / "labels" / "train"
        val_labels_final = self.target_dir / "labels" / "val"
        
        for img_file in train_files:
            label_file = temp_labels / f"{img_file.stem}.txt"
            if label_file.exists():
                shutil.copy2(img_file, train_images_final / img_file.name)
                shutil.copy2(label_file, train_labels_final / label_file.name)
        
        for img_file in val_files:
            label_file = temp_labels / f"{img_file.stem}.txt"
            if label_file.exists():
                shutil.copy2(img_file, val_images_final / img_file.name)
                shutil.copy2(label_file, val_labels_final / label_file.name)
        
        # Cleanup
        shutil.rmtree(temp_dir)
        
        # Count all image formats
        train_count = len(list(train_images_final.glob("*.jpg"))) + \
                     len(list(train_images_final.glob("*.jpeg"))) + \
                     len(list(train_images_final.glob("*.png")))
        val_count = len(list(val_images_final.glob("*.jpg"))) + \
                   len(list(val_images_final.glob("*.jpeg"))) + \
                   len(list(val_images_final.glob("*.png")))
        
        logger.info(f"[OK] SH17 processed: {train_count} train, {val_count} val")
        return train_count, val_count
    
    def process_shel5k(self) -> Tuple[int, int]:
        """
        Process SHEL5K dataset for construction domain
        
        Returns:
            Tuple of (train_count, val_count) images processed
        """
        logger.info("Processing SHEL5K dataset...")
        
        shel5k_dir = self.datasets_dir / "shel5k"
        
        if not self.validate_dataset_structure(shel5k_dir, "SHEL5K"):
            return 0, 0
        
        # Find images and labels
        images_dir = None
        labels_dir = None
        
        for img_dir in [shel5k_dir / "images", shel5k_dir / "train" / "images"]:
            if img_dir.exists():
                images_dir = img_dir
                break
        
        for lbl_dir in [shel5k_dir / "labels", shel5k_dir / "train" / "labels"]:
            if lbl_dir.exists():
                labels_dir = lbl_dir
                break
        
        if not images_dir or not labels_dir:
            logger.error("SHEL5K images or labels not found")
            return 0, 0
        
        # SHEL5K should already be in YOLO format with correct classes
        # Just need to copy and split
        
        all_images = list(images_dir.glob("*.jpg")) + list(images_dir.glob("*.jpeg"))
        random.seed(42)
        random.shuffle(all_images)
        
        split_idx = int(len(all_images) * 0.8)
        train_files = all_images[:split_idx]
        val_files = all_images[split_idx:]
        
        train_images_final = self.target_dir / "images" / "train"
        val_images_final = self.target_dir / "images" / "val"
        train_labels_final = self.target_dir / "labels" / "train"
        val_labels_final = self.target_dir / "labels" / "val"
        
        for img_file in train_files:
            label_file = labels_dir / f"{img_file.stem}.txt"
            if label_file.exists():
                shutil.copy2(img_file, train_images_final / img_file.name)
                shutil.copy2(label_file, train_labels_final / label_file.name)
        
        for img_file in val_files:
            label_file = labels_dir / f"{img_file.stem}.txt"
            if label_file.exists():
                shutil.copy2(img_file, val_images_final / img_file.name)
                shutil.copy2(label_file, val_labels_final / label_file.name)
        
        train_count = len(list(train_images_final.glob("*.jpg")))
        val_count = len(list(val_images_final.glob("*.jpg")))
        
        logger.info(f"[OK] SHEL5K processed: {train_count} train, {val_count} val")
        return train_count, val_count
    
    def create_dataset_yaml(self):
        """Create YOLOv8 dataset.yaml file"""
        classes = list(self.construction_classes.keys())
        
        dataset_config = {
            "path": str(self.target_dir.absolute()),
            "train": "images/train",
            "val": "images/val",
            "names": {i: name for i, name in enumerate(classes)},
            "nc": len(classes),
        }
        
        yaml_path = self.target_dir / "dataset.yaml"
        import yaml
        with open(yaml_path, "w") as f:
            yaml.dump(dataset_config, f, default_flow_style=False)
        
        logger.info(f"[OK] dataset.yaml created: {yaml_path}")
    
    def run(self, download_sh17: bool = False):
        """
        Run complete dataset processing pipeline
        
        Args:
            download_sh17: Whether to attempt Kaggle download
        """
        logger.info("=" * 60)
        logger.info("Professional Dataset Processing Pipeline")
        logger.info(f"Domain: {self.domain.upper()}")
        logger.info("=" * 60)
        
        # Create target directory structure
        (self.target_dir / "images" / "train").mkdir(parents=True, exist_ok=True)
        (self.target_dir / "images" / "val").mkdir(parents=True, exist_ok=True)
        (self.target_dir / "labels" / "train").mkdir(parents=True, exist_ok=True)
        (self.target_dir / "labels" / "val").mkdir(parents=True, exist_ok=True)
        
        # Download SH17 if requested
        if download_sh17:
            self.download_sh17_kaggle()
        
        # Process datasets
        sh17_train, sh17_val = self.process_sh17()
        shel5k_train, shel5k_val = self.process_shel5k()
        
        # Create dataset.yaml
        self.create_dataset_yaml()
        
        # Summary (count all image formats)
        train_dir = self.target_dir / "images" / "train"
        val_dir = self.target_dir / "images" / "val"
        total_train = len(list(train_dir.glob("*.jpg"))) + \
                     len(list(train_dir.glob("*.jpeg"))) + \
                     len(list(train_dir.glob("*.png")))
        total_val = len(list(val_dir.glob("*.jpg"))) + \
                   len(list(val_dir.glob("*.jpeg"))) + \
                   len(list(val_dir.glob("*.png")))
        
        logger.info("=" * 60)
        logger.info("Dataset Processing Complete!")
        logger.info("=" * 60)
        logger.info(f"Total Train Images: {total_train}")
        logger.info(f"Total Val Images: {total_val}")
        logger.info(f"Total: {total_train + total_val}")
        logger.info("")
        logger.info("Next step:")
        logger.info(f"  python scripts/train_model.py --data {self.target_dir}/dataset.yaml")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description="Professional dataset download and processing pipeline"
    )
    parser.add_argument(
        "--domain",
        type=str,
        default="construction",
        choices=["construction", "manufacturing", "combined"],
        help="Target domain"
    )
    parser.add_argument(
        "--download-sh17",
        action="store_true",
        help="Attempt to download SH17 from Kaggle (requires Kaggle API)"
    )
    
    args = parser.parse_args()
    
    processor = DatasetProcessor(domain=args.domain)
    processor.run(download_sh17=args.download_sh17)


if __name__ == "__main__":
    main()

