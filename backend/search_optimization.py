"""
Advanced search optimization module for CBC D-02 backend.
Implements efficient data structures for fast search recommendations in ticket booking.

Features:
- Trie data structure for O(k) text search complexity
- Spatial indexing for location-based searches  
- Recommendation engine with multiple algorithms
- Intelligent caching with LRU and predictive pre-loading
- Fuzzy matching and typo tolerance
"""

import heapq
import math
import time
import logging
from collections import defaultdict, OrderedDict
from typing import Dict, List, Optional, Tuple, Set, Any
from dataclasses import dataclass
from datetime import datetime, timedelta
from difflib import SequenceMatcher
import threading
import json

logger = logging.getLogger(__name__)

@dataclass
class PlaceInfo:
    """Data class for place information with search optimization."""
    name: str
    latitude: float
    longitude: float
    category: str
    rating: float = 0.0
    popularity_score: float = 0.0
    search_count: int = 0
    last_searched: Optional[datetime] = None
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
        if self.last_searched is None:
            self.last_searched = datetime.now()
    
    def __hash__(self):
        """Make PlaceInfo hashable for use in sets and dictionaries."""
        return hash((self.name, self.latitude, self.longitude))
    
    def __eq__(self, other):
        """Equality comparison for PlaceInfo objects."""
        if not isinstance(other, PlaceInfo):
            return False
        return (self.name == other.name and 
                abs(self.latitude - other.latitude) < 1e-6 and
                abs(self.longitude - other.longitude) < 1e-6)

@dataclass
class SearchResult:
    """Search result with relevance scoring."""
    place: PlaceInfo
    relevance_score: float
    distance_km: Optional[float] = None
    search_type: str = "text"  # text, location, recommendation
    
    def __lt__(self, other):
        return self.relevance_score > other.relevance_score  # Higher score first

class TrieNode:
    """Node for Trie data structure optimized for place name search."""
    
    def __init__(self):
        self.children: Dict[str, 'TrieNode'] = {}
        self.is_end_word: bool = False
        self.places: List[PlaceInfo] = []
        self.frequency: int = 0

class PlaceNameTrie:
    """
    Trie data structure for fast text search with O(k) complexity.
    Supports prefix matching, auto-complete, and fuzzy search.
    """
    
    def __init__(self):
        self.root = TrieNode()
        self.total_places = 0
        
    def insert(self, place: PlaceInfo) -> None:
        """Insert a place into the trie."""
        # Insert main name
        self._insert_word(place.name.lower(), place)
        
        # Insert individual words for better matching
        words = place.name.lower().split()
        for word in words:
            if len(word) > 2:  # Skip very short words
                self._insert_word(word, place)
                
        self.total_places += 1
        
    def _insert_word(self, word: str, place: PlaceInfo) -> None:
        """Insert a word into the trie."""
        node = self.root
        for char in word:
            if char not in node.children:
                node.children[char] = TrieNode()
            node = node.children[char]
            node.frequency += 1
            
        node.is_end_word = True
        node.places.append(place)
        
    def search_prefix(self, prefix: str, limit: int = 10) -> List[PlaceInfo]:
        """Search for places with given prefix."""
        if not prefix:
            return []
            
        node = self.root
        for char in prefix.lower():
            if char not in node.children:
                return []
            node = node.children[char]
            
        # Collect all places under this prefix
        places = []
        place_names_seen = set()  # Use names to track duplicates instead of objects
        self._collect_places(node, places, place_names_seen)
        
        # Sort by relevance (frequency, then popularity)
        sorted_places = sorted(
            places, 
            key=lambda p: (p.search_count, p.popularity_score, p.rating),
            reverse=True
        )
        
        return sorted_places[:limit]
        
    def _collect_places(self, node: TrieNode, places: List[PlaceInfo], place_names_seen: Set[str]) -> None:
        """Recursively collect all places under a node."""
        if node.is_end_word:
            for place in node.places:
                if place.name not in place_names_seen:
                    places.append(place)
                    place_names_seen.add(place.name)
            
        for child in node.children.values():
            self._collect_places(child, places, place_names_seen)
            
    def fuzzy_search(self, query: str, max_distance: int = 2, limit: int = 10) -> List[Tuple[PlaceInfo, float]]:
        """
        Fuzzy search with edit distance tolerance.
        Returns list of (place, similarity_score) tuples.
        """
        query = query.lower()
        results = []
        
        # First try exact prefix matches
        exact_matches = self.search_prefix(query, limit)
        for place in exact_matches:
            similarity = self._calculate_similarity(query, place.name.lower())
            results.append((place, similarity))
            
        # If we need more results, try fuzzy matching
        if len(results) < limit:
            fuzzy_results = self._fuzzy_search_recursive(
                self.root, query, "", max_distance, limit - len(results)
            )
            results.extend(fuzzy_results)
            
        # Sort by similarity and remove duplicates
        seen_places = set()
        unique_results = []
        for place, similarity in sorted(results, key=lambda x: x[1], reverse=True):
            if place.name not in seen_places:
                seen_places.add(place.name)
                unique_results.append((place, similarity))
                
        return unique_results[:limit]
        
    def _fuzzy_search_recursive(self, node: TrieNode, query: str, current_word: str, 
                              max_distance: int, limit: int) -> List[Tuple[PlaceInfo, float]]:
        """Recursive fuzzy search implementation."""
        results = []
        
        if len(results) >= limit:
            return results
            
        if node.is_end_word and len(current_word) >= len(query) - max_distance:
            distance = self._edit_distance(query, current_word)
            if distance <= max_distance:
                similarity = 1.0 - (distance / max(len(query), len(current_word)))
                for place in node.places:
                    results.append((place, similarity))
                    
        # Continue searching children
        for char, child_node in node.children.items():
            if len(results) < limit:
                child_results = self._fuzzy_search_recursive(
                    child_node, query, current_word + char, max_distance, limit - len(results)
                )
                results.extend(child_results)
                
        return results
        
    def _edit_distance(self, s1: str, s2: str) -> int:
        """Calculate edit distance between two strings."""
        if len(s1) > len(s2):
            s1, s2 = s2, s1
            
        distances = range(len(s1) + 1)
        for i2, c2 in enumerate(s2):
            new_distances = [i2 + 1]
            for i1, c1 in enumerate(s1):
                if c1 == c2:
                    new_distances.append(distances[i1])
                else:
                    new_distances.append(1 + min(distances[i1], distances[i1 + 1], new_distances[-1]))
            distances = new_distances
            
        return distances[-1]
        
    def _calculate_similarity(self, query: str, name: str) -> float:
        """Calculate similarity score between query and place name."""
        return SequenceMatcher(None, query, name).ratio()

class SpatialIndex:
    """
    KD-Tree implementation for efficient spatial queries.
    Optimized for 2D coordinates (latitude, longitude).
    """
    
    def __init__(self):
        self.root = None
        self.places = []
        
    class Node:
        def __init__(self, place: PlaceInfo, axis: int = 0):
            self.place = place
            self.axis = axis  # 0 for latitude, 1 for longitude
            self.left = None
            self.right = None
            
    def build_index(self, places: List[PlaceInfo]) -> None:
        """Build the spatial index from a list of places."""
        self.places = places.copy()
        self.root = self._build_tree(places, 0)
        
    def _build_tree(self, places: List[PlaceInfo], depth: int) -> Optional['SpatialIndex.Node']:
        """Recursively build KD-tree."""
        if not places:
            return None
            
        axis = depth % 2  # Alternate between latitude (0) and longitude (1)
        
        # Sort places by current axis
        if axis == 0:
            places.sort(key=lambda p: p.latitude)
        else:
            places.sort(key=lambda p: p.longitude)
            
        # Choose median as root
        median_idx = len(places) // 2
        node = self.Node(places[median_idx], axis)
        
        # Recursively build left and right subtrees
        node.left = self._build_tree(places[:median_idx], depth + 1)
        node.right = self._build_tree(places[median_idx + 1:], depth + 1)
        
        return node
        
    def search_radius(self, lat: float, lon: float, radius_km: float, limit: int = 20) -> List[SearchResult]:
        """Find all places within radius of given coordinates."""
        results = []
        if self.root:
            self._search_radius_recursive(
                self.root, lat, lon, radius_km, results
            )
            
        # Sort by distance and apply limit
        results.sort(key=lambda r: r.distance_km or float('inf'))
        return results[:limit]
        
    def _search_radius_recursive(self, node: 'SpatialIndex.Node', lat: float, lon: float, 
                               radius_km: float, results: List[SearchResult]) -> None:
        """Recursively search for places within radius."""
        if not node:
            return
            
        # Calculate distance to current node
        distance = self._haversine_distance(lat, lon, node.place.latitude, node.place.longitude)
        
        if distance <= radius_km:
            # Calculate relevance score based on distance and popularity
            relevance_score = (1.0 - distance / radius_km) * 0.7 + node.place.popularity_score * 0.3
            results.append(SearchResult(
                place=node.place,
                relevance_score=relevance_score,
                distance_km=distance,
                search_type="location"
            ))
            
        # Determine which subtrees to search
        axis = node.axis
        query_coord = lat if axis == 0 else lon
        node_coord = node.place.latitude if axis == 0 else node.place.longitude
        
        # Calculate perpendicular distance to splitting line
        perp_distance = abs(query_coord - node_coord)
        
        # Convert coordinate difference to kilometers (approximate)
        perp_distance_km = perp_distance * 111.0  # Rough conversion
        
        # Search the closer subtree first
        if query_coord < node_coord:
            self._search_radius_recursive(node.left, lat, lon, radius_km, results)
            if perp_distance_km <= radius_km:
                self._search_radius_recursive(node.right, lat, lon, radius_km, results)
        else:
            self._search_radius_recursive(node.right, lat, lon, radius_km, results)
            if perp_distance_km <= radius_km:
                self._search_radius_recursive(node.left, lat, lon, radius_km, results)
                
    def find_nearest(self, lat: float, lon: float, k: int = 5) -> List[SearchResult]:
        """Find k nearest places to given coordinates."""
        if not self.root:
            return []
            
        # Use a max heap to keep track of k closest points
        heap = []
        self._find_nearest_recursive(self.root, lat, lon, k, heap)
        
        # Convert heap to sorted list
        results = []
        while heap:
            neg_distance, place = heapq.heappop(heap)
            distance = -neg_distance
            relevance_score = 1.0 / (1.0 + distance)  # Closer = higher score
            results.append(SearchResult(
                place=place,
                relevance_score=relevance_score,
                distance_km=distance,
                search_type="location"
            ))
            
        return list(reversed(results))  # Closest first
        
    def _find_nearest_recursive(self, node: 'SpatialIndex.Node', lat: float, lon: float,
                              k: int, heap: List[Tuple[float, PlaceInfo]]) -> None:
        """Recursively find k nearest neighbors."""
        if not node:
            return
            
        distance = self._haversine_distance(lat, lon, node.place.latitude, node.place.longitude)
        
        # Add to heap if we have space or this is closer than farthest
        if len(heap) < k:
            heapq.heappush(heap, (-distance, node.place))  # Negative for max heap
        elif distance < -heap[0][0]:
            heapq.heapreplace(heap, (-distance, node.place))
            
        # Determine which subtree to search first
        axis = node.axis
        query_coord = lat if axis == 0 else lon
        node_coord = node.place.latitude if axis == 0 else node.place.longitude
        
        # Search the closer subtree first
        if query_coord < node_coord:
            self._find_nearest_recursive(node.left, lat, lon, k, heap)
            # Check if we need to search the other subtree
            if len(heap) < k or abs(query_coord - node_coord) * 111.0 < -heap[0][0]:
                self._find_nearest_recursive(node.right, lat, lon, k, heap)
        else:
            self._find_nearest_recursive(node.right, lat, lon, k, heap)
            if len(heap) < k or abs(query_coord - node_coord) * 111.0 < -heap[0][0]:
                self._find_nearest_recursive(node.left, lat, lon, k, heap)
                
    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate haversine distance between two points in kilometers."""
        R = 6371  # Earth's radius in kilometers
        
        lat1_rad = math.radians(lat1)
        lon1_rad = math.radians(lon1)
        lat2_rad = math.radians(lat2)
        lon2_rad = math.radians(lon2)
        
        dlat = lat2_rad - lat1_rad
        dlon = lon2_rad - lon1_rad
        
        a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c

class LRUCache:
    """
    Least Recently Used cache with intelligent pre-loading capabilities.
    """
    
    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.cache = OrderedDict()
        self.access_count = defaultdict(int)
        self.last_access = {}
        
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache and update access statistics."""
        if key in self.cache:
            # Move to end (most recently used)
            value = self.cache.pop(key)
            self.cache[key] = value
            self.access_count[key] += 1
            self.last_access[key] = datetime.now()
            return value
        return None
        
    def put(self, key: str, value: Any) -> None:
        """Put value in cache with LRU eviction."""
        if key in self.cache:
            # Update existing
            self.cache.pop(key)
        elif len(self.cache) >= self.max_size:
            # Evict least recently used
            oldest_key, _ = self.cache.popitem(last=False)
            self.access_count.pop(oldest_key, None)
            self.last_access.pop(oldest_key, None)
            
        self.cache[key] = value
        self.access_count[key] = self.access_count.get(key, 0) + 1
        self.last_access[key] = datetime.now()
        
    def get_popular_keys(self, limit: int = 10) -> List[str]:
        """Get most frequently accessed keys for pre-loading."""
        return sorted(
            self.access_count.items(),
            key=lambda x: x[1],
            reverse=True
        )[:limit]

class RecommendationEngine:
    """
    Multi-algorithm recommendation engine for travel places.
    Supports content-based, collaborative filtering, and hybrid approaches.
    """
    
    def __init__(self):
        self.user_preferences = defaultdict(dict)
        self.place_features = {}
        self.user_interactions = defaultdict(list)
        self.similarity_cache = LRUCache(max_size=5000)
        
    def add_user_interaction(self, user_id: str, place: PlaceInfo, 
                           interaction_type: str = "search", rating: float = 1.0) -> None:
        """Record user interaction with a place."""
        interaction = {
            "place_name": place.name,
            "interaction_type": interaction_type,
            "rating": rating,
            "timestamp": datetime.now(),
            "place": place
        }
        self.user_interactions[user_id].append(interaction)
        
        # Update user preferences
        if place.category not in self.user_preferences[user_id]:
            self.user_preferences[user_id][place.category] = 0
        self.user_preferences[user_id][place.category] += rating
        
    def content_based_recommendations(self, user_id: str, places: List[PlaceInfo], 
                                    limit: int = 10) -> List[SearchResult]:
        """Generate content-based recommendations."""
        if user_id not in self.user_preferences:
            # New user - return popular places
            return self._popular_recommendations(places, limit)
            
        user_prefs = self.user_preferences[user_id]
        recommendations = []
        
        for place in places:
            # Skip places user has already interacted with
            if self._user_has_interacted(user_id, place.name):
                continue
                
            # Calculate content similarity score
            category_score = user_prefs.get(place.category, 0)
            popularity_score = place.popularity_score
            rating_score = place.rating / 5.0  # Normalize to 0-1
            
            # Weighted combination
            relevance_score = (category_score * 0.5 + popularity_score * 0.3 + rating_score * 0.2)
            
            recommendations.append(SearchResult(
                place=place,
                relevance_score=relevance_score,
                search_type="recommendation"
            ))
            
        # Sort by relevance and return top results
        recommendations.sort(reverse=True)
        return recommendations[:limit]
        
    def collaborative_filtering_recommendations(self, user_id: str, places: List[PlaceInfo],
                                              limit: int = 10) -> List[SearchResult]:
        """Generate collaborative filtering recommendations."""
        if user_id not in self.user_interactions or len(self.user_interactions) < 2:
            return self._popular_recommendations(places, limit)
            
        # Find similar users
        similar_users = self._find_similar_users(user_id, top_k=10)
        
        # Collect recommendations from similar users
        place_scores = defaultdict(float)
        place_objects = {p.name: p for p in places}
        
        for similar_user, similarity in similar_users:
            for interaction in self.user_interactions[similar_user]:
                place_name = interaction["place_name"]
                if (place_name in place_objects and 
                    not self._user_has_interacted(user_id, place_name)):
                    place_scores[place_name] += similarity * interaction["rating"]
                    
        # Convert to SearchResults
        recommendations = []
        for place_name, score in place_scores.items():
            if place_name in place_objects:
                recommendations.append(SearchResult(
                    place=place_objects[place_name],
                    relevance_score=score,
                    search_type="recommendation"
                ))
                
        # Sort and return top results
        recommendations.sort(reverse=True)
        return recommendations[:limit]
        
    def hybrid_recommendations(self, user_id: str, places: List[PlaceInfo],
                             limit: int = 10) -> List[SearchResult]:
        """Generate hybrid recommendations combining multiple approaches."""
        content_recs = self.content_based_recommendations(user_id, places, limit * 2)
        collab_recs = self.collaborative_filtering_recommendations(user_id, places, limit * 2)
        
        # Combine and weight the recommendations
        combined_scores = defaultdict(float)
        all_places = {}
        
        # Weight content-based recommendations (60%)
        for result in content_recs:
            combined_scores[result.place.name] += result.relevance_score * 0.6
            all_places[result.place.name] = result.place
            
        # Weight collaborative filtering recommendations (40%)
        for result in collab_recs:
            combined_scores[result.place.name] += result.relevance_score * 0.4
            all_places[result.place.name] = result.place
            
        # Create final recommendations
        final_recs = []
        for place_name, score in combined_scores.items():
            final_recs.append(SearchResult(
                place=all_places[place_name],
                relevance_score=score,
                search_type="recommendation"
            ))
            
        # Sort and return top results
        final_recs.sort(reverse=True)
        return final_recs[:limit]
        
    def _find_similar_users(self, user_id: str, top_k: int = 5) -> List[Tuple[str, float]]:
        """Find users similar to given user based on interaction patterns."""
        cache_key = f"similar_users_{user_id}_{top_k}"
        cached_result = self.similarity_cache.get(cache_key)
        if cached_result:
            return cached_result
            
        target_interactions = self.user_interactions[user_id]
        target_places = {i["place_name"] for i in target_interactions}
        
        similarities = []
        
        for other_user_id, other_interactions in self.user_interactions.items():
            if other_user_id == user_id:
                continue
                
            other_places = {i["place_name"] for i in other_interactions}
            
            # Calculate Jaccard similarity
            intersection = len(target_places & other_places)
            union = len(target_places | other_places)
            
            if union > 0:
                similarity = intersection / union
                similarities.append((other_user_id, similarity))
                
        # Sort by similarity and cache result
        similarities.sort(key=lambda x: x[1], reverse=True)
        result = similarities[:top_k]
        self.similarity_cache.put(cache_key, result)
        
        return result
        
    def _user_has_interacted(self, user_id: str, place_name: str) -> bool:
        """Check if user has previously interacted with a place."""
        if user_id not in self.user_interactions:
            return False
        return any(i["place_name"] == place_name for i in self.user_interactions[user_id])
        
    def _popular_recommendations(self, places: List[PlaceInfo], limit: int) -> List[SearchResult]:
        """Fallback to popularity-based recommendations."""
        popular_places = sorted(
            places,
            key=lambda p: (p.popularity_score, p.rating, p.search_count),
            reverse=True
        )
        
        return [
            SearchResult(
                place=place,
                relevance_score=place.popularity_score,
                search_type="recommendation"
            )
            for place in popular_places[:limit]
        ]

class OptimizedSearchEngine:
    """
    Main search engine that coordinates all optimization components.
    """
    
    def __init__(self):
        self.trie_index = PlaceNameTrie()
        self.spatial_index = SpatialIndex()
        self.recommendation_engine = RecommendationEngine()
        self.search_cache = LRUCache(max_size=2000)
        self.places_data: List[PlaceInfo] = []
        self._lock = threading.RLock()
        
    def initialize_data(self, places_data: List[Dict[str, Any]]) -> None:
        """Initialize search engine with places data."""
        with self._lock:
            logger.info(f"Initializing search engine with {len(places_data)} places")
            
            # Convert to PlaceInfo objects
            self.places_data = []
            for place_dict in places_data:
                place = PlaceInfo(
                    name=place_dict.get('name', ''),
                    latitude=float(place_dict.get('latitude', 0)),
                    longitude=float(place_dict.get('longitude', 0)),
                    category=place_dict.get('category', 'unknown'),
                    rating=float(place_dict.get('rating', 0)),
                    popularity_score=float(place_dict.get('popularity_score', 0)),
                    search_count=int(place_dict.get('search_count', 0)),
                    metadata=place_dict.get('metadata', {})
                )
                self.places_data.append(place)
                
            # Build indexes
            logger.info("Building text search index...")
            for place in self.places_data:
                self.trie_index.insert(place)
                
            logger.info("Building spatial index...")
            self.spatial_index.build_index(self.places_data)
            
            logger.info("Search engine initialization complete")
            
    def search_places(self, query: str, user_id: str = None, user_lat: float = None, 
                     user_lon: float = None, search_type: str = "auto", 
                     limit: int = 10) -> List[SearchResult]:
        """
        Unified search interface with automatic type detection.
        
        Args:
            query: Search query string
            user_id: User ID for personalized recommendations
            user_lat: User latitude for location-based search
            user_lon: User longitude for location-based search
            search_type: "auto", "text", "location", "recommendation"
            limit: Maximum number of results
            
        Returns:
            List of SearchResult objects sorted by relevance
        """
        cache_key = f"{search_type}_{query}_{user_id}_{user_lat}_{user_lon}_{limit}"
        
        # Check cache first
        cached_result = self.search_cache.get(cache_key)
        if cached_result:
            return cached_result
            
        start_time = time.time()
        results = []
        
        try:
            if search_type == "auto":
                # Auto-detect search type
                if user_lat and user_lon and not query.strip():
                    search_type = "location"
                elif not query.strip() and user_id:
                    search_type = "recommendation"
                else:
                    search_type = "text"
                    
            if search_type == "text":
                results = self._text_search(query, limit)
            elif search_type == "location":
                results = self._location_search(user_lat, user_lon, query, limit)
            elif search_type == "recommendation":
                results = self._recommendation_search(user_id, limit)
            else:
                # Hybrid search combining multiple approaches
                results = self._hybrid_search(query, user_id, user_lat, user_lon, limit)
                
            # Record user interaction for recommendation learning
            if user_id and results:
                for result in results[:3]:  # Top 3 results
                    self.recommendation_engine.add_user_interaction(
                        user_id, result.place, "search", 0.5
                    )
                    
            # Cache results
            self.search_cache.put(cache_key, results)
            
            search_time = time.time() - start_time
            logger.info(f"Search completed in {search_time:.3f}s, returned {len(results)} results")
            
            return results
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []
            
    def _text_search(self, query: str, limit: int) -> List[SearchResult]:
        """Perform optimized text search."""
        if not query.strip():
            return []
            
        # Try exact prefix match first
        exact_matches = self.trie_index.search_prefix(query, limit)
        
        if len(exact_matches) >= limit:
            return [
                SearchResult(place=place, relevance_score=1.0, search_type="text")
                for place in exact_matches
            ]
            
        # Add fuzzy matches if needed
        fuzzy_matches = self.trie_index.fuzzy_search(query, max_distance=2, limit=limit)
        
        results = []
        seen_places = set()
        
        # Add exact matches first
        for place in exact_matches:
            if place.name not in seen_places:
                results.append(SearchResult(place=place, relevance_score=1.0, search_type="text"))
                seen_places.add(place.name)
                
        # Add fuzzy matches
        for place, similarity in fuzzy_matches:
            if place.name not in seen_places and len(results) < limit:
                results.append(SearchResult(place=place, relevance_score=similarity, search_type="text"))
                seen_places.add(place.name)
                
        return results[:limit]
        
    def _location_search(self, lat: float, lon: float, query: str = "", limit: int = 20) -> List[SearchResult]:
        """Perform location-based search."""
        if not lat or not lon:
            return []
            
        # If query is provided, combine with spatial search
        if query.strip():
            text_results = self._text_search(query, limit * 2)
            # Filter by proximity
            results = []
            for result in text_results:
                distance = self.spatial_index._haversine_distance(
                    lat, lon, result.place.latitude, result.place.longitude
                )
                result.distance_km = distance
                # Boost score for nearby places
                proximity_boost = max(0, 1.0 - distance / 50.0)  # 50km max range
                result.relevance_score = result.relevance_score * 0.7 + proximity_boost * 0.3
                results.append(result)
                
            results.sort(reverse=True)
            return results[:limit]
        else:
            # Pure location search - find nearby places
            return self.spatial_index.search_radius(lat, lon, 25.0, limit)  # 25km radius
            
    def _recommendation_search(self, user_id: str, limit: int) -> List[SearchResult]:
        """Perform personalized recommendation search."""
        if not user_id:
            # Return popular places
            popular = sorted(
                self.places_data,
                key=lambda p: (p.popularity_score, p.rating),
                reverse=True
            )
            return [
                SearchResult(place=place, relevance_score=place.popularity_score, search_type="recommendation")
                for place in popular[:limit]
            ]
            
        return self.recommendation_engine.hybrid_recommendations(user_id, self.places_data, limit)
        
    def _hybrid_search(self, query: str, user_id: str, user_lat: float, 
                      user_lon: float, limit: int) -> List[SearchResult]:
        """Perform hybrid search combining multiple approaches."""
        all_results = []
        
        # Text search (weight: 40%)
        if query.strip():
            text_results = self._text_search(query, limit)
            for result in text_results:
                result.relevance_score *= 0.4
                all_results.append(result)
                
        # Location search (weight: 30%)
        if user_lat and user_lon:
            location_results = self._location_search(user_lat, user_lon, "", limit)
            for result in location_results:
                result.relevance_score *= 0.3
                all_results.append(result)
                
        # Recommendation search (weight: 30%)
        if user_id:
            rec_results = self._recommendation_search(user_id, limit)
            for result in rec_results:
                result.relevance_score *= 0.3
                all_results.append(result)
                
        # Combine scores for duplicate places
        place_scores = defaultdict(float)
        place_objects = {}
        
        for result in all_results:
            place_scores[result.place.name] += result.relevance_score
            place_objects[result.place.name] = result.place
            
        # Create final results
        final_results = []
        for place_name, score in place_scores.items():
            final_results.append(SearchResult(
                place=place_objects[place_name],
                relevance_score=score,
                search_type="hybrid"
            ))
            
        # Sort by relevance
        final_results.sort(reverse=True)
        return final_results[:limit]
        
    def update_place_popularity(self, place_name: str, interaction_type: str = "view") -> None:
        """Update place popularity based on user interactions."""
        with self._lock:
            for place in self.places_data:
                if place.name == place_name:
                    place.search_count += 1
                    place.last_searched = datetime.now()
                    
                    # Update popularity score
                    if interaction_type == "book":
                        place.popularity_score += 0.1
                    elif interaction_type == "view":
                        place.popularity_score += 0.05
                    elif interaction_type == "search":
                        place.popularity_score += 0.02
                        
                    break
                    
    def get_search_statistics(self) -> Dict[str, Any]:
        """Get search engine performance statistics."""
        return {
            "total_places": len(self.places_data),
            "trie_nodes": self._count_trie_nodes(),
            "cache_size": len(self.search_cache.cache),
            "cache_hit_rate": self._calculate_cache_hit_rate(),
            "popular_searches": self.search_cache.get_popular_keys(10),
            "recommendation_users": len(self.recommendation_engine.user_interactions)
        }
        
    def _count_trie_nodes(self) -> int:
        """Count total nodes in trie structure."""
        def count_nodes(node):
            if not node:
                return 0
            count = 1
            for child in node.children.values():
                count += count_nodes(child)
            return count
            
        return count_nodes(self.trie_index.root)
        
    def _calculate_cache_hit_rate(self) -> float:
        """Calculate cache hit rate."""
        total_accesses = sum(self.search_cache.access_count.values())
        if total_accesses == 0:
            return 0.0
        return len(self.search_cache.cache) / total_accesses

# Global search engine instance
search_engine = OptimizedSearchEngine()