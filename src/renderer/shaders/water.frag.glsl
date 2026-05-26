// water.frag.glsl
uniform float uTime;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uSunlightIntensity;
uniform float uOpacity;

varying vec2 vUv;
varying vec3 vNormal;
varying float vViewDepth;
varying vec3 vWorldPosition;

void main() {
    // Water base color and opacity
    vec4 waterColor = vec4(0.12, 0.35, 0.76, 0.65);

    // Create moving specular highlights/ripples based on coordinates and time
    float ripple1 = sin(vWorldPosition.x * 2.0 + uTime * 1.5) * cos(vWorldPosition.z * 2.0 + uTime * 1.2);
    float ripple2 = cos(vWorldPosition.x * 4.0 - uTime * 2.0) * sin(vWorldPosition.z * 4.0 - uTime * 1.5);
    
    // Combine ripples for wave sheen
    float sheen = clamp((ripple1 + ripple2) * 0.5, 0.0, 1.0) * 0.15;
    waterColor.rgb += sheen;

    // Direct sun lighting
    vec3 sunDirection = normalize(vec3(0.5, 1.0, 0.3));
    float diffuse = max(0.5, dot(vNormal, sunDirection));
    vec3 litColor = waterColor.rgb * (diffuse * uSunlightIntensity + 0.3);

    // Apply exponential fog
    float fogFactor = 1.0 - exp(-vViewDepth * uFogDensity);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    
    vec3 finalColor = mix(litColor, uFogColor, fogFactor);

    gl_FragColor = vec4(finalColor, waterColor.a * uOpacity);
}
