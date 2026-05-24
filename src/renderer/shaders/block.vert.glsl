// block.vert.glsl
varying vec2 vUv;
varying vec3 vColor;
varying vec3 vNormal;
varying float vViewDepth;

void main() {
    vUv = uv;
    vColor = color;
    vNormal = normal;
    
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
}
