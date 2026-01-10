"""
Model Registry - Domain-based model management
Maps domains to their trained models
"""

from pathlib import Path
from typing import Dict, Optional
from backend.config import settings
from backend.utils.logger import logger


class ModelRegistry:
    """
    Manages domain-specific models
    
    Each domain can have its own trained model:
    - construction → construction_v1.pt
    - manufacturing → manufacturing_v1.pt
    - mining → mining_v1.pt (future)
    
    Usage:
        registry = ModelRegistry()
        model_path = registry.get_model_for_domain("construction")
    """
    
    def __init__(self):
        """Initialize model registry"""
        self.models_dir = settings.models_dir
        self._registry = self._load_registry()
    
    def _load_registry(self) -> Dict[str, Dict]:
        """
        Load domain → model mapping with metadata

        Returns:
            Dictionary mapping domain types to model info
        """
        # Enhanced registry with model metadata
        # Based on comprehensive research in docs/MULTI_DOMAIN_MODEL_RESEARCH.md
        registry = {
            "construction": {
                "model_file": "workspace_safety_yolov8_best.pt",  # Workspace Safety YOLOv8 - Best for construction
                "fallback": "yolov8n.pt",
                "classes": [
                    "Barefoots", "Ear-protection", "Harness", "No_Ear-Protection", "No_Glasses",
                    "Sandals", "boots", "face_mask", "face_nomask", "glasses", "hand_glove",
                    "hand_noglove", "head_helmet", "head_nohelmet", "person", "shoes", "vest"
                ],
                "subdirectory": "construction"
            },
            "manufacturing": {
                "model_file": "workspace_safety_yolov8_best.pt",  # Workspace Safety YOLOv8 - Comprehensive (17 classes)
                "fallback": "yolov8n.pt",
                "classes": [
                    "Barefoots", "Ear-protection", "Harness", "No_Ear-Protection", "No_Glasses",
                    "Sandals", "boots", "face_mask", "face_nomask", "glasses", "hand_glove",
                    "hand_noglove", "head_helmet", "head_nohelmet", "person", "shoes", "vest"
                ],
                "subdirectory": "manufacturing"
            },
            "mining": {
                "model_file": "workspace_safety_yolov8_best.pt",  # Workspace Safety YOLOv8 - Best for mining
                "fallback": "yolov8n.pt",
                "classes": [
                    "Barefoots", "Ear-protection", "Harness", "No_Ear-Protection", "No_Glasses",
                    "Sandals", "boots", "face_mask", "face_nomask", "glasses", "hand_glove",
                    "hand_noglove", "head_helmet", "head_nohelmet", "person", "shoes", "vest"
                ],
                "subdirectory": "mining"
            },
            "warehouse": {
                "model_file": "workspace_safety_yolov8_best.pt",  # Workspace Safety YOLOv8 - Best for warehouse
                "fallback": "yolov8n.pt",
                "classes": [
                    "Barefoots", "Ear-protection", "Harness", "No_Ear-Protection", "No_Glasses",
                    "Sandals", "boots", "face_mask", "face_nomask", "glasses", "hand_glove",
                    "hand_noglove", "head_helmet", "head_nohelmet", "person", "shoes", "vest"
                ],
                "subdirectory": "warehouse"
            },
            "healthcare": {
                "model_file": "ppe-detection-healthcare-hf.pt",
                "fallback": "keremberke/yolov8m-protective-equipment-detection",  # Hugging Face model ID
                "classes": [
                    "glove", "no_glove", "goggles", "no_goggles", "helmet", "no_helmet",
                    "mask", "no_mask", "no_shoes", "shoes"
                ],
                "subdirectory": "healthcare"
            },
            "food_production": {
                "model_file": "ppe-detection-food-hf.pt",
                "fallback": "keremberke/yolov8m-protective-equipment-detection",  # Hugging Face model ID
                "classes": [
                    "glove", "no_glove", "goggles", "no_goggles", "helmet", "no_helmet",
                    "mask", "no_mask", "no_shoes", "shoes"
                ],
                "subdirectory": "food_industry"
            },
            "laboratory": {
                "model_file": "lab-safety-custom.pt",
                "fallback": "yolov8n.pt",
                "classes": ["lab coat", "safety glasses", "gloves", "closed-toe shoes"],
                "subdirectory": "laboratory"
            }
        }

        return registry
    
    def get_model_for_domain(self, domain_type: str) -> Optional[str]:
        """
        Get model path for a specific domain

        Args:
            domain_type: Domain type (e.g., "construction")

        Returns:
            Path to model file, or None if not found (will use default)
        """
        if domain_type not in self._registry:
            logger.warning(f"No model registered for domain: {domain_type}")
            logger.info("Using default YOLOv8 model")
            return None

        domain_info = self._registry[domain_type]
        model_file = domain_info["model_file"]
        fallback_file = domain_info.get("fallback", "yolov8n.pt")
        subdirectory = domain_info.get("subdirectory", "")

        # Check domain-specific subdirectory first
        if subdirectory:
            domain_model_path = self.models_dir / subdirectory / model_file
            if domain_model_path.exists():
                logger.info(f"Using domain-specific model: {domain_model_path}")
                return domain_model_path

        # Check models root directory
        root_model_path = self.models_dir / model_file
        if root_model_path.exists():
            logger.info(f"Using model from root: {root_model_path}")
            return root_model_path

        # Try fallback model
        fallback_path = self.models_dir / fallback_file
        if fallback_path.exists():
            logger.warning(f"Primary model not found, using fallback: {fallback_path}")
            return fallback_path

        # Check if fallback is a Hugging Face model ID (contains '/')
        if '/' in fallback_file:
            logger.info(f"Using Hugging Face model: {fallback_file}")
            return fallback_file  # Return Hugging Face model ID as string
        
        # Use YOLO pre-trained (will be downloaded automatically)
        if fallback_file.startswith("yolov8") or fallback_file.startswith("yolo11"):
            logger.info(f"Using YOLOv8 pre-trained model: {fallback_file}")
            return fallback_file  # Return string, YOLO will download

        logger.error(f"No model found for domain: {domain_type}")
        return None
    
    def register_model(self, domain_type: str, model_file: str, classes: list = None, subdirectory: str = None):
        """
        Register a new model for a domain

        Args:
            domain_type: Domain type
            model_file: Model filename (relative to models_dir or subdirectory)
            classes: List of class names the model can detect (optional)
            subdirectory: Subdirectory within models_dir (optional)
        """
        if domain_type not in self._registry:
            self._registry[domain_type] = {}

        self._registry[domain_type]["model_file"] = model_file
        if classes:
            self._registry[domain_type]["classes"] = classes
        if subdirectory:
            self._registry[domain_type]["subdirectory"] = subdirectory

        logger.info(f"Registered model '{model_file}' for domain '{domain_type}'")
    
    def list_domains(self) -> Dict[str, Dict]:
        """Get all registered domain → model mappings"""
        return self._registry.copy()

    def get_model_classes(self, domain_type: str) -> list:
        """
        Get list of class names the domain's model can detect

        Args:
            domain_type: Domain type (e.g., "construction")

        Returns:
            List of class names, or empty list if not found
        """
        if domain_type not in self._registry:
            return []

        return self._registry[domain_type].get("classes", [])

    def get_model_status(self, domain_type: str) -> Dict:
        """
        Get detailed model status for a domain

        Returns:
            {
                "domain": "construction",
                "model_file": "ppe-detection-9fkpv.pt",
                "fallback": "ppe_detection_yolov8.pt",
                "exists": True,
                "path": "/path/to/model",
                "status": "loaded" | "using_fallback" | "missing" | "downloading",
                "classes": ["Hardhat", "Safety Vest", ...]
            }
        """
        if domain_type not in self._registry:
            return {
                "domain": domain_type,
                "model_file": "unknown",
                "exists": False,
                "path": None,
                "status": "missing",
                "classes": []
            }

        domain_info = self._registry[domain_type]
        model_file = domain_info["model_file"]
        fallback_file = domain_info.get("fallback", "yolov8n.pt")
        subdirectory = domain_info.get("subdirectory", "")
        classes = domain_info.get("classes", [])

        # Check primary model in subdirectory
        if subdirectory:
            domain_model_path = self.models_dir / subdirectory / model_file
            if domain_model_path.exists():
                return {
                    "domain": domain_type,
                    "model_file": model_file,
                    "fallback": fallback_file,
                    "exists": True,
                    "path": str(domain_model_path),
                    "status": "loaded",
                    "classes": classes
                }

        # Check root directory
        root_model_path = self.models_dir / model_file
        if root_model_path.exists():
            return {
                "domain": domain_type,
                "model_file": model_file,
                "fallback": fallback_file,
                "exists": True,
                "path": str(root_model_path),
                "status": "loaded",
                "classes": classes
            }

        # Check fallback
        fallback_path = self.models_dir / fallback_file
        if fallback_path.exists():
            return {
                "domain": domain_type,
                "model_file": model_file,
                "fallback": fallback_file,
                "exists": True,
                "path": str(fallback_path),
                "status": "using_fallback",
                "classes": classes
            }

        # Model missing
        return {
            "domain": domain_type,
            "model_file": model_file,
            "fallback": fallback_file,
            "exists": False,
            "path": None,
            "status": "missing",
            "classes": classes
        }


# Global registry instance
_registry_instance = None


def get_registry() -> ModelRegistry:
    """Get global model registry instance (singleton)"""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = ModelRegistry()
    return _registry_instance

