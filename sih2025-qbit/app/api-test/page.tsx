"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { APIService, type Recommendation, type SearchPerformanceStats } from '@/services/apiService';

export default function APITestPage() {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [performanceStats, setPerformanceStats] = useState<SearchPerformanceStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [userId, setUserId] = useState('test_user');
  const [loading, setLoading] = useState(false);
  const [apiHealth, setApiHealth] = useState<any>(null);

  // Check API health on load
  useEffect(() => {
    checkAPIHealth();
    loadPerformanceStats();
  }, []);

  const checkAPIHealth = async () => {
    try {
      const health = await APIService.healthCheck();
      setApiHealth(health);
    } catch (error) {
      console.error('Health check failed:', error);
      setApiHealth({ status: 'error', message: 'Backend not accessible' });
    }
  };

  const loadPerformanceStats = async () => {
    try {
      const stats = await APIService.getSearchPerformance();
      setPerformanceStats(stats);
    } catch (error) {
      console.error('Failed to load performance stats:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const result = await APIService.searchPlaces(searchQuery, { user_id: userId });
      setSearchResults(result.results || []);
      
      // Record the search interaction
      await APIService.recordUserInteraction({
        user_id: userId,
        place_name: searchQuery,
        interaction_type: 'search'
      });
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const result = await APIService.getRecommendations(userId);
      setRecommendations(result.recommendations || []);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInteraction = async (placeName: string, type: 'view' | 'like') => {
    try {
      await APIService.recordUserInteraction({
        user_id: userId,
        place_name: placeName,
        interaction_type: type
      });
      // Refresh performance stats
      loadPerformanceStats();
    } catch (error) {
      console.error('Failed to record interaction:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">CBC D-02 API Test Dashboard</h1>
        <p className="text-gray-600">Testing the new optimized search and recommendation endpoints</p>
      </div>

      {/* API Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            API Health Status
            <Badge variant={apiHealth?.status === 'healthy' ? 'default' : 'destructive'}>
              {apiHealth?.status || 'checking...'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-sm bg-gray-100 p-3 rounded overflow-auto">
            {JSON.stringify(apiHealth, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle>🔍 Optimized Search</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search for places..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Input
              placeholder="User ID"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-32"
            />
            <Button onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold">Search Results:</h4>
              {searchResults.map((result, index) => (
                <div key={index} className="p-3 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{result.place?.name}</div>
                    <div className="text-sm text-gray-600">
                      Category: {result.place?.category} | 
                      Rating: {result.place?.rating} | 
                      Relevance: {result.relevance_score?.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" 
                            onClick={() => handleInteraction(result.place?.name, 'view')}>
                      👁️ View
                    </Button>
                    <Button size="sm" variant="outline"
                            onClick={() => handleInteraction(result.place?.name, 'like')}>
                      ❤️ Like
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            🎯 Personalized Recommendations
            <Button onClick={loadRecommendations} disabled={loading}>
              Load Recommendations
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec, index) => (
                <div key={index} className="p-3 border rounded">
                  <div className="font-medium">{rec.name}</div>
                  <div className="text-sm text-gray-600">
                    {rec.category} | Rating: {rec.rating} | Score: {rec.relevance_score?.toFixed(2)}
                  </div>
                  <Badge variant="secondary" className="mt-2">
                    {rec.recommendation_type}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No recommendations loaded. Click the button above to load.</p>
          )}
        </CardContent>
      </Card>

      {/* Performance Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            📊 Search Engine Performance
            <Button onClick={loadPerformanceStats} variant="outline" size="sm">
              Refresh Stats
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {performanceStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {performanceStats.performance_stats.total_places}
                </div>
                <div className="text-sm text-blue-800">Total Places</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {(performanceStats.performance_stats.cache_hit_rate * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-green-800">Cache Hit Rate</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded">
                <div className="text-2xl font-bold text-purple-600">
                  {performanceStats.performance_stats.recommendation_users}
                </div>
                <div className="text-sm text-purple-800">Active Users</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {performanceStats.performance_stats.trie_nodes}
                </div>
                <div className="text-sm text-orange-800">Index Nodes</div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500">Loading performance statistics...</div>
          )}
        </CardContent>
      </Card>

      {/* API Endpoints Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>📚 Available API Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div><code className="bg-gray-100 px-2 py-1 rounded">GET /api/health</code> - Health check</div>
            <div><code className="bg-gray-100 px-2 py-1 rounded">GET /api/search</code> - Optimized place search</div>
            <div><code className="bg-gray-100 px-2 py-1 rounded">GET /api/recommendations</code> - Personalized recommendations</div>
            <div><code className="bg-gray-100 px-2 py-1 rounded">GET /api/search_performance</code> - Performance statistics</div>
            <div><code className="bg-gray-100 px-2 py-1 rounded">POST /api/user_interaction</code> - Record user interactions</div>
            <div><code className="bg-gray-100 px-2 py-1 rounded">GET /api/autocomplete</code> - Autocomplete suggestions</div>
            <div><code className="bg-gray-100 px-2 py-1 rounded">GET /api/nearby</code> - Find nearby places</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}