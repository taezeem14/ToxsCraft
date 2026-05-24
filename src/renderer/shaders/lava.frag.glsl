// lava.frag.glsl
uniform float uTime;
uniform vec3 uFogColor;
uniform float uFogDensity;

varying vec2 vUv;
varying vec3 vNormal;
varying float vViewDepth;
varying vec3 vWorldPosition;

void main() {
    float speed = uTime * 0.4;
    
    // Low frequency magma crust pattern
    float n1 = sin(vWorldPosition.x * 0.8 + speed) * cos(vWorldPosition.z * 0.8 + speed * 0.7);
    // Medium frequency heat ripples
    float n2 = cos(vWorldPosition.x * 2.2 - speed * 1.2) * sin(vWorldPosition.z * 1.8 + speed * 0.9);

    vec3 darkCrust = vec3(0.38, 0.05, 0.0); // Dark red crust
    vec3 brightMagma = vec3(1.0, 0.32, 0.0); // Liquid orange magma
    
    // Mix crust and magma
    vec3 lavaColor = mix(darkCrust, brightMagma, clamp((n1 * 0.6 + n2 * 0.4) + 0.6, 0.0, 1.0));

    // High frequency yellow thermal hot spots
    float hotSpot = sin(vWorldPosition.x * 4.0 - speed * 2.0) * sin(vWorldPosition.z * 4.0 + speed * 1.5);
    if (hotSpot > 0.68) {
        lavaColor = mix(lavaColor, vec3(1.0, 0.88, 0.15), (hotSpot - 0.68) * 3.12);
    }

    // Lava is fully emissive and does not receive sun diffuse lighting
    // Apply exponential fog
    float fogFactor = 1.0 - exp(-vViewDepth * uFogDensity);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    
    vec3 finalColor = mix(lavaColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, 1.0);
}
