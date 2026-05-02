export type FloodStatus = 'normal' | 'warning' | 'critical';

export interface CameraState {
  camera_id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  status: FloodStatus;
  water_depth: number;
  detected_objects: string[];
  screenshot_base64?: string;
  is_processing: boolean;
  // Frontend specific states
  is_confirmed_critical?: boolean;
  is_rejected?: boolean;
}
