"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { feature } from "topojson-client";
import { countryByA2, countryByN3, scoreLabel } from "@/lib/score";
import { subsolarPoint } from "@/lib/solar";
import { rampColorAlpha, scoreColor } from "@/lib/colors";
import { formatInTz } from "@/lib/time";

interface Props {
  simTime: number;
  scores: Map<string, number>;
  selected: string | null;
  onSelect: (a2: string) => void;
}

// Day/night blend driven by the real subsolar point. Fragment lat/lng comes
// from the equirect texture uv (left edge = 180°W), so the terminator is
// exact regardless of mesh orientation.
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform vec2 sunLatLng;
  varying vec2 vUv;
  const float PI = 3.141592653589793;
  vec3 toVec(float latDeg, float lngDeg) {
    float lat = latDeg * PI / 180.0;
    float lng = lngDeg * PI / 180.0;
    return vec3(cos(lat) * cos(lng), sin(lat), cos(lat) * sin(lng));
  }
  void main() {
    float lat = (vUv.y - 0.5) * 180.0;
    float lng = (vUv.x - 0.5) * 360.0;
    float cosAngle = dot(toVec(lat, lng), toVec(sunLatLng.x, sunLatLng.y));
    float blend = smoothstep(-0.12, 0.12, cosAngle);
    vec4 day = texture2D(dayTexture, vUv);
    vec4 night = texture2D(nightTexture, vUv);
    gl_FragColor = mix(night, day, blend);
  }
`;

const n3Of = (f: { id?: string | number }) => String(f.id ?? "").padStart(3, "0");

export default function GlobeView({ simTime, scores, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const scoresRef = useRef(scores);
  const simTimeRef = useRef(simTime);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  const altitudesRef = useRef(new Map<string, number>());
  const [ready, setReady] = useState(false);

  scoresRef.current = scores;
  simTimeRef.current = simTime;
  onSelectRef.current = onSelect;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSelected = (f: any) => {
    const c = countryByN3.get(n3Of(f));
    return !!c && c.a2 === selectedRef.current;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const capColor = (f: any) => {
    const c = countryByN3.get(n3Of(f));
    const s = c && scoresRef.current.get(c.a2);
    if (!s) return "rgba(255,255,255,0.05)";
    return rampColorAlpha((s - 1) / 9, 0.72);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const labelHtml = (f: any) => {
    const c = countryByN3.get(n3Of(f));
    if (!c) return `<div class="gtip"><b>${f.properties?.name ?? "—"}</b></div>`;
    const s = scoresRef.current.get(c.a2) ?? 1;
    const local = formatInTz(c.tz, new Date(simTimeRef.current), { weekday: "short" });
    return `<div class="gtip"><b>${c.name}</b><span>${local} local time</span><span><i style="background:${scoreColor(s)}"></i>${s}/10 · ${scoreLabel(s)}</span></div>`;
  };

  useEffect(() => {
    let disposed = false;
    const el = containerRef.current!;
    const onResize = () => globeRef.current?.width(window.innerWidth).height(window.innerHeight);

    (async () => {
      const { default: Globe } = await import("globe.gl");
      if (disposed) return;
      const globe = new Globe(el, { animateIn: true });
      globeRef.current = globe;

      globe
        .width(window.innerWidth)
        .height(window.innerHeight)
        .backgroundImageUrl("/textures/night-sky.png")
        .showAtmosphere(true)
        .atmosphereColor("#5a9be0")
        .atmosphereAltitude(0.16)
        .pointOfView({ lat: 18, lng: 30, altitude: 2.3 }, 0);

      const loader = new THREE.TextureLoader();
      const [dayTex, nightTex] = await Promise.all([
        loader.loadAsync("/textures/earth-day.jpg"),
        loader.loadAsync("/textures/earth-night.jpg"),
      ]);
      if (disposed) return;
      dayTex.colorSpace = THREE.SRGBColorSpace;
      nightTex.colorSpace = THREE.SRGBColorSpace;
      const sun = subsolarPoint(new Date(simTimeRef.current));
      const material = new THREE.ShaderMaterial({
        uniforms: {
          dayTexture: { value: dayTex },
          nightTexture: { value: nightTex },
          sunLatLng: { value: new THREE.Vector2(sun.lat, sun.lng) },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      materialRef.current = material;
      globe.globeMaterial(material);

      const topo = await fetch("/geo/countries-110m.json").then((r) => r.json());
      if (disposed) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const features = (feature(topo, topo.objects.countries) as any).features.filter(
        (f: { id?: string | number }) => n3Of(f) !== "010" // drop Antarctica
      );

      // zoom altitude per country from its polygon extent
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const f of features) {
        const c = countryByN3.get(n3Of(f));
        if (!c) continue;
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        const rings = f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat();
        for (const ring of rings) {
          for (const [lng, lat] of ring) {
            minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
            minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
          }
        }
        const span = Math.max(maxLat - minLat, (maxLng - minLng) * Math.cos((c.lat * Math.PI) / 180));
        altitudesRef.current.set(c.a2, Math.min(2, Math.max(0.4, span / 38)));
      }

      globe
        .polygonsData(features)
        .polygonAltitude((f: unknown) => (isSelected(f) ? 0.03 : 0.008))
        .polygonCapColor(capColor)
        .polygonSideColor((f: unknown) => (isSelected(f) ? "rgba(255,209,102,0.35)" : "rgba(0,0,0,0)"))
        .polygonStrokeColor((f: unknown) => (isSelected(f) ? "#ffd166" : "rgba(255,255,255,0.25)"))
        .polygonsTransitionDuration(0)
        .polygonLabel(labelHtml)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonClick((f: any) => {
          const c = countryByN3.get(n3Of(f));
          if (c) onSelectRef.current(c.a2);
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .onPolygonHover((f: any) => {
          el.style.cursor = f ? "pointer" : "grab";
        })
        .ringColor(() => (t: number) => `rgba(255,209,102,${Math.max(0, 1 - t)})`)
        .ringMaxRadius(3.5)
        .ringPropagationSpeed(1.6)
        .ringRepeatPeriod(1100);

      const controls = globe.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.4;
      controls.minDistance = 130;
      controls.addEventListener("start", () => {
        controls.autoRotate = false;
      });

      window.addEventListener("resize", onResize);
      setReady(true);
    })();

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      globeRef.current?._destructor?.();
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // repaint heat colors when scores change
  useEffect(() => {
    const g = globeRef.current;
    if (ready && g) g.polygonCapColor((f: unknown) => capColor(f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, ready]);

  // move the sun with simulated time
  useEffect(() => {
    const m = materialRef.current;
    if (!m) return;
    const { lat, lng } = subsolarPoint(new Date(simTime));
    (m.uniforms.sunLatLng.value as THREE.Vector2).set(lat, lng);
  }, [simTime, ready]);

  // fly to selection + pulse ring + highlight
  useEffect(() => {
    const g = globeRef.current;
    selectedRef.current = selected;
    if (!ready || !g) return;
    g.polygonAltitude((f: unknown) => (isSelected(f) ? 0.03 : 0.008));
    g.polygonSideColor((f: unknown) => (isSelected(f) ? "rgba(255,209,102,0.35)" : "rgba(0,0,0,0)"));
    g.polygonStrokeColor((f: unknown) => (isSelected(f) ? "#ffd166" : "rgba(255,255,255,0.25)"));
    if (selected) {
      const c = countryByA2.get(selected);
      if (!c) return;
      g.ringsData([{ lat: c.lat, lng: c.lng }]);
      g.controls().autoRotate = false;
      g.pointOfView({ lat: c.lat, lng: c.lng, altitude: altitudesRef.current.get(c.a2) ?? 0.9 }, 900);
    } else {
      g.ringsData([]);
      const pov = g.pointOfView();
      if (pov.altitude < 1.8) g.pointOfView({ ...pov, altitude: 2.3 }, 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, ready]);

  return <div ref={containerRef} className="globe-container" />;
}
