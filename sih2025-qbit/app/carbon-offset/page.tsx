"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Leaf, Plane, Car, Train, TreePine } from "lucide-react";
import { Progress } from "@/components/ui/progress";

// Types
interface EmissionData {
  transport_emission: number;
  accommodation_emission: number;
  food_emission: number;
  activity_emission: number;
  shopping_emission: number;
  total_emission: number;
  calculated_distance_km?: number;
}

interface TripData {
  user_id: string;
  trip_id: number;
  trip_emissions: EmissionData;
  ai_summary: string;
}

interface TripSummary {
  user_id: string;
  trip_count: number;
  total_emissions: number;
  ai_summary: string;
  trips: Trip[];
}

interface Trip {
  id: number;
  user_id: string;
  mode: string;
  distance_km: number;
  nights: number;
  meals_per_day: number;
  days: number;
  activities: number;
  shopping_usd: number;
  emissions_breakdown: EmissionData;
  timestamp: string;
}

// BASE_URL for your Flask API (set NEXT_PUBLIC_API_URL in .env to e.g. http://localhost:5000)
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Carbon Offset component
export default function CarbonOffset() {
  // Generate a random user ID if not found in localStorage
  const [userId, setUserId] = useState<string>("");
  
  useEffect(() => {
    const storedUserId = localStorage.getItem("carbon_user_id");
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = `user_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("carbon_user_id", newUserId);
      setUserId(newUserId);
    }
  }, []);

  useEffect(() => {
    if (userId) {
      fetchUserSummary(userId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // State for form inputs
  const [formData, setFormData] = useState({
    mode: "flight",
    distance: "",
    origin_airport: "",
    destination_airport: "",
    nights: "0",
    meals_per_day: "0",
    days: "0",
    activities: "0",
    shopping_usd: "0"
  });
  
  // State for API responses
  const [tripData, setTripData] = useState<TripData | null>(null);
  const [userSummary, setUserSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle form input changes
  const handleChange = (field: string, value: string) => {
    setFormData({
      ...formData,
      [field]: value
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        user_id: userId,
        mode: formData.mode,
        distance: parseFloat(formData.distance) || 0,
        origin_airport: formData.origin_airport || undefined,
        destination_airport: formData.destination_airport || undefined,
        nights: parseInt(formData.nights) || 0,
        meals_per_day: parseInt(formData.meals_per_day) || 0,
        days: parseInt(formData.days) || 0,
        activities: parseInt(formData.activities) || 0,
        shopping_usd: parseFloat(formData.shopping_usd) || 0
      };

      const response = await fetch(`${BASE_URL}/api/carbon/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Calculation failed');
      }

      const data = await response.json();
      setTripData(data);
      
      // Refresh user summary after adding a new trip
      fetchUserSummary(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Fetch user summary
  const fetchUserSummary = async (id: string) => {
    try {
      const response = await fetch(`${BASE_URL}/api/carbon/user/${id}/summary`);
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to fetch summary');
      }
      const text = await response.text();
      let json: TripSummary;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Invalid JSON response from server');
      }
      setUserSummary(json);
    } catch (err) {
      console.error(err);
      setUserSummary(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Function to render emission value with appropriate color
  const renderEmissionValue = (value: number) => {
    let colorClass = "text-amber-600";
    if (value > 100) colorClass = "text-red-600";
    else if (value < 50) colorClass = "text-green-600";
    
    return <span className={`font-semibold ${colorClass}`}>{value.toFixed(2)} kg</span>;
  };

  // Function to get transport icon
  const getTransportIcon = (mode: string) => {
    switch (mode) {
      case "flight":
        return <Plane className="h-4 w-4" />;
      case "car":
        return <Car className="h-4 w-4" />;
      case "train":
        return <Train className="h-4 w-4" />;
      default:
        return <Leaf className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-amber-900 mb-6">Carbon Footprint Calculator</h1>
      <p className="text-stone-700 mb-8">
        Track and offset your travel carbon footprint. Understand the environmental impact of your journeys
        and get AI-powered suggestions to reduce or offset your emissions.
      </p>

      <Tabs defaultValue="calculate" className="w-full">
        <TabsList className="grid grid-cols-2 mb-8">
          <TabsTrigger value="calculate">Calculate Footprint</TabsTrigger>
          <TabsTrigger value="history">Your History</TabsTrigger>
        </TabsList>

        <TabsContent value="calculate">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Form */}
            <Card className="shadow-md border-amber-100">
              <CardHeader className="bg-gradient-to-r from-amber-500 to-amber-600 text-white">
                <CardTitle>Trip Details</CardTitle>
                <CardDescription className="text-amber-100">
                  Enter details about your trip to calculate its carbon footprint
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label htmlFor="mode">Transport Mode</Label>
                    <Select 
                      value={formData.mode} 
                      onValueChange={(value) => handleChange("mode", value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select mode of transport" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="flight">Flight</SelectItem>
                        <SelectItem value="car">Car</SelectItem>
                        <SelectItem value="train">Train</SelectItem></SelectContent>
                    </Select>
                  </div>

                  {formData.mode === "flight" ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="origin_airport">Origin Airport (IATA code)</Label>
                        <Input
                          id="origin_airport"
                          placeholder="e.g. JFK, DEL"
                          value={formData.origin_airport}
                          onChange={(e) => handleChange("origin_airport", e.target.value)}
                          className="border-amber-200 focus-visible:ring-amber-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destination_airport">Destination Airport</Label>
                        <Input
                          id="destination_airport"
                          placeholder="e.g. LHR, BOM"
                          value={formData.destination_airport}
                          onChange={(e) => handleChange("destination_airport", e.target.value)}
                          className="border-amber-200 focus-visible:ring-amber-500"
                        />
                      </div>
                      <div className="col-span-2 mt-1">
                        <p className="text-xs text-stone-500">
                          If you don't know the airport codes, you can manually enter the distance below.
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="distance">Distance (km)</Label>
                    <Input
                      id="distance"
                      type="number"
                      placeholder="Distance in kilometers"
                      min="0"
                      value={formData.distance}
                      onChange={(e) => handleChange("distance", e.target.value)}
                      className="border-amber-200 focus-visible:ring-amber-500"
                    />
                    <p className="text-xs text-stone-500">
                      {formData.mode === "flight" 
                        ? "If you entered airport codes above, this is optional"
                        : "Enter the total distance for your trip"}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nights">Accommodation Nights</Label>
                      <Input
                        id="nights"
                        type="number"
                        min="0"
                        value={formData.nights}
                        onChange={(e) => handleChange("nights", e.target.value)}
                        className="border-amber-200 focus-visible:ring-amber-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="days">Trip Duration (days)</Label>
                      <Input
                        id="days"
                        type="number"
                        min="1"
                        value={formData.days}
                        onChange={(e) => handleChange("days", e.target.value)}
                        className="border-amber-200 focus-visible:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="meals_per_day">Meals per Day</Label>
                      <Input
                        id="meals_per_day"
                        type="number"
                        min="0"
                        max="10"
                        value={formData.meals_per_day}
                        onChange={(e) => handleChange("meals_per_day", e.target.value)}
                        className="border-amber-200 focus-visible:ring-amber-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="activities">Number of Activities</Label>
                      <Input
                        id="activities"
                        type="number"
                        min="0"
                        value={formData.activities}
                        onChange={(e) => handleChange("activities", e.target.value)}
                        className="border-amber-200 focus-visible:ring-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shopping_usd">Shopping Amount (USD)</Label>
                    <Input
                      id="shopping_usd"
                      type="number"
                      min="0"
                      value={formData.shopping_usd}
                      onChange={(e) => handleChange("shopping_usd", e.target.value)}
                      className="border-amber-200 focus-visible:ring-amber-500"
                    />
                  </div>
                </CardContent>
                <CardFooter className="bg-amber-50 border-t border-amber-100">
                  <Button 
                    type="submit" 
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    disabled={loading}
                  >
                    {loading ? "Calculating..." : "Calculate Carbon Footprint"}
                  </Button>
                </CardFooter>
              </form>
            </Card>

            {/* Results Card */}
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-md flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {tripData && (
                <Card className="shadow-md border-amber-100">
                  <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                    <CardTitle className="flex items-center gap-2">
                      <Leaf className="h-5 w-5" />
                      Carbon Footprint Results
                    </CardTitle>
                    <CardDescription className="text-green-100">
                      Your trip's environmental impact
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-6">
                    <div className="text-center mb-4">
                      <p className="text-sm text-stone-600 mb-1">Total Carbon Emissions</p>
                      <p className="text-4xl font-bold text-amber-700">
                        {tripData.trip_emissions.total_emission.toFixed(2)} 
                        <span className="text-lg ml-1">kg CO₂e</span>
                      </p>
                      <p className="text-xs text-stone-500 mt-1">
                        Equivalent to approximately{" "}
                        {(tripData.trip_emissions.total_emission / 10).toFixed(1)} trees needed to absorb this CO₂
                      </p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-medium text-stone-700">Emissions Breakdown</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-2">
                            {getTransportIcon(formData.mode)}
                            Transport
                          </span>
                          {renderEmissionValue(tripData.trip_emissions.transport_emission)}
                        </div>
                        <Progress
                          value={(tripData.trip_emissions.transport_emission / tripData.trip_emissions.total_emission) * 100}
                          className="h-2 bg-stone-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Accommodation</span>
                          {renderEmissionValue(tripData.trip_emissions.accommodation_emission)}
                        </div>
                        <Progress
                          value={(tripData.trip_emissions.accommodation_emission / tripData.trip_emissions.total_emission) * 100}
                          className="h-2 bg-stone-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Food</span>
                          {renderEmissionValue(tripData.trip_emissions.food_emission)}
                        </div>
                        <Progress
                          value={(tripData.trip_emissions.food_emission / tripData.trip_emissions.total_emission) * 100}
                          className="h-2 bg-stone-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Activities</span>
                          {renderEmissionValue(tripData.trip_emissions.activity_emission)}
                        </div>
                        <Progress
                          value={(tripData.trip_emissions.activity_emission / tripData.trip_emissions.total_emission) * 100}
                          className="h-2 bg-stone-100"
                        />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Shopping</span>
                          {renderEmissionValue(tripData.trip_emissions.shopping_emission)}
                        </div>
                        <Progress
                          value={(tripData.trip_emissions.shopping_emission / tripData.trip_emissions.total_emission) * 100}
                          className="h-2 bg-stone-100"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {tripData && (
                <Card className="shadow-md border-amber-100">
                  <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                    <CardTitle>AI Recommendations</CardTitle>
                    <CardDescription className="text-blue-100">
                      Smart suggestions to reduce your carbon impact
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="bg-blue-50 border border-blue-100 rounded-md p-4 text-stone-700">
                      {tripData.ai_summary.split('\n').map((line, i) => (
                        <p key={i} className={line.trim().startsWith('•') || line.trim().startsWith('-') ? 'ml-4 mt-2' : 'mb-2'}>
                          {line}
                        </p>
                      ))}
                    </div>
                    
                    <div className="mt-6 flex flex-col gap-4">
                      <h4 className="font-medium text-stone-700">Offset Your Impact</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button className="bg-green-600 hover:bg-green-700 text-white flex gap-2">
                          <TreePine className="h-4 w-4" />
                          Plant Trees (₹{(tripData.trip_emissions.total_emission * 30).toFixed(0)})
                        </Button>
                        <Button variant="outline" className="border-green-600 text-green-700 hover:bg-green-50">
                          Learn About Carbon Credits
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card className="shadow-md border-amber-100">
            <CardHeader className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
              <CardTitle>Your Carbon Footprint History</CardTitle>
              <CardDescription className="text-purple-100">
                {userSummary ? (
                  <span>
                    You have recorded {userSummary.trip_count} trips with a total of{" "}
                    <span className="font-bold">{userSummary.total_emissions.toFixed(2)} kg CO₂e</span>
                  </span>
                ) : (
                  "Start tracking your trips to build your history"
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {userSummary && userSummary.trip_count > 0 ? (
                <div className="space-y-8">
                  <div className="bg-purple-50 border border-purple-100 rounded-md p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      AI Summary
                    </h3>
                    <div className="text-stone-700">
                      {userSummary.ai_summary.split('\n').map((line, i) => (
                        <p key={i} className={line.trim().startsWith('•') || line.trim().startsWith('-') ? 'ml-4 mt-2' : 'mb-2'}>
                          {line}
                        </p>
                      ))}
                    </div>
                  </div>

                  <h3 className="font-semibold text-stone-800">Recent Trips</h3>
                  
                  <div className="space-y-4">
                    {userSummary.trips.slice(0, 5).map(trip => (
                      <div 
                        key={trip.id}
                        className="border border-stone-200 rounded-md p-4 hover:bg-stone-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {getTransportIcon(trip.mode)}
                            <span className="font-medium text-stone-800 capitalize">
                              {trip.mode} Trip
                            </span>
                          </div>
                          <span className="text-xs text-stone-500">
                            {new Date(trip.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                          <div>
                            <span className="text-stone-500">Distance:</span>{" "}
                            <span className="font-medium">{trip.distance_km} km</span>
                          </div>
                          {trip.days > 0 && (
                            <div>
                              <span className="text-stone-500">Duration:</span>{" "}
                              <span className="font-medium">{trip.days} days</span>
                            </div>
                          )}
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="text-xs flex items-center gap-1.5">
                            <div className="bg-amber-100 w-3 h-3 rounded-full"></div>
                            <span>Transport: {trip.emissions_breakdown.transport_emission.toFixed(1)} kg</span>
                            <div className="bg-amber-200 w-3 h-3 rounded-full ml-2"></div>
                            <span>Other: {(
                              trip.emissions_breakdown.accommodation_emission +
                              trip.emissions_breakdown.food_emission +
                              trip.emissions_breakdown.activity_emission +
                              trip.emissions_breakdown.shopping_emission
                            ).toFixed(1)} kg</span>
                          </div>
                          <span className="font-semibold text-amber-700">
                            {trip.emissions_breakdown.total_emission.toFixed(1)} kg CO₂e
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {userSummary.trips.length > 5 && (
                    <div className="text-center">
                      <p className="text-stone-500 text-sm">
                        Showing 5 of {userSummary.trips.length} trips
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-stone-500">
                  <Leaf className="h-12 w-12 mx-auto mb-4 text-stone-300" />
                  <h3 className="text-lg font-medium mb-2">No trips recorded yet</h3>
                  <p className="max-w-md mx-auto">
                    Track your first trip to start building your carbon footprint history
                    and get personalized recommendations.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
