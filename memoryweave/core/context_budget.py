from dataclasses import dataclass


@dataclass
class ContextBlock:
    working_memory: str
    episodes: str
    kg_context: str  # empty until Week 2


def build_context_block(
    working: str,
    episodes: str,
    kg: str,
    token_budget: int,
) -> ContextBlock:
    """Trim context sections to fit within budget using character-based approximation (1 token ≈ 4 chars)."""
    char_budget = token_budget * 4
    used = 0
    final_working, final_episodes, final_kg = "", "", ""

    # Working memory gets priority — always include if it fits
    if working and used + len(working) <= char_budget:
        final_working = working
        used += len(working)

    # KG context next (richer signal)
    if kg and used + len(kg) <= char_budget:
        final_kg = kg
        used += len(kg)

    # Episodes fill remaining budget
    if episodes:
        remaining = char_budget - used
        final_episodes = episodes[:remaining] if len(episodes) > remaining else episodes

    return ContextBlock(working_memory=final_working, episodes=final_episodes, kg_context=final_kg)


def format_context_block(block: ContextBlock) -> str:
    parts = []
    if block.working_memory:
        parts.append(f"[WORKING MEMORY]\n{block.working_memory}")
    if block.episodes:
        parts.append(f"[RELEVANT EPISODES]\n{block.episodes}")
    if block.kg_context:
        parts.append(f"[KNOWLEDGE GRAPH CONTEXT]\n{block.kg_context}")
    return "\n\n".join(parts)
