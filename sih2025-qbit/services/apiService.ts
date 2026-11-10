/**
 * API Service for CBC D-02 Frontend
 * Handles all backend API communications with optimized search endpoints
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export interface SearchResult {
  place: {
    name: string;
    latitude: number;
    longitude: number;
    category: string;
    rating: number;
    popularity_score: number;
  };
  relevance_score: number;
  distance_km?: number;
  search_type: string;
}

export interface Recommendation {
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  rating: number;
  popularity_score: number;
  recommendation_type: string;
  relevance_score: number;
}

export interface SearchPerformanceStats {
  optimization_enabled: boolean;
  performance_stats: {
    cache_hit_rate: number;
    cache_size: number;
    popular_searches: [string, number][];
    recommendation_users: number;
    total_places: number;
    trie_nodes: number;
  };
  status: string;
}

/**
 * Main API service class
 */
export class APIService {
  private static baseUrl = API_BASE_URL;

  /**
   * Health check endpoint
   */
  static async healthCheck(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    return response.json();
  }

  /**
   * Search places with advanced optimization
   */
  static async searchPlaces(query: string, options?: {
    user_id?: string;
    user_lat?: number;
    user_lon?: number;
    limit?: number;
  }): Promise<{ results: SearchResult[]; metadata: any }> {
    const params = new URLSearchParams({ place: query });
    
    if (options?.user_id) params.append('user_id', options.user_id);
    if (options?.user_lat) params.append('user_lat', options.user_lat.toString());
    if (options?.user_lon) params.append('user_lon', options.user_lon.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const response = await fetch(`${this.baseUrl}/api/search?${params}`);
    return response.json();
  }

  /**
   * Get personalized recommendations
   */
  static async getRecommendations(userId: string, options?: {
    user_lat?: number;
    user_lon?: number;
    limit?: number;
  }): Promise<{ recommendations: Recommendation[]; algorithm: string; personalized: boolean }> {
    const params = new URLSearchParams({ user_id: userId });
    
    if (options?.user_lat) params.append('user_lat', options.user_lat.toString());
    if (options?.user_lon) params.append('user_lon', options.user_lon.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const response = await fetch(`${this.baseUrl}/api/recommendations?${params}`);
    return response.json();
  }

  /**
   * Get search engine performance statistics
   */
  static async getSearchPerformance(): Promise<SearchPerformanceStats> {
    const response = await fetch(`${this.baseUrl}/api/search_performance`);
    return response.json();
  }

  /**
   * Record user interaction for recommendation learning
   */
  static async recordUserInteraction(data: {
    user_id: string;
    place_name: string;
    interaction_type: 'view' | 'like' | 'book' | 'search' | 'click';
  }): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.baseUrl}/api/user_interaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * Get autocomplete suggestions
   */
  static async getAutocomplete(query: string, limit?: number): Promise<{
    suggestions: Array<{
      name: string;
      category: string;
      rating: number;
      search_type: string;
    }>;
  }> {
    const params = new URLSearchParams({ query });
    if (limit) params.append('limit', limit.toString());

    const response = await fetch(`${this.baseUrl}/api/autocomplete?${params}`);
    return response.json();
  }

  /**
   * Find nearby places
   */
  static async findNearby(lat: number, lon: number, options?: {
    limit?: number;
    radius?: number;
  }): Promise<{ places: any[]; search_type: string }> {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lon.toString(),
    });
    
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.radius) params.append('radius', options.radius.toString());

    const response = await fetch(`${this.baseUrl}/api/nearby?${params}`);
    return response.json();
  }

  /**
   * Book travel ticket
   */
  static async bookTravel(data: {
    user_id?: string;
    destination: string;
    departure_date: string;
    passengers: number;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/book_travel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  /**
   * Get user information
   */
  static async getUser(username: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/users/${username}`);
    return response.json();
  }
}

/**
 * React hook for using the API service
 */
export function useAPIService() {
  return {
    healthCheck: APIService.healthCheck,
    searchPlaces: APIService.searchPlaces,
    getRecommendations: APIService.getRecommendations,
    getSearchPerformance: APIService.getSearchPerformance,
    recordUserInteraction: APIService.recordUserInteraction,
    getAutocomplete: APIService.getAutocomplete,
    findNearby: APIService.findNearby,
    bookTravel: APIService.bookTravel,
    getUser: APIService.getUser,
  };
}

export default APIService;