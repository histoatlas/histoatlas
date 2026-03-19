"""Parallel execution utilities for molecular analysis functions."""

import hashlib


def get_task_seed(base_seed: int | None, *keys: str) -> int | None:
    """
    Generate a deterministic seed from a base seed and task identifiers.

    This function creates unique but reproducible seeds for parallel tasks,
    ensuring that different tasks use different random sequences while
    maintaining full reproducibility when the same base_seed and keys are used.

    Args:
        base_seed: The base random seed. If None, returns None (non-deterministic).
        *keys: String identifiers for the task (e.g., cancer type, feature names).

    Returns:
        A deterministic integer seed derived from the base seed and keys,
        or None if base_seed is None.

    Example:
        >>> get_task_seed(42, "BRCA", "feature_A", "gene_X")
        1234567890  # deterministic value
        >>> get_task_seed(42, "LUAD", "feature_A", "gene_X")
        9876543210  # different value for different cancer type
        >>> get_task_seed(None, "BRCA", "feature_A", "gene_X")
        None  # non-deterministic when base_seed is None
    """
    if base_seed is None:
        return None

    # Create a unique string from base_seed and all keys
    seed_str = f"{base_seed}:" + ":".join(str(k) for k in keys)

    # Use MD5 hash for cross-platform consistency
    # MD5 is sufficient here (not for cryptography, just for deterministic hashing)
    hash_bytes = hashlib.md5(seed_str.encode("utf-8")).digest()

    # Convert first 4 bytes to integer (sufficient for numpy seed)
    # Use unsigned 32-bit integer to match numpy's seed range
    task_seed = int.from_bytes(hash_bytes[:4], byteorder="big") % (2**31)

    return task_seed
