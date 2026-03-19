"""ID mapping between published CPTAC studies and GDC CPTAC studies.

Published CPTAC studies on cBioPortal use different patient IDs than their
GDC counterparts:
  - BRCA: published uses X-prefixed IDs (e.g., X01BR001 → 01BR001 in GDC)
  - LUAD: published has 4 X-prefixed IDs alongside C3L-* IDs
  - UCEC/LUSC/PAAD: IDs match directly (C3L-* format)
  - HNSCC: GDC-only study, no mapping needed (identity)
"""

import pandas as pd


def normalize_published_id(case_id: str) -> str:
    """Strip leading 'X' prefix from published CPTAC patient IDs.

    Some CPTAC published studies (BRCA, a few LUAD) use an X-prefixed format
    (e.g., X01BR001) while GDC uses the un-prefixed form (01BR001).
    Only strips when the character after X is a digit, so IDs that naturally
    start with X followed by a letter (unlikely but possible) are left intact.

    Handles NaN/non-string values gracefully (returns them unchanged) so this
    function is safe to use with ``pandas.Series.map()``.
    """
    if not isinstance(case_id, str):
        return case_id
    if case_id.startswith("X") and len(case_id) > 1 and case_id[1:2].isdigit():
        return case_id[1:]
    return case_id


def build_mapping_table(
    published_df: pd.DataFrame,
    gdc_df: pd.DataFrame,
) -> pd.DataFrame:
    """Match published case_ids to GDC patientIds per cancer_type.

    Args:
        published_df: Clinical data from published studies. Must have
            ``case_id`` and ``cancer_type`` columns.
        gdc_df: Clinical data from GDC studies. Must have ``case_id``
            and ``cancer_type`` columns.

    Returns:
        DataFrame with columns: case_id, gdc_patient_id, cancer_type,
        match_method (``direct``, ``x_prefix``, or ``unmatched``).
    """
    rows: list[dict[str, str]] = []

    for cancer_type in published_df["cancer_type"].unique():
        pub_ids = set(published_df.loc[published_df["cancer_type"] == cancer_type, "case_id"])
        gdc_ids = set(gdc_df.loc[gdc_df["cancer_type"] == cancer_type, "case_id"])

        for pid in sorted(pub_ids):
            if pid in gdc_ids:
                rows.append(
                    {
                        "case_id": pid,
                        "gdc_patient_id": pid,
                        "cancer_type": cancer_type,
                        "match_method": "direct",
                    }
                )
            else:
                normalized = normalize_published_id(pid)
                if normalized != pid and normalized in gdc_ids:
                    rows.append(
                        {
                            "case_id": pid,
                            "gdc_patient_id": normalized,
                            "cancer_type": cancer_type,
                            "match_method": "x_prefix",
                        }
                    )
                else:
                    rows.append(
                        {
                            "case_id": pid,
                            "gdc_patient_id": "",
                            "cancer_type": cancer_type,
                            "match_method": "unmatched",
                        }
                    )

    return pd.DataFrame(rows)
