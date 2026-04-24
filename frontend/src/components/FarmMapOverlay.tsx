import { Map as MapIcon, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FarmMapOverlay({ farm }: { farm: any }) {
  const hasCoords = farm?.latitude && farm?.longitude;

  const openInMaps = () => {
    if (hasCoords) {
      // Opens Google Maps centered on the farm with a pin
      window.open(
        `https://www.google.com/maps?q=${farm.latitude},${farm.longitude}&z=16`,
        "_blank"
      );
    } else {
      // Fallback: search by location name
      window.open(
        `https://www.google.com/maps/search/${encodeURIComponent(farm.location)}`,
        "_blank"
      );
    }
  };

  const openDirections = () => {
    if (hasCoords) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${farm.latitude},${farm.longitude}`,
        "_blank"
      );
    }
  };

  return (
    <div className="flex gap-2 mt-2">
      <Button
        variant="outline"
        size="sm"
        className="flex-1 gap-2"
        onClick={openInMaps}
      >
        <MapIcon className="w-4 h-4" />
        View on Map
      </Button>

      {hasCoords && (
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2"
          onClick={openDirections}
        >
          <Navigation className="w-4 h-4" />
          Get Directions
        </Button>
      )}
    </div>
  );
}
