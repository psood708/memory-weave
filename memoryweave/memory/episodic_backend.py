from __future__ import annotations


class ChromaEpisodicBackend:
    def __init__(self, collection_name: str, persist_dir: str = ".chroma"):
        import chromadb
        from chromadb.config import Settings as ChromaSettings

        from memoryweave.core.config import settings as _s

        if _s.chroma_host:
            client = chromadb.HttpClient(host=_s.chroma_host, port=_s.chroma_port)
        else:
            client = chromadb.PersistentClient(
                path=persist_dir,
                settings=ChromaSettings(anonymized_telemetry=False),
            )
        self._col = client.get_or_create_collection(
            name=collection_name,
            metadata={"hnsw:space": "cosine"},
        )

    def upsert(self, ids: list[str], documents: list[str], metadatas: list[dict]) -> None:
        self._col.upsert(ids=ids, documents=documents, metadatas=metadatas)

    def query(self, query_text: str, n_results: int, where: dict | None = None) -> list[tuple[str, str, dict]]:
        if self._col.count() == 0:
            return []
        kwargs: dict = {
            "query_texts": [query_text],
            "n_results": min(n_results, self._col.count()),
            "include": ["documents", "metadatas"],
        }
        if where:
            kwargs["where"] = where
        results = self._col.query(**kwargs)
        return list(zip(results["ids"][0], results["documents"][0], results["metadatas"][0]))

    def get_all(self) -> list[tuple[str, str, dict]]:
        items = self._col.get(include=["documents", "metadatas"])
        return list(zip(items["ids"], items["documents"], items["metadatas"]))

    def get_by_ids(self, ids: list[str]) -> list[tuple[str, str, dict]]:
        results = self._col.get(ids=ids, include=["documents", "metadatas"])
        return list(zip(results["ids"], results["documents"], results["metadatas"]))

    def delete(self, ids: list[str]) -> None:
        if ids:
            self._col.delete(ids=ids)

    def count(self) -> int:
        return self._col.count()

    def update_entity_links(self, episode_id: str, entity_ids: list[str]) -> None:
        results = self._col.get(ids=[episode_id], include=["documents", "metadatas"])
        if not results["ids"]:
            return
        meta = results["metadatas"][0]
        meta["entity_ids"] = ",".join(entity_ids)
        self._col.upsert(
            ids=[episode_id],
            documents=results["documents"],
            metadatas=[meta],
        )


class QdrantEpisodicBackend:
    _COLLECTION = "episodes"
    _FASTEMBED_MODEL = "BAAI/bge-small-en-v1.5"
    _VECTOR_NAME = "fast-bge-small-en"
    _VECTOR_SIZE = 384

    def __init__(self, session_id: str, client=None):
        from memoryweave.core.config import settings as _s

        if client is not None:
            self._client = client
            self._is_server = False
        elif _s.qdrant_url:
            from qdrant_client import QdrantClient
            self._client = QdrantClient(url=_s.qdrant_url, api_key=_s.qdrant_api_key or None)
            self._is_server = True
        else:
            from qdrant_client import QdrantClient
            self._client = QdrantClient(path=".qdrant")
            self._is_server = False
        self._session_id = session_id
        self._ensure_collection()
        if self._is_server:
            self._ensure_payload_index()

    def _ensure_collection(self) -> None:
        from qdrant_client.models import Distance, VectorParams
        try:
            self._client.get_collection(self._COLLECTION)
            return
        except Exception:
            pass
        try:
            self._client.create_collection(
                collection_name=self._COLLECTION,
                vectors_config={self._VECTOR_NAME: VectorParams(size=self._VECTOR_SIZE, distance=Distance.COSINE)},
            )
        except Exception:
            pass  # already created by a concurrent caller

    def _ensure_payload_index(self) -> None:
        from qdrant_client.models import PayloadSchemaType
        for field_name, schema in [
            ("session_id", PayloadSchemaType.KEYWORD),
            ("is_active", PayloadSchemaType.INTEGER),
        ]:
            try:
                self._client.create_payload_index(
                    collection_name=self._COLLECTION,
                    field_name=field_name,
                    field_schema=schema,
                )
            except Exception:
                pass

    def _filter(self):
        from qdrant_client.models import FieldCondition, Filter, MatchValue
        return Filter(must=[FieldCondition(key="session_id", match=MatchValue(value=self._session_id))])

    def upsert(self, ids: list[str], documents: list[str], metadatas: list[dict]) -> None:
        from qdrant_client.models import Document, PointStruct
        self._client.upsert(
            collection_name=self._COLLECTION,
            points=[
                PointStruct(
                    id=point_id,
                    vector={self._VECTOR_NAME: Document(text=doc, model=self._FASTEMBED_MODEL)},
                    payload={**meta, "document": doc},
                )
                for point_id, doc, meta in zip(ids, documents, metadatas)
            ],
        )

    def query(self, query_text: str, n_results: int, where: dict | None = None) -> list[tuple[str, str, dict]]:
        from qdrant_client.models import Document, FieldCondition, Filter, MatchValue
        conditions = [FieldCondition(key="session_id", match=MatchValue(value=self._session_id))]
        if where and "is_active" in where:
            conditions.append(FieldCondition(key="is_active", match=MatchValue(value=int(where["is_active"]))))
        try:
            response = self._client.query_points(
                collection_name=self._COLLECTION,
                query=Document(text=query_text, model=self._FASTEMBED_MODEL),
                using=self._VECTOR_NAME,
                query_filter=Filter(must=conditions),
                limit=n_results,
            )
            results = response.points
        except Exception:
            return []
        out = []
        for r in results:
            payload = r.payload or {}
            doc = payload.get("document", "")
            meta = {k: v for k, v in payload.items() if k != "document"}
            out.append((str(r.id), doc, meta))
        return out

    def get_all(self) -> list[tuple[str, str, dict]]:
        try:
            records, _ = self._client.scroll(
                collection_name=self._COLLECTION,
                scroll_filter=self._filter(),
                limit=10000,
                with_payload=True,
                with_vectors=False,
            )
        except Exception:
            return []
        out = []
        for r in records:
            payload = r.payload or {}
            doc = payload.get("document", "")
            meta = {k: v for k, v in payload.items() if k != "document"}
            out.append((str(r.id), doc, meta))
        return out

    def get_by_ids(self, ids: list[str]) -> list[tuple[str, str, dict]]:
        try:
            records = self._client.retrieve(
                collection_name=self._COLLECTION,
                ids=ids,
                with_payload=True,
                with_vectors=False,
            )
        except Exception:
            return []
        out = []
        for r in records:
            payload = r.payload or {}
            doc = payload.get("document", "")
            meta = {k: v for k, v in payload.items() if k != "document"}
            out.append((str(r.id), doc, meta))
        return out

    def delete(self, ids: list[str]) -> None:
        if not ids:
            return
        from qdrant_client.models import PointIdsList
        try:
            self._client.delete(
                collection_name=self._COLLECTION,
                points_selector=PointIdsList(points=ids),
            )
        except Exception:
            pass

    def count(self) -> int:
        try:
            return self._client.count(
                collection_name=self._COLLECTION,
                count_filter=self._filter(),
            ).count
        except Exception:
            return 0

    def update_entity_links(self, episode_id: str, entity_ids: list[str]) -> None:
        from qdrant_client.models import PointIdsList
        try:
            self._client.set_payload(
                collection_name=self._COLLECTION,
                payload={"entity_ids": ",".join(entity_ids)},
                points=PointIdsList(points=[episode_id]),
            )
        except Exception:
            pass
