"""Filter acceleration artifacts for frontend filtering."""

import base64

import numpy as np
import pandas as pd
from tqdm.auto import tqdm


def pack_bitset(bits: np.ndarray) -> bytes:
    """
    Pack boolean array into compact bitset bytes.

    Args:
        bits: Boolean numpy array

    Returns:
        Packed bytes (8 bits per byte)
    """
    n = len(bits)
    # Pad to multiple of 8
    padded_len = ((n + 7) // 8) * 8
    padded = np.zeros(padded_len, dtype=bool)
    padded[:n] = bits

    # Pack into bytes
    packed = np.packbits(padded)
    return packed.tobytes()


def encode_bitset_base64(bits: np.ndarray) -> str:
    """
    Encode bitset as base64 string for JSON storage.

    Args:
        bits: Boolean numpy array

    Returns:
        Base64-encoded string
    """
    packed = pack_bitset(bits)
    return base64.b64encode(packed).decode("ascii")


def compute_quantile_bins(
    values: np.ndarray,
    n_bins: int = 32,
) -> tuple[np.ndarray, list[float]]:
    """
    Compute quantile-based bin assignments.

    Args:
        values: Array of values to bin
        n_bins: Number of quantile bins (default 32)

    Returns:
        (bin_assignments, bin_edges) tuple
        - bin_assignments: Integer array of bin indices (0 to n_bins-1), or -1 for NaN
        - bin_edges: List of n_bins+1 edges defining the bins
    """
    # Handle NaN values separately
    nan_mask = np.isnan(values)
    valid_values = values[~nan_mask]

    if len(valid_values) == 0:
        # All values are NaN - mark with -1
        return np.full(len(values), -1, dtype=np.int8), [0.0] * (n_bins + 1)

    # Compute quantile edges
    quantiles = np.linspace(0, 1, n_bins + 1)
    edges = np.quantile(valid_values, quantiles)

    # Ensure edges are unique (for constant features)
    if np.all(edges == edges[0]):
        edges = np.linspace(edges[0] - 0.5, edges[0] + 0.5, n_bins + 1)

    # Assign bins using right=True to include max value in last bin
    bin_assignments = np.digitize(values, edges[1:-1], right=False)
    bin_assignments = np.clip(bin_assignments, 0, n_bins - 1)

    # Mark NaN values with special bin index -1
    bin_assignments = bin_assignments.astype(np.int8)
    bin_assignments[nan_mask] = -1

    return bin_assignments, edges.tolist()


def compute_feature_bitsets(
    slides_df: pd.DataFrame,
    features: list[str],
    n_bins: int = 32,
    show_progress: bool = True,
) -> dict:
    """
    Compute quantile-bin bitsets for continuous features.

    For each feature, creates n_bins bitsets where bitset[i] contains
    all slides with values in bin i.

    Args:
        slides_df: DataFrame with slide features
        features: List of feature column names
        n_bins: Number of quantile bins (default 32)
        show_progress: Whether to show progress bar

    Returns:
        Dictionary mapping feature name to bitset data
    """
    result = {}

    iterator = features
    if show_progress:
        iterator = tqdm(features, desc="Feature bitsets")

    for feature in iterator:
        values = slides_df[feature].values

        bin_assignments, edges = compute_quantile_bins(values, n_bins)

        # Create bitset for each bin
        bitsets = []
        for bin_idx in range(n_bins):
            in_bin = bin_assignments == bin_idx
            bitsets.append(encode_bitset_base64(in_bin))

        result[feature] = {
            "type": "quantile_bins",
            "n_bins": n_bins,
            "edges": edges,
            "bitsets": bitsets,
            "n_valid": int(np.sum(~np.isnan(values))),
        }

    return result


def compute_categorical_bitsets(
    slides_df: pd.DataFrame,
    categorical_cols: list[str],
    show_progress: bool = True,
) -> dict:
    """
    Compute membership bitsets for categorical variables.

    For each categorical variable, creates one bitset per unique value.

    Args:
        slides_df: DataFrame with categorical columns
        categorical_cols: List of categorical column names
        show_progress: Whether to show progress bar

    Returns:
        Dictionary mapping column name to bitset data
    """
    result = {}

    iterator = categorical_cols
    if show_progress:
        iterator = tqdm(categorical_cols, desc="Categorical bitsets")

    for col in iterator:
        if col not in slides_df.columns:
            continue

        values = slides_df[col]
        unique_values = values.dropna().unique()

        bitsets = {}
        for val in sorted(unique_values, key=str):
            mask = (values == val).values
            bitsets[str(val)] = encode_bitset_base64(mask)

        result[col] = {
            "type": "categorical",
            "values": [str(v) for v in sorted(unique_values, key=str)],
            "bitsets": bitsets,
            "n_valid": int(values.notna().sum()),
        }

    return result


def compute_range_lookup(
    slides_df: pd.DataFrame,
    features: list[str],
    n_bins: int = 32,
    show_progress: bool = True,
) -> dict:
    """
    Create a compact lookup structure for range filtering.

    Instead of storing individual bitsets, store sorted threshold indices
    for more efficient range queries.

    Args:
        slides_df: DataFrame with features
        features: List of feature column names
        n_bins: Number of threshold points
        show_progress: Whether to show progress bar

    Returns:
        Dictionary mapping feature name to lookup data
    """
    result = {}

    iterator = features
    if show_progress:
        iterator = tqdm(features, desc="Range lookup")

    for feature in iterator:
        values = slides_df[feature].values
        valid_mask = ~np.isnan(values)
        valid_values = values[valid_mask]

        if len(valid_values) == 0:
            continue

        # Sort indices by value
        valid_indices = np.where(valid_mask)[0]
        sorted_order = np.argsort(valid_values)
        sorted_indices = valid_indices[sorted_order]

        # Create n_bins threshold indices
        n_valid = len(sorted_indices)
        thresholds = []
        threshold_indices = []

        for i in range(n_bins + 1):
            pos = int(i * n_valid / n_bins)
            pos = min(pos, n_valid - 1)
            threshold_indices.append(int(sorted_indices[pos]))
            thresholds.append(float(valid_values[sorted_order[pos]]))

        result[feature] = {
            "type": "sorted_lookup",
            "n_valid": n_valid,
            "thresholds": thresholds,
            "threshold_indices": threshold_indices,
            "min": float(valid_values.min()),
            "max": float(valid_values.max()),
        }

    return result
