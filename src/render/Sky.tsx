import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/store';
import { qualityTiers, type QualityTier } from './controls';

interface SkyProps {
  quality: QualityTier;
}

const DAY_TOP = new THREE.Color('#4a90d9');
const DAY_BOTTOM = new THREE.Color('#cfe3f0');
const NIGHT_TOP = new THREE.Color('#0b1026');
const NIGHT_BOTTOM = new THREE.Color('#1a1f33');
const DUSK = new THREE.Color('#e08a4a');
const RAIN_TOP = new THREE.Color('#39424e');
const RAIN_BOTTOM = new THREE.Color('#5a6570');

export function SkyAndWeather({ quality }: SkyProps) {
  const skyRef = useRef<THREE.Mesh>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const rainRef = useRef<THREE.Points>(null);
  const cameraPos = useRef(new THREE.Vector3());
  const sunDirection = useRef(new THREE.Vector3(0, 1, 0));
  const skyTop = useRef(new THREE.Color());
  const skyBottom = useRef(new THREE.Color());
  const sunTarget = useMemo(() => new THREE.Object3D(), []);
  const { scene } = useThree();
  const tier = qualityTiers[quality] ?? qualityTiers.mid;

  useFrame(({ camera }) => {
    cameraPos.current.copy(camera.position);
  });

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color('#4a90d9') },
      bottomColor: { value: new THREE.Color('#cfe3f0') },
      sunDirection: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color('#fff2dd') },
    }),
    [],
  );

  const rainGeo = useMemo(() => {
    const count = 1100;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = Math.random() * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 70;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  const fog = useMemo(() => new THREE.Fog('#cfe3f0', 60, 260), []);
  scene.fog = fog;

  useFrame((_, dt) => {
    const engine = useGame.getState().engine;
    if (!engine) return;
    const { minute, weather } = engine.state.world;
    const x = ((minute - 720) / 720) * Math.PI;
    const solar = Math.cos(x);
    const day = THREE.MathUtils.clamp(solar * 0.5 + 0.5, 0, 1);
    const duskAmount = Math.max(0, 1 - Math.min(Math.abs(minute - 1060), Math.abs(minute - 350)) / 100);

    const top = skyTop.current.copy(NIGHT_TOP).lerp(DAY_TOP, day).lerp(DUSK, duskAmount * 0.35);
    const bottom = skyBottom.current.copy(NIGHT_BOTTOM).lerp(DAY_BOTTOM, day).lerp(DUSK, duskAmount * 0.5);

    if (weather === 'rain') {
      top.lerp(RAIN_TOP, 0.55);
      bottom.lerp(RAIN_BOTTOM, 0.55);
    }

    uniforms.topColor.value.copy(top);
    uniforms.bottomColor.value.copy(bottom);
    if (skyRef.current) skyRef.current.position.set(cameraPos.current.x, 0, cameraPos.current.z);

    fog.color.copy(bottom);
    fog.near = quality === 'low' ? 30 : quality === 'mid' ? 45 : 60;
    fog.far = tier.fog;
    if (weather === 'rain') fog.far *= 0.7;

    const angle = (minute / 1440) * Math.PI * 2 - Math.PI / 2;
    const sunX = Math.cos(angle) * 220;
    const sunY = Math.sin(angle) * 220;
    sunDirection.current.set(sunX, sunY, 90).normalize();
    uniforms.sunDirection.value.copy(sunDirection.current);
    uniforms.sunColor.value.set(day > 0.5 ? '#fff1d2' : '#ffc98f');

    if (sunRef.current) {
      sunRef.current.target = sunTarget;
      sunTarget.position.set(cameraPos.current.x, 0, cameraPos.current.z);
      sunRef.current.position.set(sunX + cameraPos.current.x, Math.max(sunY, -40), 90 + cameraPos.current.z);
      sunRef.current.intensity = 0.12 + day * (weather === 'rain' ? 0.55 : 0.95);
      sunRef.current.color.set(day > 0.5 ? '#fff2dd' : '#ffcf9e');
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.26 + day * 0.52;
      hemiRef.current.color.copy(bottom);
    }

    if (rainRef.current) {
      const engine2 = useGame.getState();
      rainRef.current.visible = weather === 'rain';
      if (weather === 'rain') {
        rainRef.current.position.set(engine2.player.x, 0, engine2.player.z);
        rainRef.current.geometry.setDrawRange(0, tier.rain);
        const pos = rainRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < tier.rain * 3; i += 3) {
          arr[i + 1] -= 26 * Math.min(dt, 0.05);
          if (arr[i + 1] < 0) {
            arr[i + 1] = 36 + Math.random() * 6;
            arr[i] = (Math.random() - 0.5) * 70;
            arr[i + 2] = (Math.random() - 0.5) * 70;
          }
        }
        pos.needsUpdate = true;
      }
    }
  });

  return (
    <>
      <hemisphereLight ref={hemiRef} intensity={0.6} color="#cfe3f0" groundColor="#5a5140" />
      <primitive object={sunTarget} />
      <directionalLight
        ref={sunRef}
        position={[120, 180, 80]}
        intensity={1}
        castShadow={quality === 'high'}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-near={1}
        shadow-camera-far={320}
        shadow-bias={-0.00022}
        shadow-normalBias={0.028}
      />
      <mesh ref={skyRef} renderOrder={-100}>
        <sphereGeometry args={[650, 24, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`varying vec3 vDirection;
            void main() {
              vDirection = normalize(position);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`}
          fragmentShader={`uniform vec3 topColor; uniform vec3 bottomColor;
            uniform vec3 sunDirection; uniform vec3 sunColor;
            varying vec3 vDirection;
            void main() {
              vec3 dir = normalize(vDirection);
              float h = dir.y;
              float t = clamp(pow(max(h, 0.0), 0.55), 0.0, 1.0);
              vec3 color = mix(bottomColor, topColor, t);
              float horizon = pow(1.0 - clamp(max(h, 0.0), 0.0, 1.0), 7.0);
              color = mix(color, bottomColor * 1.06, horizon * 0.3);
              float sunDot = max(dot(dir, normalize(sunDirection)), 0.0);
              float disc = smoothstep(0.9993, 0.9998, sunDot);
              float halo = pow(sunDot, 42.0) * 0.32 + pow(sunDot, 9.0) * 0.11;
              color += sunColor * (disc * 1.15 + halo);
              gl_FragColor = vec4(color, 1.0);
            }`}
        />
      </mesh>
      <points ref={rainRef} geometry={rainGeo} visible={false}>
        <pointsMaterial color="#9fb8cc" size={0.14} transparent opacity={0.65} depthWrite={false} />
      </points>
    </>
  );
}
