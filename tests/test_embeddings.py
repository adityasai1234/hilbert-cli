"""Tests for embeddings and similarity."""

import pytest

from hilbert.sources.embeddings import cosine_similarity


class TestCosineSimilarity:
    def test_identical_vectors(self):
        a = [1.0, 0.0, 0.0]
        b = [1.0, 0.0, 0.0]
        sim = cosine_similarity(a, b)
        assert sim == 1.0

    def test_orthogonal_vectors(self):
        a = [1.0, 0.0, 0.0]
        b = [0.0, 1.0, 0.0]
        sim = cosine_similarity(a, b)
        assert sim == 0.0

    def test_opposite_vectors(self):
        a = [1.0, 0.0, 0.0]
        b = [-1.0, 0.0, 0.0]
        sim = cosine_similarity(a, b)
        assert sim == -1.0

    def test_empty_vectors(self):
        assert cosine_similarity([], []) == 0.0
        assert cosine_similarity([1.0], []) == 0.0
        assert cosine_similarity([], [1.0]) == 0.0

    def test_realistic_similarity(self):
        a = [0.9, 0.1, 0.2, 0.3]
        b = [0.8, 0.15, 0.25, 0.35]
        sim = cosine_similarity(a, b)
        assert 0.9 < sim < 1.0