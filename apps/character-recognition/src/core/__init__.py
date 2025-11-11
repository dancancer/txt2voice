"""核心处理模块"""
from .preprocessor import TextPreprocessor
from .ner import NERRecognizer
from .alias import AliasRecognizer
from .coreference import CoreferenceResolver
from .dialogue import DialogueAttributor
from .relation import RelationExtractor

__all__ = [
    "TextPreprocessor",
    "NERRecognizer",
    "AliasRecognizer",
    "CoreferenceResolver",
    "DialogueAttributor",
    "RelationExtractor",
]
