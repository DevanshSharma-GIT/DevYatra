/**
 * Helper function to construct API URLs
 */
export const getApiUrl = (path: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Remove any trailing slashes from baseUrl
  const cleanBase = baseUrl.replace(/\/+$/, '');
  // Ensure path doesn't start with slash
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${cleanBase}/api/${cleanPath}`;
};

/**
 * Debug function to test API connectivity
 * @returns Promise<boolean> - True if connection test succeeds
 */
export const testApiConnection = async (endpoint: string = ''): Promise<{success: boolean, url: string, status?: number, message?: string}> => {
  try {
    const url = getApiUrl(endpoint);
    console.log(`Testing API connection to: ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    return {
      success: response.ok,
      url,
      status: response.status,
      message: response.ok ? 'Connection successful' : `HTTP error: ${response.status} ${response.statusText}`
    };
  } catch (error) {
    console.error('API connection test failed:', error);
    return {
      success: false,
      url: getApiUrl(endpoint),
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

/**
 * Check if the server is reachable
 * @returns Promise<boolean> - True if server is reachable
 */
export const isServerReachable = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    // Use the base URL directly for the health check, ensuring it points to the root.
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const cleanBaseUrl = baseUrl.replace(/\/+$/, ''); // Remove any trailing slash
    const healthCheckUrl = cleanBaseUrl + '/'; // Explicitly target the root path

    const response = await fetch(healthCheckUrl, { // Check the root path
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.error('Server connection check failed:', error);
    return false;
  }
};

/**
 * Enhanced fetch utility with robust error handling
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      // Add common headers
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {})
      }
    });
    
    if (!response.ok) {
      // Try to extract error message from response
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error || errorData.message) {
          errorMessage = errorData.error || errorData.message;
        }
      } catch {}
      
      throw new Error(errorMessage);
    }
    
    return await response.json();
  } catch (error) {
    console.error("API request failed:", error);
    // Re-throw for component to handle
    throw error;
  }
}
