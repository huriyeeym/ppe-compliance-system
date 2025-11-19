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
    
    def _load_registry(self) -> Dict[str, str]:
        """
        Load domain → model mapping
        
        Returns:
            Dictionary mapping domain types to model files
        """
        # Default registry
        registry = {
            # Active domains
            "construction": "construction_manufacturing_v1.pt",  # Combined model (phase 1)
            "manufacturing": "construction_manufacturing_v1.pt",  # Same model initially
            
            # Planned domains (will use base model until trained)
            "mining": "yolov8n.pt",  # Pre-trained YOLO (fallback)
            "healthcare": "yolov8n.pt",
            "food_production": "yolov8n.pt"
        }
        
        return registry
    
    def get_model_for_domain(self, domain_type: str) -> Optional[Path]:
        """
        Get model path for a specific domain
        
        Args:
            domain_type: Domain type (e.g., "construction")
        
        Returns:
            Path to model file, or None if not found
        """
        if domain_type not in self._registry:
            logger.warning(f"No model registered for domain: {domain_type}")
            logger.info("Using default YOLOv8 model")
            return None
        
        model_file = self._registry[domain_type]
        model_path = self.models_dir / model_file
        
        # Check if custom model exists
        if not model_path.exists() and not model_file.startswith("yolov8"):
            logger.warning(f"Model file not found: {model_path}")
            logger.info("Falling back to YOLOv8 pre-trained")
            return None
        
        return model_path if model_path.exists() else model_file
    
    def register_model(self, domain_type: str, model_file: str):
        """
        Register a new model for a domain
        
        Args:
            domain_type: Domain type
            model_file: Model filename (relative to models_dir)
        """
        self._registry[domain_type] = model_file
        logger.info(f"Registered model '{model_file}' for domain '{domain_type}'")
    
    def list_domains(self) -> Dict[str, str]:
        """Get all registered domain → model mappings"""
        return self._registry.copy()
    
    def get_model_status(self, domain_type: str) -> Dict:
        """
        Get detailed model status for a domain
        
        Returns:
            {
                "domain": "construction",
                "model_file": "construction_v1.pt",
                "exists": True,
                "path": "/path/to/model",
                "status": "active" | "missing" | "using_default"
            }
        """
        model_file = self._registry.get(domain_type, "unknown")
        model_path = self.models_dir / model_file
        
        if model_file.startswith("yolov8"):
            status = "using_default"
            exists = True  # Will be downloaded if needed
        elif model_path.exists():
            status = "active"
            exists = True
        else:
            status = "missing"
            exists = False
        
        return {
            "domain": domain_type,
            "model_file": model_file,
            "exists": exists,
            "path": str(model_path) if exists else None,
            "status": status
        }


# Global registry instance
_registry_instance = None


def get_registry() -> ModelRegistry:
    """Get global model registry instance (singleton)"""
    global _registry_instance
    if _registry_instance is None:
        _registry_instance = ModelRegistry()
    return _registry_instance

