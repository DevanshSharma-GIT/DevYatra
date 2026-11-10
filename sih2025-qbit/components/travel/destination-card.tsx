import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { MapPin, Star, Users, Clock, ArrowRight } from "lucide-react";

interface DestinationCardProps {
  title: string;
  description: string;
  imageUrl?: string;
  location?: string;
  rating?: number;
  crowdDensity?: "low" | "medium" | "high";
  price?: number;
  currency?: string;
  timeToVisit?: string;
  linkUrl?: string;
  className?: string;
  onClick?: () => void;
}

export function DestinationCard({
  title,
  description,
  imageUrl = "/placeholder-destination.jpg",
  location,
  rating,
  crowdDensity,
  price,
  currency = "₹",
  timeToVisit,
  linkUrl,
  className,
  onClick,
}: DestinationCardProps) {
  const crowdColors = {
    low: { bg: "bg-green-100", text: "text-green-800", label: "Low Crowd" },
    medium: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Medium Crowd" },
    high: { bg: "bg-red-100", text: "text-red-800", label: "High Crowd" },
  };

  const crowdInfo = crowdDensity ? crowdColors[crowdDensity] : null;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={className}
    >
      <Card className="overflow-hidden h-full border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
        <div className="relative h-48 w-full overflow-hidden">
          {imageUrl && (
            <Image
              src={imageUrl}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              style={{ objectFit: 'cover' }}
              priority={false}
              className="object-cover transition-transform hover:scale-105 duration-500"
              onError={(e) => {
                // Fallback for image loading errors
                (e.target as HTMLImageElement).src = "/placeholder-destination.jpg";
              }}
            />
          )}
          {crowdInfo && (
            <Badge
              className={cn("absolute top-3 right-3", crowdInfo.bg, crowdInfo.text)}
            >
              <Users className="h-3 w-3 mr-1" />
              {crowdInfo.label}
            </Badge>
          )}
        </div>

        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            {rating && (
              <div className="flex items-center bg-yellow-100 px-2 py-1 rounded text-yellow-700 text-xs font-medium">
                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 mr-1" />
                {rating}
              </div>
            )}
          </div>
          {location && (
            <div className="flex items-center text-gray-500 text-xs mt-1">
              <MapPin className="h-3 w-3 mr-1" />
              {location}
            </div>
          )}
        </CardHeader>

        <CardContent className="text-sm text-gray-600">
          <p className="line-clamp-3">{description}</p>

          <div className="flex flex-wrap gap-2 mt-3">
            {price !== undefined && (
              <Badge variant="outline" className="bg-white border-blue-200 text-blue-700">
                {currency} {price}
              </Badge>
            )}
            {timeToVisit && (
              <Badge variant="outline" className="bg-white border-purple-200 text-purple-700">
                <Clock className="h-3 w-3 mr-1" />
                {timeToVisit}
              </Badge>
            )}
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          {linkUrl ? (
            <Link href={linkUrl} className="w-full">
              <Button
                variant="outline"
                className="w-full border-teal-200 text-teal-700 hover:bg-teal-50"
                onClick={onClick}
              >
                Explore <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <Button
              variant="outline"
              className="w-full border-teal-200 text-teal-700 hover:bg-teal-50"
              onClick={onClick}
            >
              Explore <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    </motion.div>
  );
}
