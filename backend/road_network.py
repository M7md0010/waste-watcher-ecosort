import os
import osmnx as ox
import networkx as nx

GRAPH_DIR = os.path.join(os.path.dirname(__file__), 'graph_cache')
GRAPH_FILE = os.path.join(GRAPH_DIR, 'hosary.graphml')

HOSARY_CENTER = (29.9726, 30.9443)
GRAPH_RADIUS = 2000

_graph = None

def load_graph():
    global _graph
    if _graph is not None:
        return _graph

    os.makedirs(GRAPH_DIR, exist_ok=True)

    if os.path.exists(GRAPH_FILE):
        _graph = ox.load_graphml(GRAPH_FILE)
        _graph = _graph.to_undirected()
        return _graph

    _graph = ox.graph_from_point(
        HOSARY_CENTER,
        dist=GRAPH_RADIUS,
        network_type='drive',
        simplify=True,
    )
    ox.save_graphml(_graph, GRAPH_FILE)
    _graph = _graph.to_undirected()
    return _graph


def snap_to_nearest_node(G, lat, lon):
    import math
    best_node = None
    best_dist = float('inf')
    for node, data in G.nodes(data=True):
        ny, nx_ = float(data['y']), float(data['x'])
        d = math.sqrt((ny - lat)**2 + (nx_ - lon)**2)
        if d < best_dist:
            best_dist = d
            best_node = node
    return best_node


def shortest_path_distance(G, node1, node2):
    try:
        return nx.shortest_path_length(G, node1, node2, weight='length')
    except nx.NetworkXNoPath:
        return float('inf')


def shortest_path_coords(G, node1, node2):
    try:
        path_nodes = nx.shortest_path(G, node1, node2, weight='length')
    except nx.NetworkXNoPath:
        return []

    coords = []
    for i in range(len(path_nodes) - 1):
        u, v = path_nodes[i], path_nodes[i + 1]
        data = None
        try:
            edge_data = G[u][v]
            if isinstance(edge_data, dict):
                if 0 in edge_data:
                    data = edge_data[0]
                else:
                    first_key = next(iter(edge_data))
                    if isinstance(edge_data[first_key], dict):
                        data = edge_data[first_key]
                    else:
                        data = edge_data
        except (KeyError, StopIteration):
            pass

        if data and 'geometry' in data:
            line_coords = list(data['geometry'].coords)
            for lng, lat in line_coords:
                coords.append([lat, lng])
        else:
            coords.append([float(G.nodes[u]['y']), float(G.nodes[u]['x'])])
            coords.append([float(G.nodes[v]['y']), float(G.nodes[v]['x'])])

    deduped = [coords[0]] if coords else []
    for c in coords[1:]:
        if c != deduped[-1]:
            deduped.append(c)
    return deduped


def get_graph_sample_nodes(G, count=20):
    nodes = list(G.nodes(data=True))
    step = max(1, len(nodes) // count)
    return [(d['y'], d['x']) for _, d in nodes[::step][:count]]
