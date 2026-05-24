// lava.vert.glsl
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying float vViewDepth;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;
    vNormal = normal;

    vec3 pos = position;
    // Heavy slow displacement for top faces
    if (normal.y > 0.5) {
        pos.y += sin(position.x * 0.6 + uTime * 0.7) * 0.04 + cos(position.z * 0.6 + uTime * 0.5) * 0.04 - 0.06;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewDepth = -mvPosition.z;
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
}
