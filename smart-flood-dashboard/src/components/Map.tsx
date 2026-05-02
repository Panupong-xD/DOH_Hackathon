"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, Circle, Autocomplete } from '@react-google-maps/api';
import { CameraState } from '@/types';
import CCTVPopup from './CCTVPopup';
import { Navigation, AlertTriangle } from 'lucide-react';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: 13.7563,
  lng: 100.5018
};

// ใช้ธีมมืดแบบที่ยังคงเห็นเส้นถนนชัดเจน (High Contrast Dark Theme)
const mapOptions = {
  disableDefaultUI: true,
  zoomControl: true,
  styles: [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#757575" }] },
    { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
    { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "poi.park", elementType: "labels.text.stroke", stylers: [{ color: "#1b1b1b" }] },
    { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
    { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#4e4e4e" }] },
    { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
    { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
  ],
};

interface MapProps {
  nodes: CameraState[];
  selectedNodeId: string | null;
  onNodeSelect: (node: CameraState | null) => void;
}

export default function Map({ nodes, selectedNodeId, onNodeSelect }: MapProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "", 
    libraries: ['places', 'geometry']
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeMessage, setRouteMessage] = useState<{type: 'error'|'success'|'warning', text: string} | null>(null);
  const [currentWaypoint, setCurrentWaypoint] = useState<google.maps.LatLng | null>(null);
  const [pickingMode, setPickingMode] = useState<'origin' | 'dest' | null>(null);
  
  const originRef = useRef<HTMLInputElement>(null);
  const destRef = useRef<HTMLInputElement>(null);
  
  const getMarkerIcon = (node: CameraState) => {
    if (!isLoaded) return undefined;
    let color = '#22c55e';
    if (node.is_confirmed_critical) color = '#ef4444';
    else if (node.water_depth >= 30) color = '#f97316';
    else if (node.water_depth >= 10) color = '#eab308';
    
    return {
      path: window.google.maps.SymbolPath.CIRCLE,
      fillColor: color,
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: '#ffffff',
      scale: 10,
    };
  };

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  useEffect(() => {
    if (map && selectedNodeId) {
      const node = nodes.find(n => n.camera_id === selectedNodeId);
      if (node) {
        map.panTo(node.location);
        map.setZoom(13);
      }
    }
  }, [selectedNodeId, map, nodes]);

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    onNodeSelect(null);
    if (!pickingMode || !e.latLng) return;
    
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      let value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      if (status === "OK" && results && results[0]) {
        value = results[0].formatted_address;
      }
      
      if (pickingMode === 'origin' && originRef.current) {
        originRef.current.value = value;
      } else if (pickingMode === 'dest' && destRef.current) {
        destRef.current.value = value;
      }
      setPickingMode(null);
    });
  };

  const DANGER_RADIUS = 5000; // 5km

  // ฟังก์ชันหาเส้นทางหลีกเลี่ยง โดยการสร้าง Waypoint อ้อมพื้นที่น้ำท่วมถ้าเส้นทางปกติผ่าน
  const calculateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originRef.current?.value || !destRef.current?.value || !isLoaded) return;
    
    setIsRouting(true);
    setRouteMessage(null);
    setCurrentWaypoint(null);
    
    const directionsService = new window.google.maps.DirectionsService();
    const confirmedNodes = nodes.filter(n => n.is_confirmed_critical);
    
    try {
      // ลองหาเส้นทางปกติแบบมี Alternatives ก่อน
      const initialRequest: google.maps.DirectionsRequest = {
        origin: originRef.current.value,
        destination: destRef.current.value,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: true,
      };
      
      const results = await directionsService.route(initialRequest);
      
      if (confirmedNodes.length === 0) {
        setDirectionsResponse(results);
        setRouteMessage({type: 'success', text: 'ค้นหาเส้นทางสำเร็จ'});
        setIsRouting(false);
        return;
      }

      // เช็คว่ามีเส้นทางไหนที่รอดจากการผ่านวงกลมบ้างไหม
      let bestRouteIndex = -1;
      let minIntersections = Infinity;
      let worstNodeHit: CameraState | null = null;
      let worstIntersectPoint: google.maps.LatLng | null = null;

      results.routes.forEach((route, index) => {
        let intersections = 0;
        const path = route.overview_path;
        
        for (const point of path) {
          for (const node of confirmedNodes) {
            const distance = window.google.maps.geometry.spherical.computeDistanceBetween(
              point,
              new window.google.maps.LatLng(node.location.lat, node.location.lng)
            );
            if (distance < DANGER_RADIUS) {
              intersections++;
              worstNodeHit = node;
              worstIntersectPoint = point;
            }
          }
        }
        
        if (intersections < minIntersections) {
          minIntersections = intersections;
          bestRouteIndex = index;
        }
      });

      // ถ้าเจอเส้นทางที่รอด (0 intersections) ใช้เส้นทางนั้นเลย
      if (minIntersections === 0) {
        setDirectionsResponse({ ...results, routeIndex: bestRouteIndex } as any);
        setRouteMessage({type: 'success', text: 'พบเส้นทางที่ปลอดภัยจากน้ำท่วม'});
      } 
      // ถ้าเส้นทางเดิมติดน้ำท่วมทั้งหมด ให้คำนวณหา Waypoint เพื่อตีอ้อม (Detour)
      else if (worstNodeHit && worstIntersectPoint) {
        setRouteMessage({type: 'warning', text: 'กำลังคำนวณเส้นทางอ้อมพิเศษ (Detour)...'});
        
        const nodeLatLng = new window.google.maps.LatLng(worstNodeHit.location.lat, worstNodeHit.location.lng);
        // หามุมองศาจากศูนย์กลางน้ำท่วมไปยังจุดที่ตัดผ่าน
        const heading = window.google.maps.geometry.spherical.computeHeading(nodeLatLng, worstIntersectPoint);
        // สร้างจุด Waypoint ใหม่ ให้ออกห่างจากศูนย์กลางไป 5.5 กม. ในทิศทางนั้น
        const detourPoint = window.google.maps.geometry.spherical.computeOffset(nodeLatLng, DANGER_RADIUS + 500, heading);
        
        const detourRequest: google.maps.DirectionsRequest = {
          origin: originRef.current.value,
          destination: destRef.current.value,
          waypoints: [{ location: detourPoint, stopover: false }],
          travelMode: window.google.maps.TravelMode.DRIVING,
        };
        
        try {
          const detourResults = await directionsService.route(detourRequest);
          setDirectionsResponse(detourResults);
          setCurrentWaypoint(detourPoint);
          setRouteMessage({type: 'success', text: 'สร้างเส้นทางอ้อมหลีกเลี่ยงพื้นที่น้ำท่วม 5 กม. สำเร็จ'});
        } catch (err) {
          console.error("Detour failed", err);
          setDirectionsResponse({ ...results, routeIndex: bestRouteIndex } as any);
          setRouteMessage({type: 'error', text: 'คำเตือน: ไม่สามารถหาเส้นทางอ้อมได้ทั้งหมด (รัศมีใหญ่เกินไปหรือเป็นจุดสิ้นสุด)'});
        }
      } else {
        setDirectionsResponse({ ...results, routeIndex: 0 } as any);
      }
      
    } catch (error) {
      console.error("Error calculating route:", error);
      setRouteMessage({type: 'error', text: 'ไม่สามารถค้นหาเส้นทางได้ กรุณาลองใหม่'});
    } finally {
      setIsRouting(false);
    }
  };

  const clearRoute = () => {
    setDirectionsResponse(null);
    setRouteMessage(null);
    if (originRef.current) originRef.current.value = '';
    if (destRef.current) destRef.current.value = '';
  };

  const getDeepLink = () => {
    if (!directionsResponse || !originRef.current?.value || !destRef.current?.value) return '#';
    const originStr = encodeURIComponent(originRef.current.value);
    const destStr = encodeURIComponent(destRef.current.value);
    
    let link = `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
    if (currentWaypoint) {
      link += `&waypoints=${currentWaypoint.lat()},${currentWaypoint.lng()}`;
    }
    return link;
  };

  if (loadError) return <div className="text-white">Error loading maps</div>;
  if (!isLoaded) return <div className="w-full h-full flex items-center justify-center bg-neutral-900 text-white">กำลังโหลดแผนที่...</div>;

  const selectedNode = nodes.find(n => n.camera_id === selectedNodeId);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-4 left-4 z-10 w-[420px] bg-neutral-900/95 backdrop-blur-md p-4 rounded-lg shadow-2xl border border-neutral-700">
        <h2 className="text-white font-bold mb-3 flex items-center gap-2">
          <Navigation size={18} className="text-blue-400" />
          ระบบนำทางอัจฉริยะ (หลีกเลี่ยงน้ำท่วม 5 กม.)
        </h2>
        {pickingMode && (
          <div className="mb-2 text-xs bg-blue-900/50 text-blue-300 p-2 rounded flex items-center gap-2 animate-pulse border border-blue-800">
             📍 โปรดคลิกจุดบนแผนที่เพื่อเลือก {pickingMode === 'origin' ? 'จุดเริ่มต้น' : 'จุดหมายปลายทาง'}
          </div>
        )}
        <form onSubmit={calculateRoute} className="flex flex-col gap-3">
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Autocomplete>
                <input 
                  type="text" 
                  placeholder="จุดเริ่มต้น (Origin)" 
                  ref={originRef}
                  className={`w-full bg-neutral-800 border ${pickingMode === 'origin' ? 'border-blue-500' : 'border-neutral-700'} text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:border-blue-500`}
                />
              </Autocomplete>
            </div>
            <button 
              type="button" 
              onClick={() => setPickingMode(pickingMode === 'origin' ? null : 'origin')}
              className={`p-2.5 rounded border transition-colors ${pickingMode === 'origin' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}
              title="คลิกเลือกบนแผนที่"
            >
              📍
            </button>
          </div>
          
          <div className="flex gap-2 items-center">
            <div className="flex-1">
              <Autocomplete>
                <input 
                  type="text" 
                  placeholder="จุดหมายปลายทาง (Destination)" 
                  ref={destRef}
                  className={`w-full bg-neutral-800 border ${pickingMode === 'dest' ? 'border-blue-500' : 'border-neutral-700'} text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:border-blue-500`}
                />
              </Autocomplete>
            </div>
            <button 
              type="button" 
              onClick={() => setPickingMode(pickingMode === 'dest' ? null : 'dest')}
              className={`p-2.5 rounded border transition-colors ${pickingMode === 'dest' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}
              title="คลิกเลือกบนแผนที่"
            >
              📍
            </button>
          </div>
          
          {routeMessage && (
            <div className={`text-xs flex items-center gap-1.5 p-2 rounded border ${
              routeMessage.type === 'error' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 
              routeMessage.type === 'warning' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50' :
              'bg-green-900/20 text-green-400 border-green-900/50'
            }`}>
              <AlertTriangle size={14} /> {routeMessage.text}
            </div>
          )}

          <button 
            type="submit" 
            disabled={isRouting}
            className="mt-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded text-sm font-bold disabled:opacity-50 transition-colors shadow-lg"
          >
            {isRouting ? 'กำลังคำนวณ...' : 'ค้นหาเส้นทางปลอดภัย'}
          </button>
        </form>
        
        {directionsResponse && (
          <div className="mt-4 pt-3 border-t border-neutral-700 flex justify-between items-center">
            <button 
              onClick={clearRoute}
              className="text-neutral-400 hover:text-white text-xs"
            >
              ล้างเส้นทาง
            </button>
            <a 
              href={getDeepLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors shadow-lg shadow-green-900/50"
            >
              <Navigation size={14} /> นำทางในแอป Maps
            </a>
          </div>
        )}
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={12}
        options={{...mapOptions, draggableCursor: pickingMode ? 'crosshair' : ''}}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
      >
        {nodes.filter(n => n.is_confirmed_critical).map(node => (
          <Circle
            key={`circle-${node.camera_id}`}
            center={node.location}
            radius={DANGER_RADIUS}
            options={{
              strokeColor: '#ef4444',
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: '#ef4444',
              fillOpacity: 0.2,
              clickable: false
            }}
          />
        ))}

        {nodes.map(node => (
          <Marker
            key={node.camera_id}
            position={node.location}
            icon={getMarkerIcon(node)}
            onClick={() => onNodeSelect(node)}
          />
        ))}

        {selectedNode && (
          <InfoWindow
            position={selectedNode.location}
            onCloseClick={() => onNodeSelect(null)}
            options={{
              pixelOffset: new window.google.maps.Size(0, -10),
              disableAutoPan: false,
            }}
          >
            <CCTVPopup node={selectedNode} />
          </InfoWindow>
        )}

        {directionsResponse && (
          <DirectionsRenderer 
            directions={directionsResponse} 
            routeIndex={(directionsResponse as any).routeIndex || 0}
            options={{
              polylineOptions: {
                strokeColor: '#3b82f6',
                strokeWeight: 6,
                strokeOpacity: 0.8
              },
              suppressMarkers: false
            }}
          />
        )}
      </GoogleMap>
    </div>
  );
}
