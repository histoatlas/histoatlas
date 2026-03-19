"""Result dataclasses for frontend module."""

from dataclasses import dataclass


@dataclass
class SimilarSlide:
    """A single similar slide entry."""

    slide_id: str
    neighbor_rank: int
    neighbor_slide_id: str
    distance: float
    same_cancer_type: bool
