"use client"

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertTriangle, Shield, Info, MessageSquareWarning, Globe } from 'lucide-react';
import Link from "next/link";
import { motion } from "framer-motion";

// Update the getApiUrl function to match the fix in safety/page.tsx
const getApiUrl = (path: string): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  // Remove any trailing slashes from baseUrl
  const cleanBase = baseUrl.replace(/\/+$/, '');
  // Ensure path doesn't start with slash
  const cleanPath = path.startsWith('/') ? path.substring(1) : path;
  return `${cleanBase}/api/${cleanPath}`;
}

interface SafetyStats {
  pickpocketing: number;
  scam: number;
  safe_locker: number;
  harassment: number;
  health: number;
  tip: number;
  // Add other types as needed
}

const statDetails = {
  pickpocketing: { icon: AlertTriangle, color: "text-red-600", label: "Pickpocketing" },
  scam: { icon: AlertTriangle, color: "text-orange-600", label: "Scams" },
  harassment: { icon: AlertTriangle, color: "text-purple-600", label: "Harassment" },
  health: { icon: Info, color: "text-blue-600", label: "Health/Safety Concerns" },
  transportation: { icon: Info, color: "text-cyan-600", label: "Transportation Issues" }, // Assuming this might be added later
  safe_locker: { icon: Shield, color: "text-green-600", label: "Safe Locker Info" },
  tip: { icon: MessageSquareWarning, color: "text-gray-600", label: "General Tips" },
};

export default function SafetyAnalysisPage() {
  const [stats, setStats] = useState<Partial<SafetyStats>>({}); // Use Partial as not all keys might exist initially
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        // Use the fixed API URL construction
        const apiUrl = getApiUrl('safety/statistics');
        console.log("Fetching statistics from:", apiUrl); // Debug log
        
        const response = await fetch(apiUrl);
        
        console.log("Statistics response status:", response.status); // Debug log
        
        if (response.ok) {
          const data: SafetyStats = await response.json();
          console.log("Received statistics:", data); // Debug log
          setStats(data);
        } else {
          const errorData = await response.json();
          setError(errorData.error || "Failed to fetch statistics");
        }
      } catch (err) {
        console.error("Error fetching safety statistics:", err); // Enhanced error log
        setError("Failed to connect to the server. Check your network connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const totalReports = Object.values(stats).reduce((sum, count) => sum + (count ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50">
      <header className="bg-white/80 backdrop-blur-sm border-b border-amber-100 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-6 w-6 text-amber-700" />
            <span className="font-semibold text-amber-900">HeritEdge</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/destinations" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Destinations
            </Link>
            <Link href="/experiences" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Experiences
            </Link>
            <Link href="/dashboard" className="text-amber-800 hover:text-amber-600 text-sm font-medium">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl mx-auto"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-stone-800">Safety Analysis</h1>
              <p className="text-stone-600 mt-1">Statistical breakdown of community safety reports</p>
            </div>
            <Link href="/safety">
              <Button className="bg-amber-700 hover:bg-amber-800 text-white">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Safety Map
              </Button>
            </Link>
          </div>

          <Card className="shadow-lg border border-amber-200">
            <CardHeader className="bg-gradient-to-r from-amber-600 to-amber-700 text-white p-4">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Safety Report Statistics
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-10 w-10 animate-spin text-amber-600" />
                  <p className="ml-3 text-stone-600">Loading statistics...</p>
                </div>
              ) : error ? (
                <div className="text-center py-12 text-red-600 bg-red-50 p-4 rounded border border-red-200">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p>Error loading statistics: {error}</p>
                </div>
              ) : totalReports === 0 ? (
                <div className="text-center py-12 text-stone-500">
                  <Shield className="h-12 w-12 mx-auto mb-3 text-amber-300" />
                  <p>No safety reports have been submitted yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(statDetails).map(([key, detail]) => {
                    const count = stats[key as keyof SafetyStats] ?? 0;
                    const Icon = detail.icon;
                    return (
                      <Card key={key} className="text-center hover:shadow-md transition-shadow border border-amber-100">
                        <CardHeader className="pb-2">
                          <Icon className={`h-8 w-8 mx-auto mb-2 ${detail.color}`} />
                          <CardTitle className="text-lg text-stone-800">{detail.label}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-3xl font-bold text-amber-700">{count}</p>
                          <p className="text-sm text-stone-500">
                            {totalReports > 0 ? `${((count / totalReports) * 100).toFixed(1)}%` : '0%'} of reports
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {/* Total Reports Card */}
                  <Card className="text-center bg-amber-50 sm:col-span-2 lg:col-span-3 border border-amber-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-stone-800">Total Reports</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-4xl font-bold text-amber-700">{totalReports}</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information Section */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border border-amber-200 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col">
                  <div className="bg-amber-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                    <Info className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-medium text-stone-800 text-lg mb-2">Understanding the Data</h3>
                  <p className="text-stone-600 text-sm mb-4">
                    These statistics represent community-reported safety incidents and tips. The data is collected from travelers like you who contribute to keeping our community safe.
                  </p>
                  <p className="text-stone-600 text-sm">
                    Remember that safety conditions can change rapidly. Always verify information with local authorities and use your best judgment.
                  </p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border border-amber-200 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col">
                  <div className="bg-amber-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-medium text-stone-800 text-lg mb-2">Safety Recommendations</h3>
                  <p className="text-stone-600 text-sm mb-4">
                    Based on the current data, we recommend being particularly vigilant about:
                  </p>
                  <ul className="text-stone-600 text-sm space-y-2 list-disc pl-5">
                    <li>Keep valuables secure and be aware of your surroundings</li>
                    <li>Research common scams at your destination before traveling</li>
                    <li>Share your itinerary with someone you trust</li>
                    <li>Save emergency contacts for your destination</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-amber-200 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center mb-4">
            <Globe className="h-5 w-5 text-amber-700 mr-2" />
            <span className="text-lg font-semibold text-stone-800">HeritEdge</span>
          </div>
          <p className="text-stone-600 text-sm">© {new Date().getFullYear()} HeritEdge. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
