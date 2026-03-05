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
        # CRITICAL: All domains use best.pt (comprehensive PPE detection model)
        # best.pt detects: head_helmet, vest, boots, hand_glove, glasses, face_mask, Ear-protection
        # Domain differentiation is done via required_ppe rules in database (seed_data.py)
        #
        # Construction: requires head_helmet, vest
        # Manufacturing: requires glasses, Ear-protection, hand_glove
        # Mining: requires head_helmet, boots, etc.
        #
        # This approach is a MICROSERVICE PATTERN where:
        # - Same detection model (best.pt)
        # - Different compliance rules per domain (from database)
        # - Each domain gets its own detector instance (isolated tracking, smoothing)

        registry = {
            "construction": {
                "model_file": "best.pt",  # Comprehensive PPE model
                "fallback": None,  # No fallback - best.pt must exist
                "classes": [
                    "head_helmet", "vest", "boots", "hand_glove", "glasses",
                    "face_mask", "Ear-protection", "protective_suit"
                ],
                "subdirectory": ""  # Root directory
            },
            "manufacturing": {
                "model_file": "best.pt",  # Same model, different required_ppe rules
                "fallback": None,
                "classes": [
                    "head_helmet", "vest", "boots", "hand_glove", "glasses",
                    "face_mask", "Ear-protection", "protective_suit"
                ],
                "subdirectory": ""
            },
            "mining": {
                "model_file": "best.pt",  # Same model, different required_ppe rules
                "fallback": None,
                "classes": [
                    "head_helmet", "vest", "boots", "hand_glove", "glasses",
                    "face_mask", "Ear-protection", "protective_suit"
                ],
                "subdirectory": ""
            },
            "warehouse": {
                "model_file": "best.pt",  # Same model, different required_ppe rules
                "fallback": None,
                "classes": [
                    "head_helmet", "vest", "boots", "hand_glove", "glasses",
                    "face_mask", "Ear-protection", "protective_suit"
                ],
                "subdirectory": ""
            },
            "healthcare": {
                "model_file": "best.pt",  # Same model, different required_ppe rules
                "fallback": None,
                "classes": [
                    "head_helmet", "vest", "boots", "hand_glove", "glasses",
                    "face_mask", "Ear-protection", "protective_suit"
                ],
                "subdirectory": ""
            },
            "food_production": {
                "model_file": "best.pt",  # Same model, different required_ppe rules
                "fallback": None,
                "classes": [
                    "head_helmet", "vest", "boots", "hand_glove", "glasses",
                    "face_mask", "Ear-protection", "protective_suit"
                ],
                "subdirectory": ""
            },
            "laboratory": {
                "model_file": "best.pt",  # Same model, different required_ppe rules
                "fallback": None,
                "classes": [
                    "head_helmet", "vest", "boots", "hand_glove", "glasses",
                    "face_mask", "Ear-protection", "protective_suit"
                ],
                "subdirectory": ""
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
        fallback_file = domain_info.get("fallback")  # Can be None (no fallback)
        subdirectory = domain_info.get("subdirectory", "")

        # Check if model_file is an absolute path first
        from pathlib import Path
        if Path(model_file).is_absolute() and Path(model_file).exists():
            logger.info(f"Using model from absolute path: {model_file}")
            return str(Path(model_file).absolute())

        # Check project root (for best.pt)
        project_root = Path(__file__).parent.parent.parent  # backend/ml_engine -> backend -> project_root
        root_model = project_root / model_file
        if root_model.exists():
            logger.info(f"Using model from project root: {root_model}")
            return str(root_model.absolute())

        # Check domain-specific subdirectory in models dir
        if subdirectory:
            domain_model_path = self.models_dir / subdirectory / model_file
            if domain_model_path.exists():
                logger.info(f"Using domain-specific model: {domain_model_path}")
                return str(domain_model_path)

        # Check models root directory
        root_model_path = self.models_dir / model_file
        if root_model_path.exists():
            logger.info(f"Using model from models dir: {root_model_path}")
            return str(root_model_path)

        # Try fallback model (only if fallback is not None)
        if fallback_file:
            fallback_path = self.models_dir / fallback_file
            if fallback_path.exists():
                logger.warning(f"Primary model not found, using fallback: {fallback_path}")
                return str(fallback_path)

            # Check if fallback is a Hugging Face model ID (contains '/')
            if '/' in fallback_file:
                logger.info(f"Using Hugging Face model: {fallback_file}")
                return fallback_file  # Return Hugging Face model ID as string

            # Use YOLO pre-trained (will be downloaded automatically)
            if fallback_file.startswith("yolov8") or fallback_file.startswith("yolo11"):
                logger.info(f"Using YOLOv8 pre-trained model: {fallback_file}")
                return fallback_file  # Return string, YOLO will download

        logger.error(f"No model found for domain: {domain_type}, model_file={model_file}, no fallback available")
        logger.error(f"Searched locations: project_root={project_root / model_file}, models_dir={self.models_dir / model_file}")
        return None
    
    def register_model(self, domain_type: str, model_file: str, classes: list = None, subdirectory: str = None):
        """
        Register a new model for a domain (ALWAYS OVERWRITES existing)

        Args:
            domain_type: Domain type
            model_file: Model filename (relative to models_dir or subdirectory)
            classes: List of class names the model can detect (optional)
            subdirectory: Subdirectory within models_dir (optional)
        """
        # CRITICAL FIX: Always create/overwrite the domain entry
        # This allows main.py to override default HuggingFace models with best.pt
        if domain_type not in self._registry:
            self._registry[domain_type] = {}

        # Always update model_file (override existing)
        self._registry[domain_type]["model_file"] = model_file
        self._registry[domain_type]["fallback"] = None  # Clear fallback to prevent yolov8n.pt usage

        if classes:
            self._registry[domain_type]["classes"] = classes
        if subdirectory:
            self._registry[domain_type]["subdirectory"] = subdirectory

        logger.info(f"Registered model '{model_file}' for domain '{domain_type}' (OVERWRITE)")
    
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

