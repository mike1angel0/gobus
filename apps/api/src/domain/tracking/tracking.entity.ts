/** Bus tracking data representing real-time location of a bus. */
export interface BusTrackingData {
  /** Unique tracking record identifier. */
  id: string;
  /** Bus being tracked. */
  busId: string;
  /** Current latitude (-90 to 90). */
  lat: number;
  /** Current longitude (-180 to 180). */
  lng: number;
  /** Current speed in km/h. */
  speed: number;
  /** Current heading in degrees (0=North, 0-360). */
  heading: number;
  /** Schedule the bus is currently running, if any. */
  scheduleId: string | null;
  /** Current stop index along the route. */
  currentStopIndex: number;
  /** Whether the tracking is currently active. */
  isActive: boolean;
  /** Date of the trip being tracked, if any. */
  tripDate: Date | null;
  /** Last update timestamp. */
  updatedAt: Date;
}
