"""
Custom Test Data Ekleme Scripti
Kullanıcının kendi reflektör yelek ve baret fotoğraflarını veri setine ekler

Usage:
    python scripts/add_custom_test_data.py --images-dir path/to/images --domain construction
"""

import argparse
import shutil
from pathlib import Path
import sys
from typing import List, Tuple
import cv2
import yaml

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger


class CustomDataProcessor:
    """
    Kullanıcının kendi test verilerini işler ve veri setine ekler
    """
    
    def __init__(self, domain: str = "construction"):
        """
        Initialize custom data processor
        
        Args:
            domain: Target domain (construction, manufacturing, etc.)
        """
        self.domain = domain
        self.project_root = project_root
        self.datasets_dir = project_root / "data" / "datasets"
        self.target_dir = self.datasets_dir / domain
        
        # Construction domain classes
        self.classes = {
            "person": 0,
            "hard_hat": 1,
            "safety_vest": 2,
        }
    
    def validate_image(self, image_path: Path) -> bool:
        """
        Validate image file
        
        Args:
            image_path: Path to image file
            
        Returns:
            True if valid, False otherwise
        """
        try:
            img = cv2.imread(str(image_path))
            if img is None:
                return False
            return True
        except Exception as e:
            logger.warning(f"Error validating {image_path.name}: {e}")
            return False
    
    def create_label_file(self, image_path: Path, annotations: List[Tuple[int, float, float, float, float]]) -> Path:
        """
        Create YOLOv8 format label file
        
        Args:
            image_path: Path to image file
            annotations: List of (class_id, x_center, y_center, width, height) in normalized coordinates
            
        Returns:
            Path to created label file
        """
        label_path = self.target_dir / "labels" / "train" / f"{image_path.stem}.txt"
        label_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(label_path, 'w') as f:
            for class_id, x_center, y_center, width, height in annotations:
                f.write(f"{class_id} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n")
        
        return label_path
    
    def process_images(self, images_dir: Path, auto_annotate: bool = False) -> Tuple[int, int]:
        """
        Process custom images and add to dataset
        
        Args:
            images_dir: Directory containing custom images
            auto_annotate: If True, use pre-trained model for auto-annotation (future feature)
            
        Returns:
            Tuple of (train_count, val_count) images added
        """
        if not images_dir.exists():
            logger.error(f"Images directory not found: {images_dir}")
            return 0, 0
        
        # Find all image files
        image_extensions = ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']
        image_files = []
        for ext in image_extensions:
            image_files.extend(list(images_dir.glob(f"*{ext}")))
        
        if len(image_files) == 0:
            logger.error(f"No images found in {images_dir}")
            return 0, 0
        
        logger.info(f"Found {len(image_files)} images")
        
        # Validate images
        valid_images = []
        for img_file in image_files:
            if self.validate_image(img_file):
                valid_images.append(img_file)
            else:
                logger.warning(f"Invalid image: {img_file.name}")
        
        logger.info(f"Valid images: {len(valid_images)}")
        
        if len(valid_images) == 0:
            logger.error("No valid images found")
            return 0, 0
        
        # Copy images to train directory
        train_images_dir = self.target_dir / "images" / "train"
        train_images_dir.mkdir(parents=True, exist_ok=True)
        
        copied_count = 0
        for img_file in valid_images:
            try:
                # Copy image
                target_image = train_images_dir / img_file.name
                shutil.copy2(img_file, target_image)
                copied_count += 1
                
                # Check if label file exists
                label_file = images_dir / f"{img_file.stem}.txt"
                if label_file.exists():
                    # Copy existing label
                    target_label = self.target_dir / "labels" / "train" / label_file.name
                    target_label.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copy2(label_file, target_label)
                    logger.info(f"[OK] Copied {img_file.name} with label")
                else:
                    # Create placeholder label (user needs to annotate manually)
                    placeholder_label = self.target_dir / "labels" / "train" / f"{img_file.stem}.txt"
                    placeholder_label.parent.mkdir(parents=True, exist_ok=True)
                    placeholder_label.write_text("# TODO: Annotate this image\n")
                    logger.warning(f"[!] {img_file.name} - label file not found, placeholder created")
                    logger.info(f"    Please annotate: {placeholder_label}")
                    
            except Exception as e:
                logger.error(f"Error copying {img_file.name}: {e}")
        
        logger.info(f"[OK] Copied {copied_count} images to train set")
        
        return copied_count, 0
    
    def create_annotation_guide(self):
        """
        Create annotation guide for manual labeling
        """
        guide_path = self.target_dir / "ANNOTATION_GUIDE.md"
        
        guide_content = f"""# Annotation Guide - Custom Test Data

## Sınıflar (Construction Domain)

- **0: person** - Kişi
- **1: hard_hat** - Baret/Kask
- **2: safety_vest** - Reflektör Yelek

## YOLOv8 Format

Her görüntü için bir `.txt` dosyası oluştur:
- Dosya adı: `image_name.txt` (örnek: `my_photo.jpg` → `my_photo.txt`)
- Format: `class_id x_center y_center width height`
- Tüm değerler **normalize edilmiş** (0-1 arası)

### Örnek

```
1 0.5 0.5 0.2 0.3
2 0.3 0.4 0.15 0.25
```

Bu örnek:
- Baret (class 1) görüntünün ortasında, %20 genişlik, %30 yükseklik
- Yelek (class 2) görüntünün sol üstünde, %15 genişlik, %25 yükseklik

## Annotation Araçları

1. **LabelImg** (Önerilen)
   - https://github.com/tzutalin/labelImg
   - YOLO formatını destekler
   - Windows: `pip install labelImg`

2. **Roboflow**
   - https://roboflow.com/
   - Web tabanlı, ücretsiz

3. **CVAT**
   - https://cvat.org/
   - Profesyonel, açık kaynak

## Adımlar

1. Görüntüleri `data/datasets/construction/images/train/` klasörüne kopyala
2. LabelImg ile aç ve annotate et
3. Label dosyalarını `data/datasets/construction/labels/train/` klasörüne kaydet
4. Model eğitimine başla!

---

**Son Güncelleme:** 19 Kasım 2025
"""
        
        with open(guide_path, 'w', encoding='utf-8') as f:
            f.write(guide_content)
        
        logger.info(f"[OK] Annotation guide created: {guide_path}")


def main():
    """Main function"""
    parser = argparse.ArgumentParser(
        description="Add custom test data to dataset"
    )
    parser.add_argument(
        "--images-dir",
        type=str,
        required=False,
        help="Directory containing custom images"
    )
    parser.add_argument(
        "--domain",
        type=str,
        default="construction",
        choices=["construction", "manufacturing"],
        help="Target domain"
    )
    parser.add_argument(
        "--create-guide",
        action="store_true",
        help="Create annotation guide"
    )
    
    args = parser.parse_args()
    
    processor = CustomDataProcessor(domain=args.domain)
    
    if args.create_guide:
        processor.create_annotation_guide()
        return
    
    if not args.images_dir:
        parser.error("--images-dir is required when not using --create-guide")
    
    images_dir = Path(args.images_dir)
    if not images_dir.exists():
        logger.error(f"Images directory not found: {images_dir}")
        return
    
    logger.info("=" * 60)
    logger.info("Custom Test Data Processing")
    logger.info("=" * 60)
    logger.info(f"Domain: {args.domain.upper()}")
    logger.info(f"Images directory: {images_dir}")
    logger.info("")
    
    train_count, val_count = processor.process_images(images_dir)
    
    logger.info("")
    logger.info("=" * 60)
    logger.info("Processing Complete!")
    logger.info("=" * 60)
    logger.info(f"Added {train_count} images to train set")
    logger.info(f"Added {val_count} images to val set")
    logger.info("")
    
    if train_count > 0:
        logger.info("Next steps:")
        logger.info("1. Annotate images using LabelImg or Roboflow")
        logger.info("2. Place label files (.txt) in:")
        logger.info(f"   {processor.target_dir / 'labels' / 'train'}")
        logger.info("3. Run model training:")
        logger.info(f"   python scripts/train_model.py --data {processor.target_dir}/dataset.yaml")


if __name__ == "__main__":
    main()

