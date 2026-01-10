"""
Model Downloader - Download domain-specific PPE detection models
Supports multiple sources: Hugging Face, Roboflow, direct URLs
"""

from pathlib import Path
from typing import Dict, Optional
import asyncio
from backend.config import settings
from backend.utils.logger import logger


class ModelDownloader:
    """
    Downloads and manages PPE detection models for different domains

    Supported sources:
    - Hugging Face models (via ultralyticsplus)
    - Roboflow datasets/models
    - Direct download URLs
    """

    # Model source configurations
    # Based on comprehensive research in docs/MULTI_DOMAIN_MODEL_RESEARCH.md
    MODELS = {
        "construction": {
            "source": "url",
            "model_id": "workspace-safety-yolov8",
            "url": "https://github.com/hafizqaim/Workspace-Safety-Detection-using-YOLOv8/releases/download/v1.0.0/best.pt",
            "filename": "workspace_safety_yolov8_best.pt",
            "description": "Workspace Safety YOLOv8 - Best for construction (86.6% helmet, 93.5% vest mAP50)",
            "subdirectory": "construction"
        },
        "manufacturing": {
            "source": "url",
            "model_id": "workspace-safety-yolov8",
            "url": "https://github.com/hafizqaim/Workspace-Safety-Detection-using-YOLOv8/releases/download/v1.0.0/best.pt",
            "filename": "workspace_safety_yolov8_best.pt",
            "description": "Workspace Safety YOLOv8 - Comprehensive manufacturing PPE (17 classes: glasses, ear-protection, gloves, mask, shoes, boots, + vest/helmet available)",
            "subdirectory": "manufacturing"
        },
        "mining": {
            "source": "url",
            "model_id": "workspace-safety-yolov8",
            "url": "https://github.com/hafizqaim/Workspace-Safety-Detection-using-YOLOv8/releases/download/v1.0.0/best.pt",
            "filename": "workspace_safety_yolov8_best.pt",
            "description": "Workspace Safety YOLOv8 - Reused for mining (covers helmet, vest, boots, gloves)",
            "subdirectory": "mining"
        },
        "warehouse": {
            "source": "url",
            "model_id": "workspace-safety-yolov8",
            "url": "https://github.com/hafizqaim/Workspace-Safety-Detection-using-YOLOv8/releases/download/v1.0.0/best.pt",
            "filename": "workspace_safety_yolov8_best.pt",
            "description": "Workspace Safety YOLOv8 - Reused for warehouse (covers vest, helmet, boots, gloves)",
            "subdirectory": "warehouse"
        },
        "healthcare": {
            "source": "huggingface",
            "model_id": "keremberke/yolov8m-protective-equipment-detection",
            "filename": "ppe-detection-healthcare-hf.pt",
            "description": "Hugging Face PPE detection - Best available for healthcare (covers gloves, mask, goggles). Note: Missing gown and face shield - requires custom training.",
            "subdirectory": "healthcare"
        },
        "food_production": {
            "source": "huggingface",
            "model_id": "keremberke/yolov8m-protective-equipment-detection",
            "filename": "ppe-detection-food-hf.pt",
            "description": "Hugging Face PPE detection - Best available for food production (covers gloves, mask, shoes). Note: Missing hairnet and apron - requires custom training.",
            "subdirectory": "food_industry"
        }
    }

    def __init__(self):
        """Initialize model downloader"""
        self.models_dir = settings.models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)

    async def download_model(self, domain: str) -> Dict:
        """
        Download model for a specific domain

        Args:
            domain: Domain type (e.g., "construction")

        Returns:
            {
                "success": bool,
                "path": str | None,
                "message": str
            }
        """
        if domain not in self.MODELS:
            return {
                "success": False,
                "path": None,
                "message": f"No model configuration for domain: {domain}"
            }

        config = self.MODELS[domain]
        source = config["source"]
        subdirectory = config.get("subdirectory", "")

        # Create subdirectory if needed
        if subdirectory:
            subdir_path = self.models_dir / subdirectory
            subdir_path.mkdir(parents=True, exist_ok=True)

        if source == "huggingface":
            return await self._download_from_huggingface(domain, config)
        elif source == "roboflow":
            return await self._download_from_roboflow(domain, config)
        elif source == "url":
            return await self._download_from_url(domain, config)
        elif source == "placeholder":
            return {
                "success": False,
                "path": None,
                "message": f"Model download not yet implemented for {domain}. Please download manually from Roboflow Universe."
            }
        else:
            return {
                "success": False,
                "path": None,
                "message": f"Unknown source: {source}"
            }

    async def _download_from_huggingface(self, domain: str, config: Dict) -> Dict:
        """
        Download model from Hugging Face

        Note: Hugging Face models are loaded on-demand by ultralyticsplus,
        so we just need to ensure the package is installed.
        """
        try:
            # Try importing ultralyticsplus
            try:
                from ultralyticsplus import YOLO
            except ImportError:
                return {
                    "success": False,
                    "path": None,
                    "message": "ultralyticsplus not installed. Run: pip install ultralyticsplus"
                }

            model_id = config["model_id"]
            logger.info(f"Hugging Face model '{model_id}' will be downloaded on first use")

            # HF models don't need pre-download, they're loaded on demand
            return {
                "success": True,
                "path": model_id,  # Return model ID as path
                "message": f"Hugging Face model configured: {model_id}"
            }

        except Exception as e:
            logger.error(f"Failed to configure Hugging Face model: {e}")
            return {
                "success": False,
                "path": None,
                "message": f"Error: {str(e)}"
            }

    async def _download_from_roboflow(self, domain: str, config: Dict) -> Dict:
        """
        Download model from Roboflow

        Requires:
        - Roboflow API key (in environment)
        - roboflow package installed
        """
        try:
            from roboflow import Roboflow
        except ImportError:
            return {
                "success": False,
                "path": None,
                "message": "roboflow package not installed. Run: pip install roboflow"
            }

        # TODO: Implement Roboflow download
        # This requires API key and project/version info
        return {
            "success": False,
            "path": None,
            "message": "Roboflow download not yet implemented. Download weights manually."
        }

    async def _download_from_url(self, domain: str, config: Dict) -> Dict:
        """Download model from direct URL"""
        try:
            import httpx
            import asyncio
            
            url = config.get("url")
            if not url:
                return {
                    "success": False,
                    "path": None,
                    "message": "No URL provided in model configuration"
                }
            
            filename = config.get("filename", "model.pt")
            subdirectory = config.get("subdirectory", "")
            
            # Determine save path
            if subdirectory:
                save_path = self.models_dir / subdirectory / filename
            else:
                save_path = self.models_dir / filename
            
            # Check if already downloaded
            if save_path.exists():
                logger.info(f"Model already exists: {save_path}")
                return {
                    "success": True,
                    "path": str(save_path),
                    "message": f"Model already exists at {save_path}"
                }
            
            # Download model
            logger.info(f"Downloading model from {url}...")
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.get(url, follow_redirects=True)
                response.raise_for_status()
                
                # Save to file
                save_path.parent.mkdir(parents=True, exist_ok=True)
                with open(save_path, "wb") as f:
                    f.write(response.content)
            
            logger.info(f"Model downloaded successfully to {save_path}")
            return {
                "success": True,
                "path": str(save_path),
                "message": f"Model downloaded to {save_path}"
            }
            
        except ImportError:
            return {
                "success": False,
                "path": None,
                "message": "httpx not installed. Run: pip install httpx"
            }
        except Exception as e:
            logger.error(f"Failed to download model from URL: {e}")
            return {
                "success": False,
                "path": None,
                "message": f"Error downloading model: {str(e)}"
            }

    def get_model_info(self, domain: str) -> Optional[Dict]:
        """Get model configuration info for a domain"""
        return self.MODELS.get(domain)

    def list_available_models(self) -> Dict[str, Dict]:
        """List all available model configurations"""
        return self.MODELS.copy()


# Convenience function
async def download_model_for_domain(domain: str) -> Dict:
    """
    Download model for a specific domain

    Args:
        domain: Domain type

    Returns:
        Download result dict
    """
    downloader = ModelDownloader()
    return await downloader.download_model(domain)
