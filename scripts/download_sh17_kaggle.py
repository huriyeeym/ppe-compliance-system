"""
SH17 Dataset Download Helper
Downloads SH17 dataset from Kaggle (requires Kaggle API)

Usage:
    # 1. Install Kaggle API
    pip install kaggle
    
    # 2. Setup Kaggle credentials
    # Place kaggle.json in ~/.kaggle/ (or C:/Users/USERNAME/.kaggle/ on Windows)
    
    # 3. Run script
    python scripts/download_sh17_kaggle.py
"""

import os
import zipfile
import shutil
from pathlib import Path
import sys

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.logger import logger


def download_from_kaggle():
    """
    Download SH17 dataset from Kaggle using Kaggle API
    
    Requires:
    - kaggle package: pip install kaggle
    - Kaggle API credentials: ~/.kaggle/kaggle.json
    """
    try:
        import kaggle
    except ImportError:
        logger.error("Kaggle API not installed")
        logger.info("Install with: pip install kaggle")
        logger.info("Then setup credentials: https://www.kaggle.com/docs/api")
        return False
    
    logger.info("Downloading SH17 dataset from Kaggle...")
    
    dataset_name = "mugheesahmad/sh17-dataset-for-ppe-detection"
    download_dir = project_root / "data" / "datasets" / "sh17"
    download_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        # Download dataset
        kaggle.api.dataset_download_files(
            dataset_name,
            path=str(download_dir),
            unzip=True
        )
        
        logger.info("SH17 dataset downloaded successfully!")
        logger.info(f"Location: {download_dir}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to download from Kaggle: {e}")
        logger.info("Alternative: Download manually from:")
        logger.info("  https://www.kaggle.com/datasets/mugheesahmad/sh17-dataset-for-ppe-detection")
        logger.info(f"  Extract to: {download_dir}")
        return False


def download_from_pexels():
    """
    Download SH17 images from Pexels using provided script
    
    Note: This will download 8,099 images, which may take a long time
    """
    logger.info("Downloading SH17 images from Pexels...")
    logger.warning("This will download 8,099 images and may take a long time")
    
    sh17_data_dir = project_root / "data" / "datasets" / "sh17" / "data"
    
    if not (sh17_data_dir / "download_from_pexels.py").exists():
        logger.error("download_from_pexels.py not found")
        return False
    
    # Change to data directory
    original_dir = os.getcwd()
    os.chdir(sh17_data_dir)
    
    try:
        # Run download script
        import subprocess
        result = subprocess.run(
            ["python", "download_from_pexels.py"],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            logger.info("Images downloaded successfully!")
            return True
        else:
            logger.error(f"Download failed: {result.stderr}")
            return False
            
    except Exception as e:
        logger.error(f"Error running download script: {e}")
        return False
    finally:
        os.chdir(original_dir)


def main():
    """Main download function"""
    logger.info("=" * 60)
    logger.info("SH17 Dataset Download")
    logger.info("=" * 60)
    
    logger.info("Choose download method:")
    logger.info("  1. Kaggle API (recommended, faster)")
    logger.info("  2. Pexels script (slower, 8,099 images)")
    logger.info("  3. Manual download instructions")
    
    # For now, show instructions
    logger.info("")
    logger.info("=" * 60)
    logger.info("MANUAL DOWNLOAD INSTRUCTIONS (Recommended)")
    logger.info("=" * 60)
    logger.info("")
    logger.info("1. Go to Kaggle:")
    logger.info("   https://www.kaggle.com/datasets/mugheesahmad/sh17-dataset-for-ppe-detection")
    logger.info("")
    logger.info("2. Click 'Download' button")
    logger.info("")
    logger.info("3. Extract ZIP file to:")
    logger.info(f"   {project_root / 'data' / 'datasets' / 'sh17'}")
    logger.info("")
    logger.info("4. Expected structure:")
    logger.info("   sh17/")
    logger.info("   ├── images/")
    logger.info("   │   ├── *.jpg")
    logger.info("   │   └── *.jpeg")
    logger.info("   └── labels/")
    logger.info("       └── *.txt")
    logger.info("")
    logger.info("5. After download, run:")
    logger.info("   python scripts/process_sh17.py")


if __name__ == "__main__":
    main()

