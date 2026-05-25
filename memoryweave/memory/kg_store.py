import heapq

import networkx as nx

from memoryweave.memory.kg_backend import KGBackend


class KnowledgeGraphStore:
    """NetworkX DiGraph with weighted traversal, Hebbian updates, and pluggable async persistence."""

    def __init__(self, backend: KGBackend, user_id: str = ""):
        self._backend = backend
        self._user_id = user_id
        self._graph: nx.DiGraph = nx.DiGraph()
        self._call_count: int = 0

    # ── Persistence ───────────────────────────────────────────────────────────

    async def load(self) -> None:
        data = await self._backend.load(self._user_id)
        if data:
            self._graph = nx.node_link_graph(data, directed=True, multigraph=False)
        else:
            self._graph = nx.DiGraph()

    async def save(self) -> None:
        data = nx.node_link_data(self._graph)
        await self._backend.save(self._user_id, data)

    async def clear(self) -> None:
        self._graph = nx.DiGraph()
        await self._backend.save(self._user_id, nx.node_link_data(self._graph))

    # ── Write ops ────────────────────────────────────────────────────────────

    def upsert_node(self, name: str, type_: str, description: str) -> None:
        if self._graph.has_node(name):
            self._graph.nodes[name]["description"] = description
        else:
            self._graph.add_node(name, type=type_, description=description)

    def upsert_edge(self, source: str, target: str, rel_type: str, weight: float = 1.0) -> None:
        if not self._graph.has_edge(source, target):
            self._graph.add_edge(source, target, rel_type=rel_type, weight=weight)

    # ── Read ops ─────────────────────────────────────────────────────────────

    def traverse(
        self,
        seed_names: list[str],
        max_hops: int = 2,
        node_budget: int = 10,
    ) -> list[tuple[str, dict]]:
        """Priority-queue BFS from seed nodes, weighted by edge weight. Reinforces traversed edges."""
        seed_names = [n for n in seed_names if self._graph.has_node(n)]
        if not seed_names:
            return []

        heap: list[tuple[float, int, int, str, str]] = []
        visited: set[str] = set(seed_names)
        results: list[tuple[str, dict]] = []
        traversed_edges: list[tuple[str, str]] = []
        _ctr = 0

        for seed in seed_names:
            for _, nbr, data in self._graph.out_edges(seed, data=True):
                heapq.heappush(heap, (-data["weight"], _ctr, 0, seed, nbr))
                _ctr += 1

        while heap and len(results) < node_budget:
            neg_w, _, depth, parent, node = heapq.heappop(heap)
            if node in visited:
                continue
            visited.add(node)
            results.append((node, dict(self._graph.nodes[node])))
            traversed_edges.append((parent, node))

            if depth + 1 < max_hops:
                for _, nbr, data in self._graph.out_edges(node, data=True):
                    if nbr not in visited:
                        heapq.heappush(heap, (-data["weight"], _ctr, depth + 1, node, nbr))
                        _ctr += 1

        self._reinforce(traversed_edges)
        return results

    def format_context(self, nodes: list[tuple[str, dict]]) -> str:
        if not nodes:
            return ""
        lines = []
        for name, attrs in nodes:
            t = attrs.get("type", "")
            d = attrs.get("description", "")
            lines.append(f"[{name}] ({t}) — {d}")
            for src, _, data in self._graph.in_edges(name, data=True):
                lines.append(f"  ← {data['rel_type']} ← [{src}] (weight: {data['weight']:.2f})")
            for _, nbr, data in self._graph.out_edges(name, data=True):
                lines.append(f"  → {data['rel_type']} → [{nbr}] (weight: {data['weight']:.2f})")
        return "\n".join(lines)

    # ── Maintenance ───────────────────────────────────────────────────────────

    def _reinforce(self, edges: list[tuple[str, str]]) -> None:
        from memoryweave.core.config import settings
        for src, tgt in edges:
            if self._graph.has_edge(src, tgt):
                self._graph[src][tgt]["weight"] *= settings.kg_reinforcement_factor

    def decay_all(self) -> None:
        from memoryweave.core.config import settings
        for _, _, data in self._graph.edges(data=True):
            data["weight"] *= settings.kg_decay_factor

    def prune(self) -> None:
        from memoryweave.core.config import settings
        weak = [
            (u, v) for u, v, d in self._graph.edges(data=True)
            if d["weight"] < settings.kg_min_edge_weight
        ]
        self._graph.remove_edges_from(weak)
        orphans = [n for n in list(self._graph.nodes) if self._graph.degree(n) == 0]
        self._graph.remove_nodes_from(orphans)

    def _maybe_maintain(self) -> None:
        from memoryweave.core.config import settings
        self._call_count += 1
        if self._call_count % settings.kg_decay_interval == 0:
            self.decay_all()
            self.prune()

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def node_count(self) -> int:
        return self._graph.number_of_nodes()

    @property
    def edge_count(self) -> int:
        return self._graph.number_of_edges()
