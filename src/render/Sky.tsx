import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGame } from '../state/store';
import type { QualityTier } from './controls';

interface SkyProps {
  quality: QualityTier;
}

const DAY_TOP = new THREE.Color('#4a90d9');
const DAY_BOTTOM = new THREE.Color('#cfe3f0');
const NIGHT_TOP = new THREE.Color('#0b1026');
const NIGHT_BOTTOM = new THREE.Color('#1a1f33');
const DUSK = new THREE.Color('#e08a4a');

export function SkyAndWeather({ quality }: SkyProps) {
  const skyRef = useRef<THREE.Mesh>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const rainRef = useRef<THREE.Points>(null);
  const cameraPos = useRef(new THREE.Vector3());
  const { scene } = useThree();

  useFrame(({ camera }) => {
    cameraPos.current.copy(camera.position);
  });

  const uniforms = useMemo(
    () => ({
      topColor: { value: new THREE.Color('#4a90d9') },
      bottomColor: { value: new THREE.Color('#cfe3f0') },
    }),
    [],
  );

  const rainGeo = useMemo(() => {
    const count = 700;
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

    const top = NIGHT_TOP.clone().lerp(DAY_TOP, day).lerp(DUSK, duskAmount * 0.35);
    const bottom = NIGHT_BOTTOM.clone().lerp(DAY_BOTTOM, day).lerp(DUSK, duskAmount * 0.5);

    if (weather === 'rain') {
      top.lerp(new THREE.Color('#39424e'), 0.55);
      bottom.lerp(new THREE.Color('#5a6570'), 0.55);
    }

    uniforms.topColor.value.copy(top);
    uniforms.bottomColor.value.copy(bottom);
    if (skyRef.current) skyRef.current.position.set(cameraPos.current.x, 0, cameraPos.current.z);

    fog.color.copy(bottom);
    fog.far = quality === 'low' ? 150 : quality === 'mid' ? 220 : 300;
    if (weather === 'rain') fog.far *= 0.7;

    if (sunRef.current) {
      const angle = (minute / 1440) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(angle) * 220;
      const py = Math.max(Math.sin(angle) * 220, -40);
      sunRef.current.position.set(px + cameraPos.current.x, py, 90 + cameraPos.current.z);
      sunRef.current.intensity = 0.12 + day * (weather === 'rain' ? 0.55 : 0.95);
      sunRef.current.color.set(day > 0.5 ? '#fff2dd' : '#ffcf9e');
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = 0.22 + day * 0.5;
      hemiRef.current.color.copy(bottom);
    }

    if (rainRef.current) {
      const engine2 = useGame.getState();
      rainRef.current.visible = weather === 'rain';
      if (weather === 'rain') {
        rainRef.current.position.set(engine2.player.x, 0, engine2.player.z);
        const pos = rainRef.current.geometry.attributes.position as THREE.BufferAttribute;
        const arr = pos.array as Float32Array;
        for (let i = 0; i < arr.length; i += 3) {
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
      <hemisphereLight ref={hemiRef} intensity={0.6} />
      <directionalLight
        ref={sunRef}
        position={[120, 180, 80]}
        intensity={1}
        castShadow={quality === 'high'}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-far={400}
      />
      <mesh ref={skyRef} renderOrder={-100}>
        <sphereGeometry args={[650, 24, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`varying vec3 vWorldPosition;
            void main() {
              vec4 worldPosition = modelMatrix * vec4(position, 1.0);
              vWorldPosition = worldPosition.xyz;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }`}
          fragmentShader={`uniform vec3 topColor; uniform vec3 bottomColor;
            varying vec3 vWorldPosition;
            void main() {
              float h = normalize(vWorldPosition).y;
              float t = clamp(pow(max(h, 0.0), 0.55), 0.0, 1.0);
              gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
            }`}
        />
      </mesh>
      <points ref={rainRef} geometry={rainGeo} visible={false}>
        <pointsMaterial color="#9fb8cc" size={0.14} transparent opacity={0.65} depthWrite={false} />
      </points>
    </>
  );
}
