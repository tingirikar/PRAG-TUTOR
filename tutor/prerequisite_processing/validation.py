"""Graph validation: DAG cycle breaking via DFS and transitive redundancy reduction."""

from typing import Any, Dict, List, Optional, Set, Tuple


def break_cycles(graph: Dict[str, List[str]]) -> Dict[str, List[str]]:
    """Detects and breaks directed cycles in the prerequisite graph using DFS.

    If topic T requires P, there is a directed dependency T -> P.
    A cycle exists if there is a back-edge in the recursion stack.
    When a cycle is detected, the violating prerequisite edge is removed.
    """
    adj: Dict[str, List[str]] = {t: list(prereqs) for t, prereqs in graph.items()}

    def find_cycle() -> Optional[Tuple[str, str]]:
        visited: Dict[str, int] = {}  # 0=unvisited, 1=visiting (stack), 2=done

        def dfs(node: str, path: List[str]) -> Optional[Tuple[str, str]]:
            visited[node] = 1
            for neighbor in adj.get(node, []):
                if visited.get(neighbor, 0) == 1:
                    # Back-edge detected: cycle between node and neighbor
                    return (node, neighbor)
                if visited.get(neighbor, 0) == 0:
                    res = dfs(neighbor, path + [neighbor])
                    if res:
                        return res
            visited[node] = 2
            return None

        for node in list(adj.keys()):
            if visited.get(node, 0) == 0:
                cycle = dfs(node, [node])
                if cycle:
                    return cycle
        return None

    # Iteratively remove back-edges until graph is a DAG
    while True:
        cycle_edge = find_cycle()
        if not cycle_edge:
            break
        src, prereq = cycle_edge
        if prereq in adj[src]:
            adj[src].remove(prereq)

    return adj


def remove_transitive_redundancies(
    graph: Dict[str, List[str]]
) -> Dict[str, List[str]]:
    """Removes transitive redundant prerequisites:

    If T requires B, and B requires A, and T also directly lists A as a prerequisite,
    then A is redundant for T and can be removed.
    """
    reduced: Dict[str, List[str]] = {}

    for topic, prereqs in graph.items():
        if len(prereqs) <= 1:
            reduced[topic] = list(prereqs)
            continue

        # Find all indirect ancestors of all prereqs
        indirect_ancestors: Set[str] = set()
        for p in prereqs:
            to_visit = list(graph.get(p, []))
            visited = set()
            while to_visit:
                curr = to_visit.pop()
                if curr not in visited:
                    visited.add(curr)
                    indirect_ancestors.add(curr)
                    to_visit.extend(graph.get(curr, []))

        # Direct prereqs minus any that are already indirect ancestors
        essential_prereqs = [p for p in prereqs if p not in indirect_ancestors]
        reduced[topic] = essential_prereqs if essential_prereqs else list(prereqs[:1])

    return reduced


def validate_and_sanitize_graph(
    raw_graph: Dict[str, Any], known_topics: List[str]
) -> Dict[str, List[str]]:
    """Enforces:

    1. All topics in the graph belong to known_topics.
    2. All prerequisites belong to known_topics.
    3. No self-dependencies (topic != prereq).
    4. No duplicate prerequisites per topic.
    5. Prerequisite count capped at 4.
    6. Cycle detection & resolution (DAG enforcement via DFS).
    7. Transitive redundancy elimination.
    """
    topic_lookup: Dict[str, str] = {t.lower(): t for t in known_topics}
    sanitized: Dict[str, List[str]] = {}

    for t in known_topics:
        sanitized[t] = []

    for raw_topic, prereqs in raw_graph.items():
        topic_canonical = topic_lookup.get(str(raw_topic).strip().lower())
        if not topic_canonical:
            continue

        if not isinstance(prereqs, list):
            if isinstance(prereqs, (str, int)):
                prereqs = [prereqs]
            else:
                prereqs = []

        valid_prereqs = []
        for p in prereqs:
            p_canonical = topic_lookup.get(str(p).strip().lower())
            if (
                p_canonical
                and p_canonical != topic_canonical
                and p_canonical not in valid_prereqs
            ):
                valid_prereqs.append(p_canonical)

        # Cap at 4
        sanitized[topic_canonical] = valid_prereqs[:4]

    # Cycle detection & breaking
    sanitized = break_cycles(sanitized)

    # Transitive redundancy reduction
    sanitized = remove_transitive_redundancies(sanitized)

    return sanitized
