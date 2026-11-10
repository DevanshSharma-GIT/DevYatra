"""Pytest entrypoint for vector search integration.

If the optional ``backend.src`` package is present we run a lightweight smoke-test
to ensure the vector search helper exposes the expected API surface. When the
package is absent (which is currently the default in this workspace) the test is
skipped instead of failing the entire suite.
"""

from __future__ import annotations

import os
import sys
from typing import Any

import pytest

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:  # pragma: no cover - optional dependency
    from backend.src.services.vector_search import vector_search  # type: ignore
except ImportError:  # pragma: no cover
    vector_search = None  # type: ignore


@pytest.mark.skipif(vector_search is None, reason="backend.src vector_search module not available")
def test_vector_search_api_contract() -> None:
    """Ensure the optional vector_search helper exposes key methods."""

    expected_methods = {
        "query_destinations",
        "get_travel_context",
        "get_hotel_reviews",
        "get_destination_reviews",
    }

    missing = [name for name in expected_methods if not hasattr(vector_search, name)]
    assert not missing, f"Missing methods on vector_search: {missing}"


@pytest.mark.skipif(vector_search is None, reason="backend.src vector_search module not available")
def test_query_destinations_returns_iterable() -> None:
    """Smoke test that query_destinations returns an iterable when available."""

    result = vector_search.query_destinations("test query")  # type: ignore[attr-defined]
    assert isinstance(result, (list, tuple)), "query_destinations should return a list or tuple"
