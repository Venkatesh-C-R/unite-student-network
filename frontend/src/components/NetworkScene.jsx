import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

const NODE_COUNT = 44 // one node per eligible programme
const RADIUS = 2.6
const PALETTE = ['#6366F1', '#8B5CF6', '#A78BFA', '#22D3EE', '#06B6D4', '#818CF8']

function buildGraph() {
  // Even spread over a sphere (Fibonacci lattice)
  const pts = []
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < NODE_COUNT; i++) {
    const y = 1 - (i / (NODE_COUNT - 1)) * 2
    const r = Math.sqrt(1 - y * y)
    const t = golden * i
    pts.push(new THREE.Vector3(Math.cos(t) * r * RADIUS, y * RADIUS, Math.sin(t) * r * RADIUS))
  }

  const nearest = (i, pool) =>
    pool
      .filter((j) => j !== i)
      .sort((a, b) => pts[i].distanceToSquared(pts[a]) - pts[i].distanceToSquared(pts[b]))

  // Faint web: each node to its 2 nearest neighbours
  const web = []
  const all = pts.map((_, i) => i)
  pts.forEach((p, i) => nearest(i, all).slice(0, 2).forEach((j) => web.push(p, pts[j])))

  // Groups of six distinct nodes (= six programmes), drawn as bright rings
  const free = new Set(all)
  const groups = []
  for (const seed of [0, 9, 18, 27, 36, 43]) {
    if (!free.has(seed)) continue
    const members = [seed, ...nearest(seed, [...free]).slice(0, 5)]
    if (members.length < 6) continue
    members.forEach((m) => free.delete(m))
    groups.push(members)
  }
  const ring = []
  const nodeGroup = new Array(NODE_COUNT).fill(-1)
  groups.forEach((g, gi) => {
    const c = g.reduce((acc, m) => acc.add(pts[m]), new THREE.Vector3()).divideScalar(6)
    g.forEach((m) => {
      nodeGroup[m] = gi
      ring.push(c, pts[m])
    })
  })
  return { pts, web, ring, nodeGroup, groupCount: groups.length }
}

function Network({ animate }) {
  const root = useRef()
  const nodes = useRef()
  const { pts, web, ring, nodeGroup } = useMemo(() => buildGraph(), [])

  const webGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(web), [web])
  const ringGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(ring), [ring])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const colors = useMemo(() => {
    const arr = new Float32Array(NODE_COUNT * 3)
    pts.forEach((_, i) => {
      const c = new THREE.Color(nodeGroup[i] >= 0 ? PALETTE[nodeGroup[i] % PALETTE.length] : '#475080')
      c.toArray(arr, i * 3)
    })
    return arr
  }, [pts, nodeGroup])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (root.current && animate) {
      root.current.rotation.y = t * 0.08 + state.pointer.x * 0.35
      root.current.rotation.x = -state.pointer.y * 0.25
    }
    if (nodes.current) {
      pts.forEach((p, i) => {
        const s = nodeGroup[i] >= 0 ? 0.11 + Math.sin(t * 2 + i) * (animate ? 0.025 : 0) : 0.06
        dummy.position.copy(p)
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        nodes.current.setMatrixAt(i, dummy.matrix)
      })
      nodes.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={root}>
      <lineSegments geometry={webGeo}>
        <lineBasicMaterial color="#6366F1" transparent opacity={0.18} />
      </lineSegments>
      <lineSegments geometry={ringGeo}>
        <lineBasicMaterial color="#A78BFA" transparent opacity={0.65} />
      </lineSegments>
      <instancedMesh ref={nodes} args={[undefined, undefined, NODE_COUNT]}>
        <sphereGeometry args={[1, 16, 16]}>
          <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
        </sphereGeometry>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

// Slowly drifting background particles
const DUST = Float32Array.from({ length: 60 * 3 }, () => (Math.random() - 0.5) * 8)

function Dust() {
  const ref = useRef()
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[DUST, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#A78BFA" size={0.04} transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

export default function NetworkScene() {
  const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return (
    <Canvas camera={{ position: [0, 0, 7.2], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
      <Network animate={animate} />
      {animate && <Dust />}
    </Canvas>
  )
}
