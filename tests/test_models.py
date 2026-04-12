"""Tests for hilbert models."""

import pytest
from datetime import date

from hilbert.models.paper import Paper, Author
from hilbert.models.finding import Finding
from hilbert.models.report import Report


class TestAuthor:
    def test_author_creation(self):
        author = Author(name="John Doe")
        assert author.name == "John Doe"

    def test_author_with_affiliation(self):
        author = Author(name="Jane Smith", affiliation="MIT")
        assert author.affiliation == "MIT"


class TestPaper:
    def test_paper_creation(self):
        paper = Paper(
            paper_id="test-1",
            title="Test Paper",
            abstract="Test abstract",
            authors=[Author(name="John Doe")],
            url="https://example.com/paper",
        )
        assert paper.title == "Test Paper"
        assert len(paper.authors) == 1

    def test_citation_key_doi(self):
        paper = Paper(
            paper_id="test-1",
            title="Test",
            abstract="",
            authors=[],
            url="https://example.com",
            doi="10.1234/example",
        )
        key = paper.citation_key()
        assert "10" in key

    def test_citation_key_arxiv(self):
        paper = Paper(
            paper_id="test-1",
            title="Test",
            abstract="",
            authors=[],
            url="https://example.com",
            arxiv_id="2301.12345",
        )
        key = paper.citation_key()
        assert "arxiv" in key

    def test_bibtex_generation(self):
        paper = Paper(
            paper_id="test-1",
            title="Test Paper",
            abstract="",
            authors=[Author(name="John Doe"), Author(name="Jane Smith")],
            url="https://example.com",
            published_date=date(2023, 5, 15),
        )
        bib = paper.to_bibtex()
        assert "@article" in bib
        assert "Test Paper" in bib


class TestFinding:
    def test_finding_creation(self):
        finding = Finding(
            finding_id="f1",
            claim="Test claim",
            source_paper_id="p1",
            evidence_text="Evidence text",
        )
        assert finding.claim == "Test claim"
        assert finding.confidence == 0.0

    def test_confidence_label_high(self):
        finding = Finding(
            finding_id="f1",
            claim="Test",
            source_paper_id="p1",
            evidence_text="",
            confidence=0.95,
        )
        assert finding.confidence_label() == "high"

    def test_confidence_label_medium(self):
        finding = Finding(
            finding_id="f1",
            claim="Test",
            source_paper_id="p1",
            evidence_text="",
            confidence=0.8,
        )
        assert finding.confidence_label() == "medium"

    def test_confidence_label_low(self):
        finding = Finding(
            finding_id="f1",
            claim="Test",
            source_paper_id="p1",
            evidence_text="",
            confidence=0.5,
        )
        assert finding.confidence_label() == "low"


class TestReport:
    def test_report_creation(self):
        report = Report(
            report_id="r1",
            title="Test Report",
            query="Test query",
        )
        assert report.title == "Test Report"
        assert report.status == "draft"

    def test_to_markdown(self):
        report = Report(
            report_id="r1",
            title="Test Report",
            query="Test query",
            executive_summary="Summary text",
        )
        md = report.to_markdown()
        assert "# Test Report" in md
        assert "Summary text" in md

    def test_to_json(self):
        report = Report(
            report_id="r1",
            title="Test Report",
            query="Test query",
        )
        json_data = report.to_json()
        assert json_data["report_id"] == "r1"
        assert isinstance(json_data, dict)