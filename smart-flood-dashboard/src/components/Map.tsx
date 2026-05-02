"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, Circle, Autocomplete } from '@react-google-maps/api';
import { CameraState } from '@/types';
import CCTVPopup from './CCTVPopup';
import { Navigation, AlertTriangle, X } from 'lucide-react';

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

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
    libraries: LIBRARIES
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [routeMessage, setRouteMessage] = useState<{type: 'error'|'success'|'warning', text: string} | null>(null);
  const [currentWaypoint, setCurrentWaypoint] = useState<google.maps.LatLng | null>(null);
  const [pickingMode, setPickingMode] = useState<'origin' | 'dest' | null>(null);
  const [isNavOpen, setIsNavOpen] = useState(false);
  
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

      for (let i = 0; i < results.routes.length; i++) {
        const route = results.routes[i];
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
            }
          }
        }
        
        if (intersections < minIntersections) {
          minIntersections = intersections;
          bestRouteIndex = i;
        }
      }

      // ถ้าเจอเส้นทางที่รอด (0 intersections) ใช้เส้นทางนั้นเลย
      if (minIntersections === 0) {
        setDirectionsResponse({ ...results, routeIndex: bestRouteIndex } as any);
        setRouteMessage({type: 'success', text: 'พบเส้นทางที่ปลอดภัยจากน้ำท่วม'});
      } 
      // ถ้าเส้นทางเดิมติดน้ำท่วมทั้งหมด ให้คำนวณหา Waypoint เพื่อตีอ้อม (Detour)
      else {
        setRouteMessage({type: 'warning', text: 'กำลังคำนวณเส้นทางอ้อมพิเศษ (Detour)...'});
        
        const path = results.routes[bestRouteIndex].overview_path;
        let detourPoints: { location: google.maps.LatLng, stopover: boolean }[] = [];
        
        // Find all nodes that are intersected by this best route
        const hitNodes = confirmedNodes.filter(node => {
          const nodeLatLng = new window.google.maps.LatLng(node.location.lat, node.location.lng);
          return path.some(p => window.google.maps.geometry.spherical.computeDistanceBetween(p, nodeLatLng) < DANGER_RADIUS);
        });

        for (const node of hitNodes) {
          const nodeLatLng = new window.google.maps.LatLng(node.location.lat, node.location.lng);
          let entryPoint: google.maps.LatLng | null = null;
          let exitPoint: google.maps.LatLng | null = null;
          
          for (const point of path) {
            if (window.google.maps.geometry.spherical.computeDistanceBetween(point, nodeLatLng) < DANGER_RADIUS) {
              if (!entryPoint) entryPoint = point;
              exitPoint = point;
            }
          }
          
          if (entryPoint && exitPoint) {
            // คำนวณทิศทางของเส้นทางที่วิ่งผ่านจุดน้ำท่วม
            const routeHeading = window.google.maps.geometry.spherical.computeHeading(entryPoint, exitPoint);
            
            // ผลักจุด Waypoint ออกไปด้านข้าง (ตั้งฉากกับเส้นทาง) ให้อยู่นอกรัศมีน้ำท่วมอย่างปลอดภัย
            // รัศมี 5km -> ผลักออกไป 8.5km จากศูนย์กลางน้ำท่วม เพื่อให้ถนนรอบนอกไม่เฉียดเข้าไป
            const detourRadius = DANGER_RADIUS + 3500; 
            
            const detour1 = window.google.maps.geometry.spherical.computeOffset(nodeLatLng, detourRadius, routeHeading + 90);
            const detour2 = window.google.maps.geometry.spherical.computeOffset(nodeLatLng, detourRadius, routeHeading - 90);
            
            const originLatLng = path[0];
            const destLatLng = path[path.length - 1];
            
            // เลือกจุดเลี้ยวที่ทำให้ระยะทางรวมสั้นกว่า
            const dist1 = window.google.maps.geometry.spherical.computeDistanceBetween(originLatLng, detour1) + 
                          window.google.maps.geometry.spherical.computeDistanceBetween(detour1, destLatLng);
            const dist2 = window.google.maps.geometry.spherical.computeDistanceBetween(originLatLng, detour2) + 
                          window.google.maps.geometry.spherical.computeDistanceBetween(detour2, destLatLng);
            
            const selectedDetour = dist1 < dist2 ? detour1 : detour2;
            detourPoints.push({ location: selectedDetour, stopover: false });
          }
        }
        
        if (detourPoints.length > 0) {
          // เรียงลำดับ Waypoint ตามระยะทางจากจุดเริ่มต้น เพื่อป้องกันการวิ่งวนไปมา
          const originLatLng = path[0];
          detourPoints.sort((a, b) => {
            const distA = window.google.maps.geometry.spherical.computeDistanceBetween(originLatLng, a.location);
            const distB = window.google.maps.geometry.spherical.computeDistanceBetween(originLatLng, b.location);
            return distA - distB;
          });

          // จำกัด Waypoints ไม่เกิน 5 จุด เพื่อป้องกันข้อจำกัดของ API
          const finalWaypoints = detourPoints.slice(0, 5);
          
          const detourRequest: google.maps.DirectionsRequest = {
            origin: originRef.current.value,
            destination: destRef.current.value,
            waypoints: finalWaypoints,
            travelMode: window.google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true
          };
          
          try {
            const detourResults = await directionsService.route(detourRequest);
            
            // ประเมินผลลัพธ์เส้นทางอ้อม ว่ารอดน้ำท่วมจริงไหม
            let bestDetourIndex = 0;
            let minDetourIntersections = Infinity;
            
            for (let i = 0; i < detourResults.routes.length; i++) {
              let ints = 0;
              for (const p of detourResults.routes[i].overview_path) {
                for (const n of confirmedNodes) {
                  if (window.google.maps.geometry.spherical.computeDistanceBetween(p, new window.google.maps.LatLng(n.location.lat, n.location.lng)) < DANGER_RADIUS) {
                    ints++;
                  }
                }
              }
              if (ints < minDetourIntersections) {
                minDetourIntersections = ints;
                bestDetourIndex = i;
              }
            }
            
            setDirectionsResponse({ ...detourResults, routeIndex: bestDetourIndex } as any);
            setCurrentWaypoint(finalWaypoints[0].location); // For deep link fallback
            
            if (minDetourIntersections === 0) {
              setRouteMessage({type: 'success', text: 'สร้างเส้นทางอ้อมหลีกเลี่ยงพื้นที่น้ำท่วมสำเร็จ'});
            } else {
              setRouteMessage({type: 'warning', text: `เลี่ยงได้บางส่วน (ยังต้องขับผ่านพื้นที่เฝ้าระวัง)`});
            }
          } catch (err) {
            console.error("Detour failed", err);
            setDirectionsResponse({ ...results, routeIndex: bestRouteIndex } as any);
            setRouteMessage({type: 'error', text: 'ไม่สามารถหาเส้นทางอ้อมที่สมบูรณ์ได้ (แสดงเส้นทางเดิมที่ดีที่สุด)'});
          }
        } else {
          setDirectionsResponse({ ...results, routeIndex: bestRouteIndex } as any);
          setRouteMessage({type: 'error', text: 'ไม่สามารถคำนวณจุดหลีกเลี่ยงได้'});
        }
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
      {!isNavOpen && (
        <button 
          onClick={() => setIsNavOpen(true)}
          className="absolute top-5 left-5 z-10 glass-card bg-blue-600/80 hover:bg-blue-500/90 text-white p-3.5 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.3)] flex items-center gap-2.5 transition-all border border-blue-400/30 hover:scale-105 backdrop-blur-md"
          title="เปิดระบบนำทางอัจฉริยะ"
        >
          <Navigation size={22} className="text-white" />
          <span className="font-bold pr-2 text-sm tracking-wide">ระบบนำทางอัจฉริยะ</span>
        </button>
      )}

      {isNavOpen && (
        <div className="absolute top-5 left-5 z-10 w-[420px] glass-panel p-5 rounded-2xl shadow-2xl border border-white/10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold flex items-center gap-2.5 text-lg">
              <Navigation size={20} className="text-blue-400" />
              ระบบนำทางอัจฉริยะ <span className="text-xs font-normal text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded border border-white/5 ml-1">Safe Route</span>
            </h2>
            <button 
              onClick={() => setIsNavOpen(false)}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/30"
              title="ปิด"
            >
              <X size={20} />
            </button>
          </div>
          {pickingMode && (
            <div className="mb-3 text-xs bg-blue-500/10 text-blue-300 p-2.5 rounded-lg flex items-center gap-2 animate-pulse border border-blue-500/30 shadow-inner">
               📍 โปรดคลิกจุดบนแผนที่เพื่อเลือก <span className="font-bold">{pickingMode === 'origin' ? 'จุดเริ่มต้น' : 'จุดหมายปลายทาง'}</span>
            </div>
          )}
          <form onSubmit={calculateRoute} className="flex flex-col gap-3.5">
            <div className="flex gap-2 items-center">
              <div className="flex-1">
                <Autocomplete>
                  <input 
                    type="text" 
                    placeholder="จุดเริ่มต้น (Origin)" 
                    ref={originRef}
                    className={`w-full bg-slate-900/50 border ${pickingMode === 'origin' ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-white/10'} text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-all placeholder:text-slate-500`}
                  />
                </Autocomplete>
              </div>
              <button 
                type="button" 
                onClick={() => setPickingMode(pickingMode === 'origin' ? null : 'origin')}
                className={`p-3 rounded-xl border transition-all ${pickingMode === 'origin' ? 'bg-blue-600/80 border-blue-400 text-white shadow-lg' : 'bg-slate-800/50 border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
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
                    className={`w-full bg-slate-900/50 border ${pickingMode === 'dest' ? 'border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'border-white/10'} text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-all placeholder:text-slate-500`}
                  />
                </Autocomplete>
              </div>
              <button 
                type="button" 
                onClick={() => setPickingMode(pickingMode === 'dest' ? null : 'dest')}
                className={`p-3 rounded-xl border transition-all ${pickingMode === 'dest' ? 'bg-blue-600/80 border-blue-400 text-white shadow-lg' : 'bg-slate-800/50 border-white/10 text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                title="คลิกเลือกบนแผนที่"
              >
              📍
            </button>
          </div>
          
            {routeMessage && (
              <div className={`text-xs flex items-center gap-2 p-3 rounded-lg border shadow-inner font-medium ${
                routeMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 
                routeMessage.type === 'warning' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                'bg-green-500/10 text-green-400 border-green-500/30'
              }`}>
                <AlertTriangle size={16} /> {routeMessage.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isRouting}
              className="mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-3.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(79,70,229,0.3)] active:scale-[0.98] border border-blue-400/30 tracking-wide"
            >
              {isRouting ? 'กำลังคำนวณเส้นทาง...' : 'ค้นหาเส้นทางปลอดภัย'}
            </button>
          </form>
          
          {directionsResponse && (
            <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center bg-slate-900/30 -mx-5 -mb-5 p-5 rounded-b-2xl">
              <button 
                onClick={clearRoute}
                className="text-slate-400 hover:text-red-400 text-xs font-bold uppercase tracking-wider transition-colors px-2 py-1 rounded hover:bg-red-500/10"
              >
                ล้างเส้นทาง
              </button>
              <a 
                href={getDeepLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all border border-white/10 hover:border-white/20 shadow-lg"
              >
                <Navigation size={14} className="text-blue-400" /> นำทางในแอป Maps
              </a>
            </div>
          )}
        </div>
      )}

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
              pixelOffset: new window.google.maps.Size(0, -20),
              disableAutoPan: false,
            }}
          >
            <CCTVPopup node={selectedNode} onClose={() => onNodeSelect(null)} />
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
