"""
Download Ultralytics pretrained PPE model from HuggingFace Hub
and copy it under data/models for backend consumption.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from huggingface_hub import hf_hub_download


def main() -> None:
    repo_id = "ultralyticsplus/yolov8n-ppe"
    filename = "yolov8n-ppe.pt"
    target = Path("data/models/ultralytics_yolov8n_ppe.pt")

    print(f"Downloading {filename} from {repo_id} ...")
    downloaded_path = hf_hub_download(repo_id=repo_id, filename=filename)

    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(downloaded_path, target)
    print(f"Model copied to {target.resolve()}")


if __name__ == "__main__":
    main()

