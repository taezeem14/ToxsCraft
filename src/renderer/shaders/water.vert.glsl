// water.vert.glsl
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormal;
varying float vViewDepth;
varying vec3 vWorldPosition;

void main() {
    vUv = uv;
    vNormal = normal;

    vec3 pos = position;
    // Displace vertex height only for flat top faces (where normal is pointing up)
    if (normal.y > 0.5) {
        pos.y += sin(position.x * 1.0 + uTime * 2.5) * 0.06 + cos(position.z * 1.0 + uTime * 2.0) * 0.06 - 0.08;
    }

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    vViewDepth = -mvPosition.z;
    vWorldPosition = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPosition;
}
