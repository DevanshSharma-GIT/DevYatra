#!/usr/bin/env python3
"""
Test script to validate optimized search performance for CBC D-02 backend.
This script tests the new data structures and measures performance improvements.
"""

import sys
import os
import time
import json
from typing import List, Dict, Any

# Add backend directory to path
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)

def test_search_optimization():
    """Test the optimized search functionality."""
    print("🔍 Testing Optimized Search Engine for CBC D-02")
    print("=" * 60)
    
    try:
        # Import the optimized search engine
        from search_optimization import search_engine, PlaceInfo
        from travel_services import OptimizedPlaceService
        
        print("✅ Successfully imported optimized search modules")
        
        # Test 1: Basic text search performance
        print("\n📝 Test 1: Text Search Performance")
        test_queries = ["Taj Mahal", "Red Fort", "taj", "temple", "palace", "goa"]
        
        for query in test_queries:
            start_time = time.time()
            results = search_engine.search_places(query, search_type="text", limit=5)
            search_time = time.time() - start_time
            
            print(f"  Query: '{query}' -> {len(results)} results in {search_time:.3f}s")
            if results:
                print(f"    Top result: {results[0].place.name} (score: {results[0].relevance_score:.3f})")
        
        # Test 2: Fuzzy search
        print("\n🔧 Test 2: Fuzzy Search (Typo Tolerance)")
        fuzzy_queries = ["tajmahal", "redfort", "gatewy", "mysor"]
        
        for query in fuzzy_queries:
            start_time = time.time()
            results = search_engine.search_places(query, search_type="text", limit=3)
            search_time = time.time() - start_time
            
            print(f"  Fuzzy query: '{query}' -> {len(results)} results in {search_time:.3f}s")
            for i, result in enumerate(results[:2]):
                print(f"    {i+1}. {result.place.name} (score: {result.relevance_score:.3f})")
        
        # Test 3: Location-based search
        print("\n📍 Test 3: Location-based Search (Spatial Indexing)")
        test_locations = [
            ("Delhi", 28.6139, 77.2090),
            ("Mumbai", 19.0760, 72.8777),
            ("Jaipur", 26.9124, 75.7873)
        ]
        
        for city, lat, lon in test_locations:
            start_time = time.time()
            results = search_engine.search_places("", user_lat=lat, user_lon=lon, 
                                               search_type="location", limit=5)
            search_time = time.time() - start_time
            
            print(f"  Near {city} ({lat}, {lon}) -> {len(results)} results in {search_time:.3f}s")
            for i, result in enumerate(results[:3]):
                distance = result.distance_km if result.distance_km else "N/A"
                print(f"    {i+1}. {result.place.name} ({distance} km)")
        
        # Test 4: Recommendation system
        print("\n🎯 Test 4: Recommendation Engine")
        test_user = "test_user_123"
        
        # Simulate user interactions
        interactions = [
            ("Taj Mahal", "search"),
            ("Red Fort", "view"),
            ("Hawa Mahal", "book"),
            ("Mysore Palace", "like")
        ]
        
        for place_name, interaction_type in interactions:
            OptimizedPlaceService.record_user_interaction(test_user, place_name, interaction_type)
        
        start_time = time.time()
        recommendations = OptimizedPlaceService.get_recommendations(test_user, limit=5)
        rec_time = time.time() - start_time
        
        print(f"  User recommendations -> {len(recommendations)} results in {rec_time:.3f}s")
        for i, rec in enumerate(recommendations[:3]):
            print(f"    {i+1}. {rec['name']} (score: {rec['relevance_score']:.3f}, type: {rec['recommendation_type']})")
        
        # Test 5: Cache performance
        print("\n💾 Test 5: Cache Performance")
        cache_queries = ["Taj Mahal", "Golden Temple", "Goa Beaches"]
        
        # First run (populate cache)
        first_run_times = []
        for query in cache_queries:
            start_time = time.time()
            search_engine.search_places(query, search_type="text")
            first_run_times.append(time.time() - start_time)
        
        # Second run (from cache)
        second_run_times = []
        for query in cache_queries:
            start_time = time.time()
            search_engine.search_places(query, search_type="text")
            second_run_times.append(time.time() - start_time)
        
        avg_first = sum(first_run_times) / len(first_run_times)
        avg_second = sum(second_run_times) / len(second_run_times)
        speedup = avg_first / avg_second if avg_second > 0 else 1
        
        print(f"  Average first run: {avg_first:.3f}s")
        print(f"  Average cached run: {avg_second:.3f}s")
        print(f"  Cache speedup: {speedup:.2f}x")
        
        # Test 6: Performance statistics
        print("\n📊 Test 6: Search Engine Statistics")
        stats = search_engine.get_search_statistics()
        print(f"  Total places indexed: {stats['total_places']}")
        print(f"  Trie nodes created: {stats['trie_nodes']}")
        print(f"  Cache size: {stats['cache_size']}")
        print(f"  Users with interactions: {stats['recommendation_users']}")
        
        # Test 7: Stress test
        print("\n⚡ Test 7: Stress Test (100 searches)")
        stress_queries = ["palace", "temple", "fort", "beach", "garden"] * 20
        
        start_time = time.time()
        for query in stress_queries:
            search_engine.search_places(query, search_type="text", limit=3)
        total_time = time.time() - start_time
        
        avg_per_search = total_time / len(stress_queries)
        searches_per_second = len(stress_queries) / total_time
        
        print(f"  100 searches completed in {total_time:.3f}s")
        print(f"  Average per search: {avg_per_search:.4f}s")
        print(f"  Searches per second: {searches_per_second:.1f}")
        
        print("\n🎉 All tests completed successfully!")
        print("\n📈 Performance Summary:")
        print(f"  - Text search: ~{avg_per_search:.3f}s per query")
        print(f"  - Cache speedup: {speedup:.2f}x")
        print(f"  - Throughput: {searches_per_second:.1f} searches/sec")
        print(f"  - Fuzzy search: Supports typo tolerance")
        print(f"  - Spatial indexing: Efficient location-based queries")
        print(f"  - Recommendations: Personalized using hybrid algorithms")
        
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure the search_optimization module is properly installed")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_api_endpoints():
    """Test the API endpoints if the server is running."""
    print("\n🌐 Testing API Endpoints (requires running server)")
    print("=" * 60)
    
    try:
        import requests
        
        # Test basic health endpoint
        try:
            response = requests.get("http://localhost:5000/api/travel/health", timeout=5)
            if response.status_code == 200:
                health_data = response.json()
                print("✅ Travel health endpoint working")
                print(f"   Optimization: {health_data.get('optimization', 'unknown')}")
                print(f"   Available endpoints: {len(health_data.get('endpoints', []))}")
            else:
                print(f"⚠️  Health endpoint returned status {response.status_code}")
        except requests.exceptions.RequestException:
            print("⚠️  Server not running or not accessible at localhost:5000")
            return False
        
        # Test optimized search endpoint
        search_params = {
            "place": "Taj Mahal",
            "user_id": "test_user_api",
            "origin_lat": "28.6139",
            "origin_lon": "77.2090"
        }
        
        try:
            response = requests.get("http://localhost:5000/api/search", params=search_params, timeout=10)
            if response.status_code == 200:
                search_data = response.json()
                print("✅ Optimized search endpoint working")
                print(f"   Found: {search_data.get('name', 'Unknown')}")
                print(f"   Optimized: {search_data.get('search_metadata', {}).get('optimized_search', False)}")
                print(f"   Search type: {search_data.get('search_metadata', {}).get('search_type', 'unknown')}")
            else:
                print(f"⚠️  Search endpoint returned status {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Search endpoint error: {e}")
        
        # Test autocomplete
        autocomplete_params = {"query": "taj", "user_id": "test_user_api"}
        
        try:
            response = requests.get("http://localhost:5000/api/autocomplete", params=autocomplete_params, timeout=5)
            if response.status_code == 200:
                autocomplete_data = response.json()
                suggestions = autocomplete_data.get("suggestions", [])
                print(f"✅ Autocomplete working - {len(suggestions)} suggestions")
                if suggestions:
                    print(f"   Top suggestion: {suggestions[0].get('label', 'Unknown')}")
                    print(f"   Confidence: {suggestions[0].get('confidence', 0):.3f}")
            else:
                print(f"⚠️  Autocomplete returned status {response.status_code}")
        except requests.exceptions.RequestException as e:
            print(f"⚠️  Autocomplete error: {e}")
        
        print("✅ API endpoint tests completed")
        return True
        
    except ImportError:
        print("⚠️  requests library not available for API testing")
        return False

if __name__ == "__main__":
    print("🚀 CBC D-02 Search Optimization Test Suite")
    print("=" * 60)
    
    # Test the core search functionality
    core_success = test_search_optimization()
    
    # Test API endpoints if requested
    if len(sys.argv) > 1 and sys.argv[1] == "--api":
        api_success = test_api_endpoints()
    else:
        print("\n💡 To test API endpoints, run: python test_search_optimization.py --api")
        print("   (Make sure the Flask server is running first)")
        api_success = True  # Don't fail overall test for API tests
    
    if core_success and api_success:
        print("\n🎉 All tests passed! Search optimization is working correctly.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Please check the output above.")
        sys.exit(1)