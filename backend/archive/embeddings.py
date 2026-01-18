"""
Embeddings module for semantic search over Quran ayahs.

Uses sentence-transformers with all-MiniLM-L6-v2 model for generating
text embeddings. Embeddings are stored as binary blobs in SQLite.
"""

import numpy as np
from functools import lru_cache
from typing import List, Optional
import sqlite3
import struct

# Model is loaded lazily to avoid startup delay
_model = None


def get_model():
    """Lazy-load the sentence transformer model."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model


def generate_embedding(text: str) -> np.ndarray:
    """Generate embedding vector for a single text."""
    model = get_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.astype(np.float32)


def generate_embeddings_batch(texts: List[str], batch_size: int = 32) -> np.ndarray:
    """Generate embeddings for multiple texts efficiently."""
    model = get_model()
    embeddings = model.encode(texts, batch_size=batch_size, convert_to_numpy=True)
    return embeddings.astype(np.float32)


def embedding_to_bytes(embedding: np.ndarray) -> bytes:
    """Serialize numpy array to bytes for SQLite BLOB storage."""
    return embedding.tobytes()


def bytes_to_embedding(data: bytes) -> np.ndarray:
    """Deserialize bytes from SQLite BLOB to numpy array."""
    return np.frombuffer(data, dtype=np.float32)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Calculate cosine similarity between two vectors."""
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def search_similar(
    query_embedding: np.ndarray,
    conn: sqlite3.Connection,
    language: Optional[str] = None,
    surah_id: Optional[int] = None,
    limit: int = 50
) -> List[dict]:
    """
    Find ayahs most similar to the query embedding.
    
    Returns list of dicts with ayah info and similarity score.
    """
    cursor = conn.cursor()
    
    # Build query with filters
    where_clauses = []
    params = []
    
    if language:
        where_clauses.append("e.language = ?")
        params.append(language)
    
    if surah_id:
        where_clauses.append("em.surah_id = ?")
        params.append(surah_id)
    
    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)
    
    # Get all matching embeddings
    sql = f"""
        SELECT 
            em.ayah_id,
            em.surah_id,
            em.ayah_number,
            em.language,
            em.embedding,
            a.text,
            a.number_in_surah,
            s.name as surah_name,
            s.english_name as surah_english_name,
            s.english_name_translation,
            e.identifier as edition
        FROM ayah_embeddings em
        JOIN ayahs a ON em.ayah_id = a.id
        JOIN surahs s ON em.surah_id = s.id
        JOIN editions e ON a.edition_id = e.id
        {where_sql}
    """
    
    cursor.execute(sql, params)
    rows = cursor.fetchall()
    
    # Calculate similarities
    results = []
    for row in rows:
        embedding = bytes_to_embedding(row[4])  # embedding column
        similarity = cosine_similarity(query_embedding, embedding)
        results.append({
            "ayah_id": row[0],
            "surah_id": row[1],
            "ayah_number": row[2],
            "language": row[3],
            "text": row[5],
            "number_in_surah": row[6],
            "surah_name": row[7],
            "surah_english_name": row[8],
            "surah_english_name_translation": row[9],
            "edition": row[10],
            "similarity": similarity
        })
    
    # Sort by similarity descending and limit
    results.sort(key=lambda x: x["similarity"], reverse=True)
    return results[:limit]
