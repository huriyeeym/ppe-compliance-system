"""
Face Recognition Service using DeepFace
Handles face encoding extraction and user matching for violation snapshots
"""

from pathlib import Path
from typing import List, Optional, Tuple
import numpy as np
from deepface import DeepFace
from backend.config import settings
from backend.utils.logger import logger
from backend.database import crud
from sqlalchemy.ext.asyncio import AsyncSession


class FaceRecognitionService:
    """
    Face recognition service for matching violation snapshots with user photos
    
    Uses DeepFace library with VGG-Face model for face encoding and comparison
    """
    
    def __init__(self, model_name: str = None, threshold: float = None):
        """
        Initialize face recognition service
        
        Args:
            model_name: DeepFace model name (default: from settings)
            threshold: Minimum confidence threshold for matches (default: from settings)
        """
        self.model_name = model_name or settings.face_recognition_model
        self.threshold = threshold or settings.face_recognition_threshold
        logger.info(f"FaceRecognitionService initialized with model: {self.model_name}, threshold: {self.threshold}")
    
    def extract_face_encoding(self, image_path: str) -> Optional[List[float]]:
        """
        Extract face encoding from an image
        
        Args:
            image_path: Path to image file
            
        Returns:
            Face encoding vector (list of floats) or None if no face detected
        """
        try:
            # DeepFace returns a dictionary with 'embedding' key
            # DeepFace 0.0.96 with TensorFlow 2.20 should work without backend parameter
            result = DeepFace.represent(
                img_path=image_path,
                model_name=self.model_name,
                enforce_detection=False  # Don't raise error if no face found
            )
            
            if not result or len(result) == 0:
                logger.warning(f"No face detected in image: {image_path}")
                return None
            
            # If multiple faces, use the first one (largest confidence)
            # result is a list of dictionaries, each with 'embedding' key
            if isinstance(result, list) and len(result) > 0:
                encoding = result[0].get('embedding', None)
                if encoding is None:
                    logger.warning(f"No embedding found in DeepFace result for: {image_path}")
                    return None
                
                # Convert numpy array to list
                if isinstance(encoding, np.ndarray):
                    encoding = encoding.tolist()
                
                logger.info(f"Face encoding extracted successfully from: {image_path} (length: {len(encoding)})")
                return encoding
            else:
                logger.warning(f"Unexpected DeepFace result format for: {image_path}")
                return None
                
        except Exception as e:
            logger.error(f"Error extracting face encoding from {image_path}: {str(e)}", exc_info=True)
            return None
    
    def compare_faces(self, encoding1: List[float], encoding2: List[float]) -> float:
        """
        Compare two face encodings and return similarity score
        
        Args:
            encoding1: First face encoding vector
            encoding2: Second face encoding vector
            
        Returns:
            Similarity score (0.0-1.0), where 1.0 is identical
        """
        try:
            # Convert to numpy arrays
            vec1 = np.array(encoding1)
            vec2 = np.array(encoding2)
            
            # Normalize vectors
            vec1 = vec1 / np.linalg.norm(vec1)
            vec2 = vec2 / np.linalg.norm(vec2)
            
            # Cosine similarity
            similarity = np.dot(vec1, vec2)
            
            # Ensure result is between 0 and 1
            similarity = max(0.0, min(1.0, similarity))
            
            return float(similarity)
            
        except Exception as e:
            logger.error(f"Error comparing face encodings: {str(e)}", exc_info=True)
            return 0.0
    
    async def find_matching_user(
        self,
        violation_snapshot_path: str,
        organization_id: int,
        db: AsyncSession,
        threshold: float = None
    ) -> Optional[Tuple[int, float]]:
        """
        Find the best matching user for a violation snapshot
        
        Args:
            violation_snapshot_path: Path to violation snapshot image
            organization_id: Organization ID to filter users
            db: Database session
            threshold: Minimum confidence threshold (default: from settings)
            
        Returns:
            Tuple of (user_id, confidence) if match found, None otherwise
        """
        threshold = threshold or self.threshold
        
        try:
            # Extract face encoding from violation snapshot
            snapshot_encoding = self.extract_face_encoding(violation_snapshot_path)
            if snapshot_encoding is None:
                logger.info(f"No face detected in violation snapshot: {violation_snapshot_path}")
                return None
            
            # Get all user photos for the organization
            user_photos = await crud.get_user_photos_by_organization(db, organization_id)
            if not user_photos:
                logger.info(f"No user photos found for organization {organization_id}")
                return None
            
            # Compare with all user photos
            best_match = None
            best_confidence = 0.0
            
            for photo in user_photos:
                if not photo.face_encoding:
                    continue  # Skip photos without encoding
                
                # Compare encodings
                confidence = self.compare_faces(snapshot_encoding, photo.face_encoding)
                
                if confidence > best_confidence:
                    best_confidence = confidence
                    best_match = photo.user_id
            
            # Return match if confidence exceeds threshold
            if best_match and best_confidence >= threshold:
                logger.info(f"Match found: user_id={best_match}, confidence={best_confidence:.3f}")
                return (best_match, best_confidence)
            elif best_match:
                logger.info(f"Match found but below threshold: user_id={best_match}, confidence={best_confidence:.3f} < {threshold}")
                return None
            else:
                logger.info(f"No match found for violation snapshot: {violation_snapshot_path}")
                return None
                
        except Exception as e:
            logger.error(f"Error finding matching user: {str(e)}", exc_info=True)
            return None

